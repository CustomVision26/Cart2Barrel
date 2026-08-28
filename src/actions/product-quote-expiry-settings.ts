"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  clearProductQuoteExpiryOverride,
  searchQuotedProductsForAdminExpiry,
  upsertProductQuoteExpiryOverride,
  type AdminQuotedProductExpiryRow,
} from "@/data/quote-expiry-settings";
import { getItemRequestById } from "@/data/item-requests";
import { getDb } from "@/db";
import { batchQuoteSessionLines, itemRequests } from "@/db/schema";
import { getClerkSessionGate } from "@/lib/clerk-session";
import {
  formatQuoteExpiryWindowLabel,
  minutesFromDurationAmount,
} from "@/lib/quote-expiry";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import {
  clearProductQuoteExpirySettingsSchema,
  searchQuotedProductsForExpirySchema,
  upsertProductQuoteExpirySettingsSchema,
} from "@/lib/validations/quote-expiry-settings";

export type ProductQuoteExpiryActionState =
  | { ok: true; message: string; expiryMinutes?: number }
  | { ok: false; message: string };

export type SearchQuotedProductsForExpiryState =
  | { ok: true; rows: AdminQuotedProductExpiryRow[] }
  | { ok: false; message: string; rows: [] };

function revalidateProductExpirySurfaces() {
  revalidatePath("/admin/overview");
  revalidatePath("/dashboard/items/new/add-item", "layout");
  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard/items");
}

export async function searchQuotedProductsForExpiryAction(
  raw: unknown,
): Promise<SearchQuotedProductsForExpiryState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: gate.message, rows: [] };
  }
  if (!gate.isAdmin) {
    return { ok: false, message: "Admin access required.", rows: [] };
  }

  const parsed = searchQuotedProductsForExpirySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid search.", rows: [] };
  }

  const rows = await searchQuotedProductsForAdminExpiry({
    query: parsed.data.query ?? "",
    clerkUserId: parsed.data.clerkUserId ?? null,
  });
  return { ok: true, rows };
}

export async function upsertProductQuoteExpirySettingsAction(
  raw: unknown,
): Promise<ProductQuoteExpiryActionState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }
  if (!gate.isAdmin) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = upsertProductQuoteExpirySettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Enter a duration from 1 minute to 90 days.",
    };
  }

  const expiryMinutes = minutesFromDurationAmount(
    parsed.data.amount,
    parsed.data.unit,
  );

  try {
    const existing = await getItemRequestById(parsed.data.itemRequestId);
    if (!existing) {
      return { ok: false, message: "Quoted product not found." };
    }

    if (parsed.data.restoreToActive && existing.batchQuoteSessionId) {
      const db = getDb();
      await db
        .delete(batchQuoteSessionLines)
        .where(
          and(
            eq(batchQuoteSessionLines.batchQuoteSessionId, existing.batchQuoteSessionId),
            eq(batchQuoteSessionLines.itemRequestId, existing.id),
          ),
        );
      await db
        .update(itemRequests)
        .set({ batchQuoteSessionId: null })
        .where(eq(itemRequests.id, existing.id));
    }

    const saved = await upsertProductQuoteExpiryOverride({
      itemRequestId: parsed.data.itemRequestId,
      expiryMinutes,
    });
    revalidateProductExpirySurfaces();
    revalidateDashboardAddItem();
    return {
      ok: true,
      message: parsed.data.restoreToActive
        ? `Published ${formatQuoteExpiryWindowLabel(saved.expiryMinutes)} window. Product left Expired Quotes and is back on Active.`
        : `Product override published: ${formatQuoteExpiryWindowLabel(saved.expiryMinutes)} for this quoted product.`,
      expiryMinutes: saved.expiryMinutes,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save product override.";
    return {
      ok: false,
      message:
        msg.includes("quote_expiry_minutes_override") ||
        msg.includes("quote_expiry_override_anchored_at")
          ? "Database is missing the product expiry column. Run `npm run db:ensure-quote-expiry`."
          : msg,
    };
  }
}

export async function clearProductQuoteExpirySettingsAction(
  raw: unknown,
): Promise<ProductQuoteExpiryActionState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }
  if (!gate.isAdmin) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = clearProductQuoteExpirySettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid product." };
  }

  try {
    const removed = await clearProductQuoteExpiryOverride(
      parsed.data.itemRequestId,
    );
    if (!removed) {
      return { ok: false, message: "Product not found." };
    }
    revalidateProductExpirySurfaces();
    return {
      ok: true,
      message:
        "Product override cleared. This line uses the customer or hub window again.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not clear override.";
    return { ok: false, message: msg };
  }
}
