import { and, desc, eq } from "drizzle-orm";

import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import {
  getLatestQuoteForItemRequest,
  restoreLatestVoidedOperationalQuoteForItemRequest,
} from "@/data/item-quotes";
import { insertOutsidePurchaseLifecycleSnapshot } from "@/data/outside-purchase-lifecycle-snapshot";
import { getItemRequestById } from "@/data/item-requests";
import { getDb } from "@/db";
import type { ItemRequest } from "@/db/schema";
import { itemRequests } from "@/db/schema";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import {
  ITEM_QUOTE_VOID_REASON_CUSTOMER_REVISION,
  ITEM_QUOTE_VOID_REASON_STAFF_OUT_OF_STOCK,
} from "@/lib/item-quote-void-reason";

async function resolveReinstateStatus(
  row: ItemRequest,
): Promise<ItemRequest["status"]> {
  const outsidePurchase = isOutsidePurchaseRequest(row);

  const restored = await restoreLatestVoidedOperationalQuoteForItemRequest(
    row.id,
    [
      ITEM_QUOTE_VOID_REASON_CUSTOMER_REVISION,
      ITEM_QUOTE_VOID_REASON_STAFF_OUT_OF_STOCK,
    ],
  );
  if (restored) {
    if (outsidePurchase) return "quoted";
    return restored.voidReason === ITEM_QUOTE_VOID_REASON_STAFF_OUT_OF_STOCK
      ? "out_of_stock"
      : "quoted";
  }

  const active = await getLatestQuoteForItemRequest(row.id);
  if (active) {
    return outsidePurchase ? "quoted" : "out_of_stock";
  }

  return "pending";
}

/**
 * Moves owned `withdrawn` rows back to Active products (`pending`, `quoted`, or
 * `out_of_stock`) and restores the latest voided estimate when the customer had removed it.
 */
export async function reinstateCustomerWithdrawnItemRequestsForOwner(params: {
  clerkUserId: string;
  itemRequestIds: string[];
}): Promise<{ reinstatedIds: string[] }> {
  const { clerkUserId } = params;
  const ids = [...new Set(params.itemRequestIds)];
  if (ids.length === 0) {
    throw new Error("Nothing to reinstate.");
  }

  const db = getDb();
  const reinstatedIds: string[] = [];

  for (const id of ids) {
    const row = await getItemRequestById(id);
    if (!row || row.clerkUserId !== clerkUserId) {
      throw new Error("One or more products could not be found.");
    }

    if (row.status !== "withdrawn") {
      throw new Error(
        "Only products you removed from Active can be reinstated. Refresh and try again.",
      );
    }

    if (row.batchQuoteSessionId) {
      throw new Error(
        "This product was part of a batch quote. Reinstating it here is not supported — submit a new request if needed.",
      );
    }

    const nextStatus = await resolveReinstateStatus(row);

    const updated = await db
      .update(itemRequests)
      .set({
        status: nextStatus,
        batchQuoteSessionId: null,
      })
      .where(
        and(
          eq(itemRequests.id, id),
          eq(itemRequests.clerkUserId, clerkUserId),
          eq(itemRequests.status, "withdrawn"),
        ),
      )
      .returning({ id: itemRequests.id });

    if (updated.length === 0) {
      throw new Error("Could not reinstate one or more products. Refresh and try again.");
    }

    const after = await getItemRequestById(id);
    if (after) {
      if (isOutsidePurchaseRequest(after)) {
        const paymentNote = after.outsidePurchasePaymentPromptedAt
          ? "Payment due · prompted — customer has not paid yet."
          : "Payment due — staff has not recorded a payment prompt yet.";
        await insertOutsidePurchaseLifecycleSnapshot({
          request: after,
          phase: "outside_purchase_reinstated_to_active",
          auditMemo: `Customer reinstated this outside purchase to Active from Product history. ${paymentNote}`,
        });
      } else {
        await insertItemRequestLineSnapshot({
          itemRequestId: id,
          phase: "customer_line_edit",
          auditMemo: "Customer reinstated this product to Active from Product history.",
          line: lineSnapshotPayloadFromItemRequest(after),
        });
      }
    }

    reinstatedIds.push(id);
  }

  return { reinstatedIds };
}
