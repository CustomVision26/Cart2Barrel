"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import {
  orderItemRefundRequests,
  orderItems,
  orders,
} from "@/db/schema";
import { performOrderItemStripeRefund } from "@/data/perform-order-item-stripe-refund";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import { refundableLineRemainderCents } from "@/lib/order-line-refund-eligibility";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { approveRefundRequestSchema } from "@/lib/validations/order-item-refund-request";
import { safeCurrentUser } from "@/lib/safe-current-user";

export type ApproveRefundRequestState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function approveOrderItemRefundRequestAction(
  raw: unknown,
): Promise<ApproveRefundRequestState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = approveRefundRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid approve-refund payload." };
  }

  const db = getDb();
  const [row] = await db
    .select({
      req: orderItemRefundRequests,
      orderItem: orderItems,
      order: orders,
    })
    .from(orderItemRefundRequests)
    .innerJoin(orderItems, eq(orderItemRefundRequests.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orderItemRefundRequests.id, parsed.data.refundRequestId))
    .limit(1);

  if (!row || row.req.status !== "pending_approval") {
    return {
      ok: false,
      message: "Refund request not found or no longer awaiting approval.",
    };
  }

  if (row.order.status !== "paid" || !row.order.stripePaymentIntentId) {
    return {
      ok: false,
      message: "The order payment is unavailable to refund.",
    };
  }

  const refundedMap = await sumRefundedCentsByOrderItemIds([
    row.orderItem.id,
  ]);
  const alreadyRefunded = refundedMap.get(row.orderItem.id) ?? 0;
  const lineRem = refundableLineRemainderCents(row.orderItem.price, alreadyRefunded);
  const customerCeiling =
    row.req.requestedAmountCents == null ?
      lineRem
    : Math.min(row.req.requestedAmountCents, lineRem);

  if (customerCeiling < 1 || lineRem < 1) {
    return { ok: false, message: "Nothing is left to approve for this line." };
  }

  const approved = Math.min(
    parsed.data.approvedAmountCents,
    customerCeiling,
    lineRem,
  );
  if (approved < 1) {
    return {
      ok: false,
      message: "Approved amount clears to zero after caps. Increase the amount.",
    };
  }

  const internalNote = [
    `Approved shopper refund request ${row.req.id}.`,
    `Reason kind: ${row.req.reasonKind}.`,
    `Shopper narrative: ${row.req.details.replace(/\s+/g, " ").trim().slice(0, 500)}`,
  ].join(" ");

  const result = await performOrderItemStripeRefund({
    orderItemId: row.orderItem.id,
    amountCentsRequested: approved,
    internalReasonForDb: internalNote,
    stripeReason: "requested_by_customer",
    createdByClerkUserId: cu.user.id,
  });

  if (!result.ok) {
    return result;
  }

  await db
    .update(orderItemRefundRequests)
    .set({
      status: "fulfilled",
      reviewedAt: new Date().toISOString(),
      reviewedByClerkUserId: cu.user.id,
      fulfilledStripeRefundId: result.stripeRefundId,
      rejectionNote: null,
    })
    .where(eq(orderItemRefundRequests.id, row.req.id));

  revalidatePath("/admin/overview");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/packages");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: `Stripe refund issued for ${result.refundedCents}¢.${result.lineFullyRefunded ? " Line is fully refunded." : ""}`,
  };
}
