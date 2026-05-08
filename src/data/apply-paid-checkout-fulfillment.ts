import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { orderItems } from "@/db/schema";
import {
  combinedErrorText,
  isUndefinedColumnError,
} from "@/lib/db-column-missing";
import {
  getLatestQuoteForItemRequest,
  insertCheckoutTimelineQuote,
} from "@/data/item-quotes";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import { getItemRequestById } from "@/data/item-requests";
import { ITEM_QUOTE_CHECKOUT_SNAPSHOT_PAID } from "@/lib/checkout-snapshot-kind";
import { formatUsd } from "@/lib/admin-markup";

function snapshotNoteWithPaidLine(
  reqNote: string | null | undefined,
  linePriceCents: number
): string | null {
  const paidLine = `Checkout paid: ${formatUsd(linePriceCents)} charged for this line.`;
  const trimmed = reqNote?.trim();
  if (trimmed) return `${trimmed}\n\n${paidLine}`;
  return paidLine;
}

/**
 * After Stripe marks an order paid: advance line fulfillment and record timeline
 * quotes + audit snapshots for ops and the customer product history.
 */
export async function applyPaidCheckoutFulfillmentForOrder(
  orderId: string
): Promise<void> {
  const db = getDb();
  try {
    await db
      .update(orderItems)
      .set({ fulfillmentStatus: "paid_pending_company_purchase" })
      .where(eq(orderItems.orderId, orderId));
  } catch (e) {
    const text = combinedErrorText(e).toLowerCase();
    const likelyMigration =
      isUndefinedColumnError(e, "fulfillment_status") ||
      (text.includes("order_item_fulfillment_status") &&
        text.includes("invalid input value"));
    if (likelyMigration) {
      throw new Error(
        "Your database is missing the order line fulfillment schema from migration 0009 (order_items.fulfillment_status). From the project root, run `npm run db:migrate` with DATABASE_URL set, then complete checkout again or re-open the success page.",
        { cause: e }
      );
    }
    throw e;
  }

  const lines = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const line of lines) {
    const req = await getItemRequestById(line.itemRequestId);
    if (!req) continue;

    const quote = await getLatestQuoteForItemRequest(line.itemRequestId);
    let itemQuoteId: string | null = null;
    if (quote) {
      const timelineQuote = await insertCheckoutTimelineQuote({
        itemRequestId: line.itemRequestId,
        sourceQuote: quote,
        checkoutSnapshotKind: ITEM_QUOTE_CHECKOUT_SNAPSHOT_PAID,
      });
      itemQuoteId = timelineQuote.id;
    }

    const linePayload = lineSnapshotPayloadFromItemRequest(req);
    await insertItemRequestLineSnapshot({
      itemRequestId: line.itemRequestId,
      phase: "checkout_paid_pending_delivery",
      itemQuoteId,
      line: {
        ...linePayload,
        note: snapshotNoteWithPaidLine(linePayload.note, line.price),
      },
    });
  }
}
