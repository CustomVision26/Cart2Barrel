"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import {
  itemRequestLineSnapshots,
  orderItemProductReturnRequests,
  orderItems,
  orders,
} from "@/db/schema";
import { getItemRequestById } from "@/data/item-requests";
import { lineSnapshotPayloadFromItemRequest } from "@/data/item-request-line-snapshots";
import { orderItemFulfillmentCoreSelect, orderListSelect } from "@/data/order-list-select";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import { isMissingOrderItemProductReturnRequestsTableError } from "@/lib/db-column-missing";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  buildProductReturnTrackingAuditMemo,
  productReturnTrackingHumanNote,
} from "@/lib/product-return-tracking-memo";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { recordProductReturnFulfilledActivity } from "@/data/user-status-update-events";
import { safeCurrentUser } from "@/lib/safe-current-user";
import { adminFulfillProductReturnRequestSchema } from "@/lib/validations/product-return-request";

export type AdminFulfillProductReturnRequestState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function adminFulfillProductReturnRequestAction(
  raw: unknown,
): Promise<AdminFulfillProductReturnRequestState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = adminFulfillProductReturnRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const first =
      parsed.error.flatten().fieldErrors.trackingUrl?.[0] ??
      parsed.error.flatten().fieldErrors.retailerTrackingCompany?.[0] ??
      parsed.error.flatten().fieldErrors.retailerTrackingNumber?.[0] ??
      parsed.error.flatten().fieldErrors.orderItemId?.[0];
    return { ok: false, message: first ?? "Invalid return fulfillment data." };
  }

  const db = getDb();
  const { orderItemId, trackingUrl, retailerTrackingCompany, retailerTrackingNumber } =
    parsed.data;

  const [row] = await db
    .select({
      orderItem: orderItemFulfillmentCoreSelect,
      order: orderListSelect,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orderItems.id, orderItemId))
    .limit(1);

  if (!row || row.order.status !== "paid") {
    return { ok: false, message: "Order line not found." };
  }

  let returnRequest;
  try {
    const [rr] = await db
      .select()
      .from(orderItemProductReturnRequests)
      .where(
        and(
          eq(orderItemProductReturnRequests.orderItemId, orderItemId),
          eq(orderItemProductReturnRequests.status, "submitted"),
        )!,
      )
      .limit(1);
    returnRequest = rr;
  } catch (e) {
    if (isMissingOrderItemProductReturnRequestsTableError(e)) {
      return {
        ok: false,
        message:
          "Return requests table is missing — run npm run db:push (migration 0050).",
      };
    }
    throw e;
  }

  if (!returnRequest) {
    return {
      ok: false,
      message: "No pending product return request for this line.",
    };
  }

  const effective = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order,
  );
  if (effective === "refunded") {
    return { ok: false, message: "This line was refunded." };
  }

  let refunded = 0;
  try {
    const refundedMap = await sumRefundedCentsByOrderItemIds([orderItemId]);
    refunded = refundedMap.get(orderItemId) ?? 0;
  } catch {
    refunded = 0;
  }
  if (refunded >= row.orderItem.price) {
    return { ok: false, message: "This line was fully refunded." };
  }

  const url = trackingUrl ?? null;
  const company = retailerTrackingCompany ?? null;
  const number = retailerTrackingNumber ?? null;
  const now = new Date().toISOString();

  await db
    .update(orderItems)
    .set({
      companyPurchaseTrackingUrl: url,
      companyPurchaseRetailerTrackingCompany: company,
      companyPurchaseRetailerTrackingNumber: number,
      fulfillmentStatus: "product_return_awaiting_delivery",
    })
    .where(eq(orderItems.id, orderItemId));

  await db
    .update(orderItemProductReturnRequests)
    .set({
      status: "fulfilled",
      fulfilledAt: now,
      fulfilledByClerkUserId: cu.user.id,
      updatedAt: now,
    })
    .where(eq(orderItemProductReturnRequests.id, returnRequest.id));

  const req = await getItemRequestById(row.orderItem.itemRequestId);
  if (req) {
    const payload = lineSnapshotPayloadFromItemRequest(req);
    const note = productReturnTrackingHumanNote({
      trackingUrl: url,
      retailerTrackingCompany: company,
      retailerTrackingNumber: number,
    });
    const auditMemo = buildProductReturnTrackingAuditMemo({
      orderItemId,
      trackingUrl: url ?? undefined,
      retailerTrackingCompany: company ?? undefined,
      retailerTrackingNumber: number ?? undefined,
    });
    try {
      await db.insert(itemRequestLineSnapshots).values({
        itemRequestId: row.orderItem.itemRequestId,
        phase: "product_return_tracking_saved",
        itemQuoteId: null,
        batchQuoteSessionId: null,
        auditMemo,
        productUrl: payload.productUrl,
        productName: payload.productName,
        productSize: payload.productSize,
        productColor: payload.productColor,
        quantity: payload.quantity,
        note,
        productImageUrl: payload.productImageUrl,
        siteName: payload.siteName,
      });
    } catch {
      /* phase enum may lag */
    }
  }

  await recordProductReturnFulfilledActivity({
    clerkUserId: row.order.clerkUserId,
    orderId: row.order.id,
    orderItemId: row.orderItem.id,
    productName: req?.productName ?? null,
  });

  revalidatePath("/admin/orders");
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/dashboard/orders");
  revalidateDashboardAddItem();

  return {
    ok: true,
    message:
      returnRequest.desiredOutcome === "money_back" ?
        "Return tracking saved. Status updated to Product Returned: awaiting refund."
      : "Return tracking saved. Customer status updated to returned: awaiting delivery.",
  };
}
