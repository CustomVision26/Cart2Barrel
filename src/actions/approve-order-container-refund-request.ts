"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import {
  orderContainerItems,
  orderContainerRefundRequests,
  orders,
} from "@/db/schema";
import { chargeAmountCentsForLine } from "@/data/container-line-refund-state";
import { listOrderContainerItemsByOrderIds } from "@/data/order-container-admin";
import {
  containerChargeRefundKey,
  sumContainerChargeRefundedCents,
} from "@/data/order-container-refunds";
import { performOrderContainerLineStripeRefund } from "@/data/perform-order-container-stripe-refund";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { refundableLineRemainderCents } from "@/lib/order-line-refund-eligibility";
import { safeCurrentUser } from "@/lib/safe-current-user";
import {
  approveOrderContainerLineRefundSchema,
} from "@/lib/validations/order-container-refund-request";
import type { OrderContainerRefundChargeValue } from "@/lib/validations/order-container-refund-request";

export type ApproveContainerRefundRequestState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function approveOrderContainerLineRefundAction(
  raw: unknown,
): Promise<ApproveContainerRefundRequestState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = approveOrderContainerLineRefundSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid approve-refund payload." };
  }

  const db = getDb();
  const pending = await db
    .select({
      req: orderContainerRefundRequests,
      container: orderContainerItems,
      order: orders,
    })
    .from(orderContainerRefundRequests)
    .innerJoin(
      orderContainerItems,
      eq(orderContainerRefundRequests.orderContainerItemId, orderContainerItems.id),
    )
    .innerJoin(orders, eq(orderContainerItems.orderId, orders.id))
    .where(
      and(
        eq(
          orderContainerRefundRequests.orderContainerItemId,
          parsed.data.orderContainerItemId,
        ),
        eq(orderContainerRefundRequests.status, "pending_approval"),
      ),
    );

  if (pending.length === 0) {
    return {
      ok: false,
      message: "Refund request not found or no longer awaiting approval.",
    };
  }

  const first = pending[0]!;
  const pricedLine =
    (await listOrderContainerItemsByOrderIds([first.order.id]))
      .get(first.order.id)
      ?.find((l) => l.id === first.container.id) ?? {
      id: first.container.id,
      orderId: first.container.orderId,
      nameSnapshot: first.container.nameSnapshot,
      sizeSnapshot: first.container.sizeSnapshot,
      kindSnapshot: first.container.kindSnapshot,
      quantity: first.container.quantity,
      unitPriceCents: first.container.unitPriceCents,
      lineTotalCents: first.container.lineTotalCents,
      packagingFeeCents: first.container.packagingFeeCents,
      packagingPerUnitCents: first.container.packagingPerUnitCents,
    };

  const refundedMap = await sumContainerChargeRefundedCents([first.container.id]);
  const allocations: Array<{
    chargeTarget: OrderContainerRefundChargeValue;
    amountCents: number;
    requestId: string;
  }> = [];

  for (const row of pending) {
    const chargeTarget = row.req.chargeTarget as OrderContainerRefundChargeValue;
    const pricedCents = chargeAmountCentsForLine(pricedLine, chargeTarget);
    const alreadyRefunded =
      refundedMap.get(
        containerChargeRefundKey(row.container.id, chargeTarget),
      ) ?? 0;
    const lineRem = refundableLineRemainderCents(pricedCents, alreadyRefunded);
    const customerCeiling =
      row.req.requestedAmountCents == null
        ? lineRem
        : Math.min(row.req.requestedAmountCents, lineRem);
    if (customerCeiling < 1) continue;
    allocations.push({
      chargeTarget,
      amountCents: customerCeiling,
      requestId: row.req.id,
    });
  }

  if (allocations.length === 0) {
    return { ok: false, message: "Nothing is left to approve for this container." };
  }

  const internalNote = [
    `Approved shopper container-line refund (${allocations
      .map((a) => a.chargeTarget)
      .join(" + ")}).`,
    `Reason kind: ${first.req.reasonKind}.`,
    `Shopper narrative: ${first.req.details.replace(/\s+/g, " ").trim().slice(0, 500)}`,
  ].join(" ");

  const result = await performOrderContainerLineStripeRefund({
    orderContainerItemId: first.container.id,
    allocations: allocations.map((a) => ({
      chargeTarget: a.chargeTarget,
      amountCents: a.amountCents,
    })),
    internalReasonForDb: internalNote,
    stripeReason: "requested_by_customer",
    createdByClerkUserId: cu.user.id,
  });

  if (!result.ok) return result;

  await db
    .update(orderContainerRefundRequests)
    .set({
      status: "fulfilled",
      reviewedAt: new Date().toISOString(),
      reviewedByClerkUserId: cu.user.id,
      fulfilledStripeRefundId: result.stripeRefundId,
      rejectionNote: null,
    })
    .where(
      inArray(
        orderContainerRefundRequests.id,
        allocations.map((a) => a.requestId),
      ),
    );

  revalidatePath("/admin/overview");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders-history");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/orders-history");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: `Stripe refund issued for ${result.refundedCents}¢ covering container and packing on this order.`,
  };
}
