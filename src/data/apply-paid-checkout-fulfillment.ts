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
import { ensureBarrelsProvisionedForPaidOrder } from "@/data/ensure-paid-order-barrels";
import { ensureInboundPackageForOrderItem } from "@/data/ensure-inbound-package-for-order-item";
import { ensurePaidOutsidePurchaseFulfillmentEnums } from "@/data/ensure-paid-outside-purchase-fulfillment-enum";
import { insertOutsidePurchaseLifecycleSnapshot } from "@/data/outside-purchase-lifecycle-snapshot";
import { getItemRequestById } from "@/data/item-requests";
import { ITEM_QUOTE_CHECKOUT_SNAPSHOT_PAID } from "@/lib/checkout-snapshot-kind";
import { formatUsd } from "@/lib/admin-markup";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL } from "@/lib/outside-purchase-paid-status";

function snapshotNoteWithPaidLine(
  reqNote: string | null | undefined,
  linePriceCents: number,
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
  orderId: string,
): Promise<void> {
  await ensurePaidOutsidePurchaseFulfillmentEnums();

  const db = getDb();
  const lines = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const now = new Date().toISOString();

  for (const line of lines) {
    const req = await getItemRequestById(line.itemRequestId);
    if (!req) continue;

    const outsidePurchase = isOutsidePurchaseRequest(req);
    const fulfillmentStatus = outsidePurchase
      ? ("paid_outside_purchase_service_fee" as const)
      : ("paid_pending_company_purchase" as const);

    try {
      await db
        .update(orderItems)
        .set({ fulfillmentStatus })
        .where(eq(orderItems.id, line.id));
    } catch (e) {
      const text = combinedErrorText(e).toLowerCase();
      const likelyMigration =
        isUndefinedColumnError(e, "fulfillment_status") ||
        (text.includes("order_item_fulfillment_status") &&
          text.includes("invalid input value"));
      if (likelyMigration) {
        throw new Error(
          "Your database is missing the order line fulfillment schema from migration 0009 (order_items.fulfillment_status). From the project root, run `npm run db:migrate` with DATABASE_URL set, then complete checkout again or re-open the success page.",
          { cause: e },
        );
      }
      throw e;
    }

    if (outsidePurchase) {
      await ensureInboundPackageForOrderItem(line.id, now);
    }

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
    const paidNote = snapshotNoteWithPaidLine(linePayload.note, line.price);

    if (outsidePurchase) {
      await insertOutsidePurchaseLifecycleSnapshot({
        request: req,
        phase: "outside_purchase_checkout_paid",
        itemQuoteId,
        auditMemo: `${PAID_OUTSIDE_PURCHASE_SERVICE_FEE_LABEL} · ${formatUsd(line.price)} service & handling paid at checkout.`,
      });
    } else {
      await insertItemRequestLineSnapshot({
        itemRequestId: line.itemRequestId,
        phase: "checkout_paid_pending_delivery",
        itemQuoteId,
        line: {
          ...linePayload,
          note: paidNote,
        },
      });
    }
  }

  await ensureBarrelsProvisionedForPaidOrder(orderId);
}
