import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { ensureBudgetBarrelSchema } from "@/data/ensure-budget-barrel-schema";
import { notifyAdminsOfBatchQuoteSubmitted } from "@/data/admin-user-activity-events";
import { appendBatchQuoteSessionStatusEvent } from "@/data/batch-quote-session-status-events";
import {
  listItemRequestsForBatchSession,
  randomBatchDisplayNumber,
} from "@/data/batch-quote-sessions";
import { ensureShoppingListQuoteSchema } from "@/data/ensure-shopping-list-quote-schema";
import { insertItemRequestLineSnapshot, lineSnapshotPayloadFromItemRequest } from "@/data/item-request-line-snapshots";
import { getDb } from "@/db";
import {
  batchQuoteSessionLines,
  batchQuoteSessions,
  budgetBarrelDrafts,
  itemRequests,
  shoppingListQuoteLines,
  shoppingListQuotes,
  type BudgetBarrelDraft,
} from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import { refreshBudgetBarrelOffer } from "@/lib/budget-barrel/search-offers";
import { budgetBarrelShoppingLocation } from "@/lib/budget-barrel/hub-location";
import {
  BUDGET_BARREL_MAX_REFRESH,
  BUDGET_BARREL_SOURCE_KIND,
  BUDGET_BARREL_STALE_MS,
} from "@/lib/budget-barrel/constants";
import { applyCustomerProductEdits } from "@/lib/budget-barrel/customer-edits";
import { priceSelection } from "@/lib/budget-barrel/select-list";
import { isOfferStale } from "@/lib/budget-barrel/submit-guards";
import type {
  BudgetBarrelBuilderSnapshot,
  BudgetBarrelClientView,
  BudgetBarrelOffer,
  BudgetBarrelRequest,
} from "@/lib/budget-barrel/types";
import { buildBatchQuoteHistorySnapshot } from "@/lib/batch-quote-history-snapshot";
import {
  SHOPPING_LIST_SITE_KEY,
  SHOPPING_LIST_SITE_NAME,
} from "@/lib/shopping-list-quote";
import type { SubmitBudgetBarrelInput } from "@/lib/validations/budget-barrel";

export type BudgetBarrelSubmitResult =
  | {
      ok: true;
      message: string;
      batchSessionId: string;
      replayed: boolean;
    }
  | {
      ok: false;
      code: "over_budget" | "missing_price" | "in_progress" | "not_found" | "invalid";
      message: string;
      offers?: BudgetBarrelOffer[];
      priceCheckedAt?: string;
    };

async function schemasReady(): Promise<boolean> {
  const [lists, drafts] = await Promise.all([
    ensureShoppingListQuoteSchema(),
    ensureBudgetBarrelSchema(),
  ]);
  return lists && drafts;
}

export async function insertBudgetBarrelDraft(input: {
  clerkUserId: string;
  request: BudgetBarrelRequest;
  view: Omit<BudgetBarrelClientView, "draftId">;
}): Promise<string> {
  const ready = await schemasReady();
  if (!ready) throw new Error("The shopping list store is not ready yet.");
  const db = getDb();
  const [row] = await db
    .insert(budgetBarrelDrafts)
    .values({
      clerkUserId: input.clerkUserId,
      status: "open",
      merchandiseBudgetCents: input.request.budgetCents,
      request: input.request,
      offers: input.view.offers,
      oneStore: input.view.oneStore,
      multiStore: input.view.multiStore,
      providerNotes: input.view.providerNotes,
      priceCheckedAt: input.view.priceCheckedAt,
    })
    .returning({ id: budgetBarrelDrafts.id });
  if (!row) throw new Error("Could not save this shopping list.");
  return row.id;
}

export async function readHeldOffersForOwner(
  clerkUserId: string,
  draftId: string,
  lines: { offerId: string; quantity: number }[],
): Promise<{ offer: BudgetBarrelOffer; quantity: number }[]> {
  if (lines.length === 0) return [];
  const ready = await schemasReady();
  if (!ready) return [];
  const draft = await readOwnedDraft(draftId, clerkUserId);
  if (!draft || !Array.isArray(draft.offers)) return [];
  const offers = draft.offers as BudgetBarrelOffer[];
  return lines.flatMap((line) => {
    const offer = offers.find(
      (row) => row?.id === line.offerId && typeof row.productUrl === "string",
    );
    return offer ? [{ offer, quantity: line.quantity }] : [];
  });
}

async function readOwnedDraft(
  draftId: string,
  clerkUserId: string,
): Promise<BudgetBarrelDraft | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(budgetBarrelDrafts)
    .where(
      and(
        eq(budgetBarrelDrafts.id, draftId),
        eq(budgetBarrelDrafts.clerkUserId, clerkUserId),
      ),
    )
    .limit(1);
  return row ?? null;
}

function mergeLines(lines: SubmitBudgetBarrelInput["lines"]): SubmitBudgetBarrelInput["lines"] {
  const merged = new Map<string, SubmitBudgetBarrelInput["lines"][number]>();
  for (const line of lines) {
    const existing = merged.get(line.offerId);
    if (!existing) {
      merged.set(line.offerId, { ...line });
      continue;
    }
    existing.quantity = Math.min(20, existing.quantity + line.quantity);
  }
  return [...merged.values()];
}

function snapshotNote(offer: BudgetBarrelOffer): string {
  const price =
    offer.priceCents == null ? "no USD price" : formatUsd(offer.priceCents);
  const seller = offer.sellerName
    ? `Seller: ${offer.sellerName}`
    : `Sold by ${offer.retailer}`;
  return [
    `Budget Barrel Builder snapshot ${price}`,
    `Checked ${offer.retrievedAt}`,
    `Retailer: ${offer.retailer}`,
    seller,
    offer.packSize ? `Pack: ${offer.packSize}` : null,
    offer.availability
      ? `Availability: ${offer.availability}`
      : "Availability: not confirmed",
    offer.needsStaffReview
      ? `Needs review: ${offer.reviewReason ?? "Confirm the current price and variant."}`
      : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(". ")
    .slice(0, 2000);
}

export async function submitBudgetBarrelForOwner(params: {
  clerkUserId: string;
  input: SubmitBudgetBarrelInput;
  budgetCents: number;
}): Promise<BudgetBarrelSubmitResult> {
  const ready = await schemasReady();
  if (!ready) {
    return { ok: false, code: "invalid", message: "The shopping list store is not ready yet." };
  }

  const owned = await readOwnedDraft(params.input.draftId, params.clerkUserId);
  if (!owned) {
    return { ok: false, code: "not_found", message: "That shopping list was not found." };
  }
  if (owned.status === "submitted" && owned.batchQuoteSessionId) {
    return {
      ok: true,
      replayed: true,
      batchSessionId: owned.batchQuoteSessionId,
      message: "This list was already submitted for an estimate.",
    };
  }
  if (owned.status === "submitting") {
    return {
      ok: false,
      code: "in_progress",
      message: "This list is already being submitted. Wait a moment, then try again.",
    };
  }
  if (owned.status !== "open") {
    return { ok: false, code: "not_found", message: "That shopping list was not found." };
  }

  const lines = mergeLines(params.input.lines);
  const originals = new Map(owned.offers.map((offer) => [offer.id, offer]));
  const offers = owned.offers.map((offer) => ({ ...offer }));
  const selectedIds = new Set(lines.map((line) => line.offerId));
  for (const line of lines) {
    if (!offers.some((offer) => offer.id === line.offerId)) {
      return {
        ok: false,
        code: "invalid",
        message: "A selected product is not on this shopping list.",
      };
    }
  }

  const location = await budgetBarrelShoppingLocation();
  let refreshes = 0;
  let pricesChanged = false;
  for (let index = 0; index < offers.length; index += 1) {
    const offer = offers[index];
    if (!offer || !selectedIds.has(offer.id)) continue;
    if (!isOfferStale(offer.retrievedAt, Date.now(), BUDGET_BARREL_STALE_MS)) continue;
    if (refreshes >= BUDGET_BARREL_MAX_REFRESH) {
      offers[index] = {
        ...offer,
        needsStaffReview: true,
        reviewReason: "Price was not refreshed before submit. Confirm before quoting.",
      };
      continue;
    }
    refreshes += 1;
    const refreshed = await refreshBudgetBarrelOffer(offer, location);
    if (refreshed.priceCents !== offer.priceCents) pricesChanged = true;
    offers[index] = refreshed;
  }

  for (let index = 0; index < offers.length; index += 1) {
    const offer = offers[index];
    const original = offer ? originals.get(offer.id) : undefined;
    const line = offer ? lines.find((row) => row.offerId === offer.id) : undefined;
    if (!offer || !original || !line) continue;
    offers[index] = applyCustomerProductEdits(original, offer, line);
  }

  const priceCheckedAt = new Date().toISOString();
  const db = getDb();
  await db
    .update(budgetBarrelDrafts)
    .set({
      offers,
      merchandiseBudgetCents: params.budgetCents,
      priceCheckedAt,
      updatedAt: priceCheckedAt,
    })
    .where(
      and(
        eq(budgetBarrelDrafts.id, owned.id),
        eq(budgetBarrelDrafts.clerkUserId, params.clerkUserId),
        eq(budgetBarrelDrafts.status, "open"),
      ),
    );

  const priced = priceSelection(offers, lines, params.budgetCents);
  if (priced.lines.length !== lines.length) {
    return {
      ok: false,
      code: "invalid",
      message: "A selected product is not on this shopping list.",
    };
  }
  if (priced.missingPriceCount > 0) {
    return {
      ok: false,
      code: "missing_price",
      message: "Remove items that do not have a USD price, or swap them for a priced offer.",
      offers,
      priceCheckedAt,
    };
  }
  if (priced.overBudgetCents > 0) {
    return {
      ok: false,
      code: "over_budget",
      message: "Updated prices put this list over the merchandise budget. Adjust the list or increase the budget.",
      offers,
      priceCheckedAt,
    };
  }

  const lockedAt = new Date().toISOString();
  const [locked] = await db
    .update(budgetBarrelDrafts)
    .set({
      status: "submitting",
      idempotencyKey: params.input.idempotencyKey,
      updatedAt: lockedAt,
    })
    .where(
      and(
        eq(budgetBarrelDrafts.id, owned.id),
        eq(budgetBarrelDrafts.clerkUserId, params.clerkUserId),
        eq(budgetBarrelDrafts.status, "open"),
      ),
    )
    .returning();

  if (!locked) {
    const again = await readOwnedDraft(owned.id, params.clerkUserId);
    if (again?.status === "submitted" && again.batchQuoteSessionId) {
      return {
        ok: true,
        replayed: true,
        batchSessionId: again.batchQuoteSessionId,
        message: "This list was already submitted for an estimate.",
      };
    }
    return {
      ok: false,
      code: "in_progress",
      message: "This list is already being submitted. Wait a moment, then try again.",
    };
  }

  const request = owned.request;
  const activePlan =
    params.input.listKind === "multi_store" ? owned.multiStore : owned.oneStore;
  const snapshot: BudgetBarrelBuilderSnapshot = {
    merchandiseBudgetCents: params.budgetCents,
    categories: request.categories,
    retailers: request.retailers,
    preferences: request.preferences,
    instructions: request.instructions,
    listKind: params.input.listKind,
    priceCheckedAt,
    unsatisfied: activePlan?.unsatisfied ?? [],
    merchandiseSubtotalCents: priced.merchandiseSubtotalCents,
    deliveryIncomplete: priced.deliveryIncomplete,
    deliveryCents: priced.deliveryCents,
  };

  let quoteId: string | null = null;
  let sessionId: string | null = null;
  const createdRequestIds: string[] = [];
  let committed = false;
  try {
    const [list] = await db
      .insert(shoppingListQuotes)
      .values({
        clerkUserId: params.clerkUserId,
        sourceKind: BUDGET_BARREL_SOURCE_KIND,
        customerNote: request.instructions,
        merchandiseBudgetCents: params.budgetCents,
        builderSnapshot: snapshot,
        status: "submitted",
        updatedAt: lockedAt,
      })
      .returning();
    if (!list) throw new Error("Could not save the shopping list.");
    quoteId = list.id;

    const lineRows = [];
    for (const [index, line] of priced.lines.entries()) {
      const [row] = await db
        .insert(shoppingListQuoteLines)
        .values({
          shoppingListQuoteId: list.id,
          sortIndex: index,
          productName: line.offer.productName,
          quantity: line.quantity,
          productSize: line.offer.size,
          productColor: line.offer.color,
          note: snapshotNote(line.offer),
          productImageUrl: line.offer.imageUrl,
          retailer: line.offer.retailer,
          sellerName: line.offer.sellerName,
          retailerProductUrl: line.offer.productUrl,
          packSize: line.offer.packSize,
          observedPriceCents: line.offer.priceCents,
          currency: line.offer.currency,
          availability: line.offer.availability,
          priceRetrievedAt: line.offer.retrievedAt,
          needsStaffReview: line.offer.needsStaffReview,
          retailerDeliveryCents: line.offer.deliveryCents,
        })
        .returning();
      if (row) lineRows.push({ row, offer: line.offer });
    }
    if (lineRows.length === 0) throw new Error("Add at least one product before submitting.");

    let session;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const [created] = await db
          .insert(batchQuoteSessions)
          .values({
            clerkUserId: params.clerkUserId,
            batchNumber: randomBatchDisplayNumber(),
            siteKey: SHOPPING_LIST_SITE_KEY,
            status: "submitted",
            submittedAt: lockedAt,
          })
          .returning();
        session = created;
        sessionId = created?.id ?? null;
        break;
      } catch (error) {
        const code =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof (error as { code: unknown }).code === "string"
            ? (error as { code: string }).code
            : "";
        const message = error instanceof Error ? error.message : "";
        if (code === "23505" && message.toLowerCase().includes("batch_number")) continue;
        throw error;
      }
    }
    if (!session) throw new Error("Could not assign a batch number.");

    const requestIds: string[] = [];
    for (const entry of lineRows) {
      const [req] = await db
        .insert(itemRequests)
        .values({
          clerkUserId: params.clerkUserId,
          productUrl: entry.offer.productUrl,
          productName: entry.row.productName,
          productSize: entry.row.productSize,
          productColor: entry.row.productColor,
          quantity: entry.row.quantity,
          note: entry.row.note,
          productImageUrl: entry.row.productImageUrl,
          siteName: SHOPPING_LIST_SITE_NAME,
          status: "pending",
          source: "customer_url",
          batchQuoteSessionId: session.id,
        })
        .returning();
      if (!req) continue;
      createdRequestIds.push(req.id);
      requestIds.push(req.id);
      await db
        .update(shoppingListQuoteLines)
        .set({ itemRequestId: req.id })
        .where(eq(shoppingListQuoteLines.id, entry.row.id));
      await insertItemRequestLineSnapshot({
        itemRequestId: req.id,
        phase: "customer_submission",
        batchQuoteSessionId: session.id,
        line: lineSnapshotPayloadFromItemRequest(req),
      });
      await insertItemRequestLineSnapshot({
        itemRequestId: req.id,
        phase: "batch_request_submitted_to_staff",
        batchQuoteSessionId: session.id,
        line: lineSnapshotPayloadFromItemRequest(req),
      });
    }
    if (requestIds.length === 0) {
      throw new Error("Could not create product lines from this list.");
    }

    await db.insert(batchQuoteSessionLines).values(
      requestIds.map((itemRequestId) => ({
        batchQuoteSessionId: session.id,
        itemRequestId,
      })),
    );
    await db
      .update(shoppingListQuotes)
      .set({ batchQuoteSessionId: session.id, updatedAt: lockedAt })
      .where(eq(shoppingListQuotes.id, list.id));
    await db
      .update(budgetBarrelDrafts)
      .set({
        status: "submitted",
        shoppingListQuoteId: list.id,
        batchQuoteSessionId: session.id,
        updatedAt: lockedAt,
      })
      .where(
        and(
          eq(budgetBarrelDrafts.id, owned.id),
          eq(budgetBarrelDrafts.clerkUserId, params.clerkUserId),
        ),
      );
    committed = true;

    await appendBatchQuoteSessionStatusEvent({
      batchQuoteSessionId: session.id,
      clerkUserId: params.clerkUserId,
      kind: "new_batch_request",
      detail: {
        snapshot: buildBatchQuoteHistorySnapshot({
          kind: "new_batch_request",
          session,
          requests: await listItemRequestsForBatchSession(session.id),
          estimate: null,
        }),
      },
    });
    await notifyAdminsOfBatchQuoteSubmitted(session.id, params.clerkUserId);

    return {
      ok: true,
      replayed: false,
      batchSessionId: session.id,
      message: pricesChanged
        ? "Prices were checked again. The list was sent to staff for an estimate."
        : "List sent to staff for an estimate.",
    };
  } catch (error) {
    if (!committed) {
      if (createdRequestIds.length > 0) {
        await db.delete(itemRequests).where(inArray(itemRequests.id, createdRequestIds));
      }
      if (sessionId) {
        await db.delete(batchQuoteSessions).where(eq(batchQuoteSessions.id, sessionId));
      }
      if (quoteId) {
        await db.delete(shoppingListQuotes).where(eq(shoppingListQuotes.id, quoteId));
      }
      await db
        .update(budgetBarrelDrafts)
        .set({
          status: "open",
          idempotencyKey: null,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(budgetBarrelDrafts.id, owned.id),
            eq(budgetBarrelDrafts.clerkUserId, params.clerkUserId),
            eq(budgetBarrelDrafts.status, "submitting"),
          ),
        );
    }
    const message = error instanceof Error ? error.message : "Could not submit this list.";
    return { ok: false, code: "invalid", message };
  }
}
