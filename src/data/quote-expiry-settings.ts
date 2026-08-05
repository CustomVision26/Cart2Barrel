import "server-only";

import { cache } from "react";
import { and, asc, desc, eq, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  customerQuoteExpirySettings,
  itemRequests,
  profiles,
  quoteExpirySettings,
} from "@/db/schema";
import {
  getLatestQuoteForItemRequest,
  restoreOrphanQuotedItemRequestQuote,
} from "@/data/item-quotes";
import {
  clampExpiryMinutes,
  DEFAULT_QUOTE_EXPIRY_MINUTES,
  effectiveQuoteExpiryMinutes,
  isQuoteExpired,
  resolveQuoteExpiryClockStart,
  type QuoteExpirySource,
} from "@/lib/quote-expiry";

const HUB_KEY = "default";

export type QuoteExpirySettingsPublic = {
  expiryMinutes: number;
  updatedAt: string | null;
  /** Whether minutes came from the hub default or a customer override. */
  source: "global" | "customer";
  clerkUserId?: string | null;
};

export type CustomerQuoteExpiryOverrideRow = {
  clerkUserId: string;
  displayName: string;
  email: string | null;
  expiryMinutes: number;
  updatedAt: string;
};

async function loadGlobalQuoteExpiryRow(): Promise<{
  expiryMinutes: number;
  updatedAt: string | null;
}> {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(quoteExpirySettings)
      .where(eq(quoteExpirySettings.singletonKey, HUB_KEY))
      .limit(1);
    if (!row) {
      return {
        expiryMinutes: DEFAULT_QUOTE_EXPIRY_MINUTES,
        updatedAt: null,
      };
    }
    return {
      expiryMinutes: clampExpiryMinutes(row.expiryMinutes),
      updatedAt: row.updatedAt,
    };
  } catch {
    return {
      expiryMinutes: DEFAULT_QUOTE_EXPIRY_MINUTES,
      updatedAt: null,
    };
  }
}

export async function getCustomerQuoteExpiryOverride(
  clerkUserId: string,
): Promise<{ expiryMinutes: number; updatedAt: string } | null> {
  const id = clerkUserId.trim();
  if (!id) return null;
  try {
    const db = getDb();
    const [row] = await db
      .select({
        expiryMinutes: customerQuoteExpirySettings.expiryMinutes,
        updatedAt: customerQuoteExpirySettings.updatedAt,
      })
      .from(customerQuoteExpirySettings)
      .where(eq(customerQuoteExpirySettings.clerkUserId, id))
      .limit(1);
    if (!row) return null;
    return {
      expiryMinutes: clampExpiryMinutes(row.expiryMinutes),
      updatedAt: row.updatedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Effective quote window for a shopper. When `clerkUserId` has an override,
 * that value applies to all of their open quoted products; otherwise the hub
 * default is used.
 */
export const loadQuoteExpirySettings = cache(
  async (clerkUserId?: string | null): Promise<QuoteExpirySettingsPublic> => {
    const global = await loadGlobalQuoteExpiryRow();
    const id = clerkUserId?.trim() || null;
    if (!id) {
      return { ...global, source: "global", clerkUserId: null };
    }
    const override = await getCustomerQuoteExpiryOverride(id);
    if (!override) {
      return { ...global, source: "global", clerkUserId: id };
    }
    return {
      expiryMinutes: override.expiryMinutes,
      updatedAt: override.updatedAt,
      source: "customer",
      clerkUserId: id,
    };
  },
);

export async function upsertQuoteExpirySettings(params: {
  expiryMinutes: number;
  updatedByClerkUserId: string;
}): Promise<QuoteExpirySettingsPublic> {
  const db = getDb();
  const expiryMinutes = clampExpiryMinutes(params.expiryMinutes);
  const updatedAt = new Date().toISOString();

  const [existing] = await db
    .select({ k: quoteExpirySettings.singletonKey })
    .from(quoteExpirySettings)
    .where(eq(quoteExpirySettings.singletonKey, HUB_KEY))
    .limit(1);

  if (existing) {
    await db
      .update(quoteExpirySettings)
      .set({
        expiryMinutes,
        updatedByClerkUserId: params.updatedByClerkUserId,
        updatedAt,
      })
      .where(eq(quoteExpirySettings.singletonKey, HUB_KEY));
  } else {
    await db.insert(quoteExpirySettings).values({
      singletonKey: HUB_KEY,
      expiryMinutes,
      updatedByClerkUserId: params.updatedByClerkUserId,
      updatedAt,
    });
  }

  return { expiryMinutes, updatedAt, source: "global", clerkUserId: null };
}

export async function upsertCustomerQuoteExpirySettings(params: {
  clerkUserId: string;
  expiryMinutes: number;
  updatedByClerkUserId: string;
}): Promise<QuoteExpirySettingsPublic> {
  const db = getDb();
  const clerkUserId = params.clerkUserId.trim();
  const expiryMinutes = clampExpiryMinutes(params.expiryMinutes);
  const updatedAt = new Date().toISOString();

  const [existing] = await db
    .select({ k: customerQuoteExpirySettings.clerkUserId })
    .from(customerQuoteExpirySettings)
    .where(eq(customerQuoteExpirySettings.clerkUserId, clerkUserId))
    .limit(1);

  if (existing) {
    await db
      .update(customerQuoteExpirySettings)
      .set({
        expiryMinutes,
        updatedByClerkUserId: params.updatedByClerkUserId,
        updatedAt,
      })
      .where(eq(customerQuoteExpirySettings.clerkUserId, clerkUserId));
  } else {
    await db.insert(customerQuoteExpirySettings).values({
      clerkUserId,
      expiryMinutes,
      updatedByClerkUserId: params.updatedByClerkUserId,
      updatedAt,
    });
  }

  return {
    expiryMinutes,
    updatedAt,
    source: "customer",
    clerkUserId,
  };
}

export async function deleteCustomerQuoteExpirySettings(
  clerkUserId: string,
): Promise<boolean> {
  const id = clerkUserId.trim();
  if (!id) return false;
  const db = getDb();
  const deleted = await db
    .delete(customerQuoteExpirySettings)
    .where(eq(customerQuoteExpirySettings.clerkUserId, id))
    .returning({ id: customerQuoteExpirySettings.clerkUserId });
  return deleted.length > 0;
}

export async function listCustomerQuoteExpiryOverridesForAdmin(): Promise<
  CustomerQuoteExpiryOverrideRow[]
> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        clerkUserId: customerQuoteExpirySettings.clerkUserId,
        expiryMinutes: customerQuoteExpirySettings.expiryMinutes,
        updatedAt: customerQuoteExpirySettings.updatedAt,
        fullName: profiles.fullName,
        email: profiles.email,
      })
      .from(customerQuoteExpirySettings)
      .innerJoin(
        profiles,
        eq(customerQuoteExpirySettings.clerkUserId, profiles.clerkUserId),
      )
      .orderBy(
        desc(customerQuoteExpirySettings.updatedAt),
        asc(profiles.fullName),
      );

    return rows.map((r) => {
      const name = r.fullName?.trim();
      const email = r.email?.trim() || null;
      return {
        clerkUserId: r.clerkUserId,
        displayName: name || email || r.clerkUserId,
        email,
        expiryMinutes: clampExpiryMinutes(r.expiryMinutes),
        updatedAt: r.updatedAt,
      };
    });
  } catch {
    return [];
  }
}

export type AdminQuotedProductExpiryRow = {
  itemRequestId: string;
  productName: string | null;
  productUrl: string;
  siteName: string | null;
  status: "quoted" | "approved";
  clerkUserId: string;
  customerDisplayName: string;
  customerEmail: string | null;
  quoteIssuedAt: string | null;
  productOverrideAnchoredAt: string | null;
  productOverrideMinutes: number | null;
  accountExpiryMinutes: number;
  accountSource: "global" | "customer";
  effectiveExpiryMinutes: number;
  effectiveSource: QuoteExpirySource;
  /** True when the accept/pay window has already elapsed. */
  quoteExpired: boolean;
};

async function enrichQuotedProductExpiryRows(
  rows: {
    id: string;
    productName: string | null;
    productUrl: string;
    siteName: string | null;
    status: string;
    clerkUserId: string;
    quoteExpiryMinutesOverride: number | null;
    quoteExpiryOverrideAnchoredAt: string | null;
    fullName: string | null;
    email: string | null;
  }[],
): Promise<AdminQuotedProductExpiryRow[]> {
  const out: AdminQuotedProductExpiryRow[] = [];
  for (const r of rows) {
    if (r.status !== "quoted" && r.status !== "approved") continue;
    const account = await loadQuoteExpirySettings(r.clerkUserId);
    const productOverride =
      r.quoteExpiryMinutesOverride != null
        ? clampExpiryMinutes(r.quoteExpiryMinutesOverride)
        : null;
    const effective = effectiveQuoteExpiryMinutes(
      account.expiryMinutes,
      productOverride,
    );
    let quoteIssuedAt: string | null = null;
    let quote = await getLatestQuoteForItemRequest(r.id);
    if (!quote) quote = await restoreOrphanQuotedItemRequestQuote(r.id);
    if (quote) quoteIssuedAt = quote.createdAt;

    const productOverrideAnchoredAt =
      r.quoteExpiryOverrideAnchoredAt?.trim() || null;
    const clockStart = resolveQuoteExpiryClockStart({
      quoteIssuedAt,
      productOverrideMinutes: productOverride,
      productOverrideAnchoredAt,
    });
    const quoteExpired =
      r.status === "quoted" &&
      isQuoteExpired(clockStart, effective.expiryMinutes);

    const name = r.fullName?.trim();
    const email = r.email?.trim() || null;
    out.push({
      itemRequestId: r.id,
      productName: r.productName,
      productUrl: r.productUrl,
      siteName: r.siteName,
      status: r.status,
      clerkUserId: r.clerkUserId,
      customerDisplayName: name || email || r.clerkUserId,
      customerEmail: email,
      quoteIssuedAt,
      productOverrideAnchoredAt,
      productOverrideMinutes: productOverride,
      accountExpiryMinutes: account.expiryMinutes,
      accountSource: account.source,
      effectiveExpiryMinutes: effective.expiryMinutes,
      effectiveSource:
        effective.source === "product"
          ? "product"
          : account.source === "customer"
            ? "customer"
            : "global",
      quoteExpired,
    });
  }
  return out;
}

/** Search quoted (and cart-approved) products for admin per-product expiry. */
export async function searchQuotedProductsForAdminExpiry(options: {
  query?: string;
  clerkUserId?: string | null;
  limit?: number;
}): Promise<AdminQuotedProductExpiryRow[]> {
  const q = (options.query ?? "").trim();
  const clerkUserId = options.clerkUserId?.trim() || null;
  const limit = options.limit ?? 40;
  try {
    const db = getDb();
    const statusFilter = inArray(itemRequests.status, ["quoted", "approved"]);
    const pattern = q ? `%${q.replace(/[%_]/g, "")}%` : null;
    const customerFilter = clerkUserId
      ? eq(itemRequests.clerkUserId, clerkUserId)
      : undefined;

    const idPattern = `%${q.replace(/-/g, "").replace(/[%_]/g, "")}%`;
    const productMatch = pattern
      ? clerkUserId
        ? or(
            ilike(itemRequests.productName, pattern),
            ilike(itemRequests.productUrl, pattern),
            ilike(itemRequests.siteName, pattern),
            ilike(itemRequests.outsidePurchaseReference, pattern),
            sql`replace(${itemRequests.id}::text, '-', '') ilike ${idPattern}`,
          )
        : or(
            ilike(itemRequests.productName, pattern),
            ilike(itemRequests.productUrl, pattern),
            ilike(itemRequests.siteName, pattern),
            ilike(itemRequests.outsidePurchaseReference, pattern),
            ilike(profiles.fullName, pattern),
            ilike(profiles.email, pattern),
            sql`replace(${itemRequests.id}::text, '-', '') ilike ${idPattern}`,
          )
      : undefined;

    const rows = await db
      .select({
        id: itemRequests.id,
        productName: itemRequests.productName,
        productUrl: itemRequests.productUrl,
        siteName: itemRequests.siteName,
        status: itemRequests.status,
        clerkUserId: itemRequests.clerkUserId,
        quoteExpiryMinutesOverride: itemRequests.quoteExpiryMinutesOverride,
        quoteExpiryOverrideAnchoredAt:
          itemRequests.quoteExpiryOverrideAnchoredAt,
        fullName: profiles.fullName,
        email: profiles.email,
      })
      .from(itemRequests)
      .innerJoin(profiles, eq(itemRequests.clerkUserId, profiles.clerkUserId))
      .where(
        and(
          statusFilter,
          customerFilter,
          productMatch
            ? productMatch
            : or(
                isNotNull(itemRequests.quoteExpiryMinutesOverride),
                eq(itemRequests.status, "quoted"),
              ),
        ),
      )
      .orderBy(
        desc(itemRequests.quoteExpiryMinutesOverride),
        desc(itemRequests.createdAt),
      )
      .limit(limit);

    return enrichQuotedProductExpiryRows(rows);
  } catch {
    return [];
  }
}

export async function listProductQuoteExpiryOverridesForAdmin(): Promise<
  AdminQuotedProductExpiryRow[]
> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: itemRequests.id,
        productName: itemRequests.productName,
        productUrl: itemRequests.productUrl,
        siteName: itemRequests.siteName,
        status: itemRequests.status,
        clerkUserId: itemRequests.clerkUserId,
        quoteExpiryMinutesOverride: itemRequests.quoteExpiryMinutesOverride,
        quoteExpiryOverrideAnchoredAt:
          itemRequests.quoteExpiryOverrideAnchoredAt,
        fullName: profiles.fullName,
        email: profiles.email,
      })
      .from(itemRequests)
      .innerJoin(profiles, eq(itemRequests.clerkUserId, profiles.clerkUserId))
      .where(
        and(
          inArray(itemRequests.status, ["quoted", "approved"]),
          isNotNull(itemRequests.quoteExpiryMinutesOverride),
        ),
      )
      .orderBy(desc(itemRequests.createdAt))
      .limit(100);

    return enrichQuotedProductExpiryRows(rows);
  } catch {
    return [];
  }
}

export async function upsertProductQuoteExpiryOverride(params: {
  itemRequestId: string;
  expiryMinutes: number;
}): Promise<{
  itemRequestId: string;
  expiryMinutes: number;
  clerkUserId: string;
}> {
  const db = getDb();
  const expiryMinutes = clampExpiryMinutes(params.expiryMinutes);
  const anchoredAt = new Date().toISOString();
  const updated = await db
    .update(itemRequests)
    .set({
      quoteExpiryMinutesOverride: expiryMinutes,
      // Fresh accept/pay window from publish — not from original quote time.
      quoteExpiryOverrideAnchoredAt: anchoredAt,
    })
    .where(
      and(
        eq(itemRequests.id, params.itemRequestId),
        inArray(itemRequests.status, ["quoted", "approved"]),
      ),
    )
    .returning({
      id: itemRequests.id,
      clerkUserId: itemRequests.clerkUserId,
      quoteExpiryMinutesOverride: itemRequests.quoteExpiryMinutesOverride,
    });

  if (updated.length === 0) {
    throw new Error("Quoted product not found (or no longer quoted).");
  }
  return {
    itemRequestId: updated[0]!.id,
    expiryMinutes: clampExpiryMinutes(
      updated[0]!.quoteExpiryMinutesOverride ?? expiryMinutes,
    ),
    clerkUserId: updated[0]!.clerkUserId,
  };
}

export async function clearProductQuoteExpiryOverride(
  itemRequestId: string,
): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(itemRequests)
    .set({
      quoteExpiryMinutesOverride: null,
      quoteExpiryOverrideAnchoredAt: null,
    })
    .where(eq(itemRequests.id, itemRequestId))
    .returning({ id: itemRequests.id });
  return updated.length > 0;
}
