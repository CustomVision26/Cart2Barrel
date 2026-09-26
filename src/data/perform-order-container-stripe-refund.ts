import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { orderContainerItems, orders, profiles } from "@/db/schema";
import { insertOrderContainerRefundRow } from "@/data/order-container-refunds";
import { sendOrderLineRefundEmail } from "@/lib/email/send-order-line-refund-email";
import {
  formatStripeApiErrorForUi,
  getAppOrigin,
  getPaymentIntentRefundableCents,
  getStripeServer,
} from "@/lib/stripe-server";
import type { OrderContainerRefundChargeValue } from "@/lib/validations/order-container-refund-request";

export type PerformOrderContainerStripeRefundOutcome =
  | {
      ok: true;
      stripeRefundId: string;
      refundedCents: number;
      orderId: string;
    }
  | { ok: false; message: string };

export async function performOrderContainerStripeRefund(opts: {
  orderContainerItemId: string;
  chargeTarget: OrderContainerRefundChargeValue;
  amountCentsRequested: number;
  chargePricedCents: number;
  alreadyRefundedCents: number;
  internalReasonForDb: string | null;
  stripeReason: "duplicate" | "fraudulent" | "requested_by_customer";
  createdByClerkUserId: string;
}): Promise<PerformOrderContainerStripeRefundOutcome> {
  const db = getDb();
  const [row] = await db
    .select({
      container: orderContainerItems,
      order: orders,
      customerEmail: profiles.email,
      customerFullName: profiles.fullName,
    })
    .from(orderContainerItems)
    .innerJoin(orders, eq(orderContainerItems.orderId, orders.id))
    .innerJoin(profiles, eq(orders.clerkUserId, profiles.clerkUserId))
    .where(eq(orderContainerItems.id, opts.orderContainerItemId))
    .limit(1);

  if (!row || row.order.status !== "paid" || !row.order.stripePaymentIntentId) {
    return {
      ok: false,
      message: "Container line not found or payment is not available to refund.",
    };
  }

  const lineRemaining = opts.chargePricedCents - opts.alreadyRefundedCents;
  if (lineRemaining <= 0) {
    return { ok: false, message: "This charge has already been fully refunded." };
  }

  const piRemaining = await getPaymentIntentRefundableCents(
    row.order.stripePaymentIntentId,
  );
  if (piRemaining === null || piRemaining <= 0) {
    return {
      ok: false,
      message:
        "Could not read the Stripe charge for this payment, or nothing is left to refund.",
    };
  }

  const refundCents = Math.min(
    opts.amountCentsRequested,
    lineRemaining,
    piRemaining,
  );
  if (refundCents < 1) {
    return {
      ok: false,
      message: "Refund amount is too small or nothing is refundable.",
    };
  }

  const stripe = getStripeServer();
  let stripeRefundId: string;
  try {
    const refund = await stripe.refunds.create({
      payment_intent: row.order.stripePaymentIntentId,
      amount: refundCents,
      reason: opts.stripeReason,
      metadata: {
        order_id: row.order.id,
        order_container_item_id: row.container.id,
        charge_target: opts.chargeTarget,
      },
    });
    stripeRefundId = refund.id;
  } catch (e) {
    const detail = formatStripeApiErrorForUi(e);
    return {
      ok: false,
      message:
        detail ?
          `Stripe could not process the refund: ${detail}`
        : "Stripe could not process the refund.",
    };
  }

  await insertOrderContainerRefundRow({
    orderContainerItemId: row.container.id,
    chargeTarget: opts.chargeTarget,
    amountCents: refundCents,
    stripeRefundId,
    reason: opts.internalReasonForDb?.trim() || null,
    createdByClerkUserId: opts.createdByClerkUserId,
  });

  const shopperEmail = row.customerEmail?.trim();
  if (shopperEmail) {
    const origin = getAppOrigin();
    const label =
      opts.chargeTarget === "packing_fee"
        ? `Packing fee — ${row.container.nameSnapshot}`
        : row.container.nameSnapshot;
    const emailed = await sendOrderLineRefundEmail({
      origin,
      customerEmail: shopperEmail,
      customerName: row.customerFullName,
      orderId: row.order.id,
      productName: label,
      refundCents,
      stripeRefundId,
    });
    if (!emailed.ok) {
      console.warn(
        "[Amani Cart2Barrel] Container refund processed but customer email failed:",
        emailed.error,
      );
    }
  }

  return {
    ok: true,
    stripeRefundId,
    refundedCents: refundCents,
    orderId: row.order.id,
  };
}

/** One Stripe refund covering one or more container/packing allocations. */
export async function performOrderContainerLineStripeRefund(opts: {
  orderContainerItemId: string;
  allocations: Array<{
    chargeTarget: OrderContainerRefundChargeValue;
    amountCents: number;
  }>;
  internalReasonForDb: string | null;
  stripeReason: "duplicate" | "fraudulent" | "requested_by_customer";
  createdByClerkUserId: string;
}): Promise<PerformOrderContainerStripeRefundOutcome> {
  const allocations = opts.allocations.filter((a) => a.amountCents >= 1);
  const totalCents = allocations.reduce((sum, a) => sum + a.amountCents, 0);
  if (allocations.length === 0 || totalCents < 1) {
    return { ok: false, message: "Nothing is left to refund on this container." };
  }

  const db = getDb();
  const [row] = await db
    .select({
      container: orderContainerItems,
      order: orders,
      customerEmail: profiles.email,
      customerFullName: profiles.fullName,
    })
    .from(orderContainerItems)
    .innerJoin(orders, eq(orderContainerItems.orderId, orders.id))
    .innerJoin(profiles, eq(orders.clerkUserId, profiles.clerkUserId))
    .where(eq(orderContainerItems.id, opts.orderContainerItemId))
    .limit(1);

  if (!row || row.order.status !== "paid" || !row.order.stripePaymentIntentId) {
    return {
      ok: false,
      message: "Container line not found or payment is not available to refund.",
    };
  }

  const piRemaining = await getPaymentIntentRefundableCents(
    row.order.stripePaymentIntentId,
  );
  if (piRemaining === null || piRemaining <= 0) {
    return {
      ok: false,
      message:
        "Could not read the Stripe charge for this payment, or nothing is left to refund.",
    };
  }

  const refundCents = Math.min(totalCents, piRemaining);
  if (refundCents < 1) {
    return {
      ok: false,
      message: "Refund amount is too small or nothing is refundable.",
    };
  }

  const stripe = getStripeServer();
  let stripeRefundId: string;
  try {
    const refund = await stripe.refunds.create({
      payment_intent: row.order.stripePaymentIntentId,
      amount: refundCents,
      reason: opts.stripeReason,
      metadata: {
        order_id: row.order.id,
        order_container_item_id: row.container.id,
        charge_targets: allocations.map((a) => a.chargeTarget).join(","),
      },
    });
    stripeRefundId = refund.id;
  } catch (e) {
    const detail = formatStripeApiErrorForUi(e);
    return {
      ok: false,
      message:
        detail ?
          `Stripe could not process the refund: ${detail}`
        : "Stripe could not process the refund.",
    };
  }

  let remainingToAllocate = refundCents;
  for (const allocation of allocations) {
    const amountCents = Math.min(allocation.amountCents, remainingToAllocate);
    if (amountCents < 1) continue;
    remainingToAllocate -= amountCents;
    await insertOrderContainerRefundRow({
      orderContainerItemId: row.container.id,
      chargeTarget: allocation.chargeTarget,
      amountCents,
      stripeRefundId,
      reason: opts.internalReasonForDb?.trim() || null,
      createdByClerkUserId: opts.createdByClerkUserId,
    });
  }

  const shopperEmail = row.customerEmail?.trim();
  if (shopperEmail) {
    const origin = getAppOrigin();
    const emailed = await sendOrderLineRefundEmail({
      origin,
      customerEmail: shopperEmail,
      customerName: row.customerFullName,
      orderId: row.order.id,
      productName: `${row.container.nameSnapshot}${
        allocations.some((a) => a.chargeTarget === "packing_fee")
          ? " and packing fee"
          : ""
      }`,
      refundCents,
      stripeRefundId,
    });
    if (!emailed.ok) {
      console.warn(
        "[Amani Cart2Barrel] Container refund processed but customer email failed:",
        emailed.error,
      );
    }
  }

  return {
    ok: true,
    stripeRefundId,
    refundedCents: refundCents,
    orderId: row.order.id,
  };
}
