"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import {
  itemRequests,
  orderItems,
  orders,
  profiles,
} from "@/db/schema";
import { orderListSelect } from "@/data/order-list-select";
import {
  insertOrderItemRefundRow,
  sumRefundedCentsByOrderItemIds,
} from "@/data/order-item-refunds";
import { sendOrderLineRefundEmail } from "@/lib/email/send-order-line-refund-email";
import { formatStripeApiErrorForUi, getAppOrigin, getPaymentIntentRefundableCents, getStripeServer } from "@/lib/stripe-server";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { refundOrderLineSchema } from "@/lib/validations/admin-order-item";
import { safeCurrentUser } from "@/lib/safe-current-user";

export type RefundOrderLineState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function refundOrderLineAction(
  raw: unknown
): Promise<RefundOrderLineState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = refundOrderLineSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid refund request." };
  }

  const db = getDb();
  const [row] = await db
    .select({
      orderItem: orderItems,
      order: orderListSelect,
      request: itemRequests,
      customerEmail: profiles.email,
      customerFullName: profiles.fullName,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .innerJoin(profiles, eq(orders.clerkUserId, profiles.clerkUserId))
    .where(eq(orderItems.id, parsed.data.orderItemId))
    .limit(1);

  if (!row || row.order.status !== "paid" || !row.order.stripePaymentIntentId) {
    return {
      ok: false,
      message: "Order line not found or payment is not available to refund.",
    };
  }

  const refundedMap = await sumRefundedCentsByOrderItemIds([
    row.orderItem.id,
  ]);
  const alreadyRefunded = refundedMap.get(row.orderItem.id) ?? 0;
  const lineRemaining = row.orderItem.price - alreadyRefunded;
  if (lineRemaining <= 0) {
    return { ok: false, message: "This line has already been fully refunded." };
  }

  const piRemaining = await getPaymentIntentRefundableCents(
    row.order.stripePaymentIntentId
  );
  if (piRemaining === null || piRemaining <= 0) {
    return {
      ok: false,
      message:
        "Could not read the Stripe charge for this payment, or nothing is left to refund.",
    };
  }

  const cap = Math.min(lineRemaining, piRemaining);
  const refundCents = Math.min(parsed.data.amountCents, cap);

  if (refundCents < 1) {
    return { ok: false, message: "Refund amount is too small or nothing is refundable." };
  }

  const stripe = getStripeServer();
  let stripeRefundId: string;
  try {
    const refund = await stripe.refunds.create({
      payment_intent: row.order.stripePaymentIntentId,
      amount: refundCents,
      reason: "requested_by_customer",
      metadata: {
        order_id: row.order.id,
        order_item_id: row.orderItem.id,
      },
    });
    stripeRefundId = refund.id;
  } catch (e) {
    const detail = formatStripeApiErrorForUi(e);
    return {
      ok: false,
      message: detail
        ? `Stripe could not process the refund: ${detail}`
        : "Stripe could not process the refund.",
    };
  }

  await insertOrderItemRefundRow({
    orderItemId: row.orderItem.id,
    amountCents: refundCents,
    stripeRefundId,
    reason: parsed.data.reason?.trim() || null,
    createdByClerkUserId: cu.user.id,
  });

  const newTotalRefunded = alreadyRefunded + refundCents;
  if (newTotalRefunded >= row.orderItem.price) {
    await db
      .update(orderItems)
      .set({ fulfillmentStatus: "refunded" })
      .where(eq(orderItems.id, row.orderItem.id));
  }

  const shopperEmail = row.customerEmail?.trim();
  if (shopperEmail) {
    const origin = getAppOrigin();
    const emailed = await sendOrderLineRefundEmail({
      origin,
      customerEmail: shopperEmail,
      customerName: row.customerFullName,
      orderId: row.order.id,
      productName: row.request.productName,
      refundCents,
      stripeRefundId,
    });
    if (!emailed.ok) {
      console.warn("[Cart2Barrel] Refund processed but customer email failed:", emailed.error);
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");

  const clamped =
    parsed.data.amountCents > refundCents
      ? ` Capped from ${parsed.data.amountCents}¢ to maximum ${refundCents}¢. `
      : " ";

  const msg =
    newTotalRefunded >= row.orderItem.price
      ? `Refunded ${refundCents} cents; line is now fully refunded.${clamped}`
      : `Refunded ${refundCents} cents. Remaining on this line: ${row.orderItem.price - newTotalRefunded} cents.${clamped}`;

  return { ok: true, message: msg.trim() };
}
