"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@clerk/nextjs/server";

import { getDb } from "@/db";
import { orderContainerItems, orderContainerRefundRequests, orders } from "@/db/schema";
import { chargeAmountCentsForLine } from "@/data/container-line-refund-state";
import { listOrderContainerItemsByOrderIds } from "@/data/order-container-admin";
import { pendingContainerRefundRequestsByLineIds } from "@/data/order-container-refund-requests";
import {
  containerChargeRefundKey,
  sumContainerChargeRefundedCents,
} from "@/data/order-container-refunds";
import { isMissingOrderContainerRefundsTableError } from "@/lib/db-column-missing";
import { refundableLineRemainderCents } from "@/lib/order-line-refund-eligibility";
import { submitCustomerContainerRefundRequestSchema } from "@/lib/validations/order-container-refund-request";
import type { OrderContainerRefundChargeValue } from "@/lib/validations/order-container-refund-request";

export type SubmitCustomerContainerRefundRequestState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function submitCustomerContainerRefundRequestAction(
  raw: unknown,
): Promise<SubmitCustomerContainerRefundRequestState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to request a refund." };
  }

  const parsed = submitCustomerContainerRefundRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const first =
      parsed.error.flatten().fieldErrors.details?.[0] ??
      parsed.error.flatten().fieldErrors.orderContainerItemId?.[0] ??
      parsed.error.flatten().fieldErrors.reasonKind?.[0] ??
      parsed.error.flatten().fieldErrors.chargeTargets?.[0];
    return {
      ok: false,
      message:
        first ?? "We could not read this refund request. Check all fields.",
    };
  }

  const data = parsed.data;
  const db = getDb();
  const [scoped] = await db
    .select({
      container: orderContainerItems,
      order: orders,
    })
    .from(orderContainerItems)
    .innerJoin(orders, eq(orderContainerItems.orderId, orders.id))
    .where(
      and(
        eq(orderContainerItems.id, data.orderContainerItemId),
        eq(orders.clerkUserId, userId),
      ),
    )
    .limit(1);

  if (!scoped) {
    return { ok: false, message: "Shipping container line not found." };
  }
  if (scoped.order.status !== "paid") {
    return {
      ok: false,
      message: "Only paid orders can request a container refund.",
    };
  }

  const pricedLine =
    (
      await listOrderContainerItemsByOrderIds([scoped.order.id], {
        ownerClerkUserId: userId,
      })
    )
      .get(scoped.order.id)
      ?.find((l) => l.id === scoped.container.id) ?? {
      id: scoped.container.id,
      orderId: scoped.container.orderId,
      nameSnapshot: scoped.container.nameSnapshot,
      sizeSnapshot: scoped.container.sizeSnapshot,
      kindSnapshot: scoped.container.kindSnapshot,
      quantity: scoped.container.quantity,
      unitPriceCents: scoped.container.unitPriceCents,
      lineTotalCents: scoped.container.lineTotalCents,
      packagingFeeCents: scoped.container.packagingFeeCents,
      packagingPerUnitCents: scoped.container.packagingPerUnitCents,
    };

  const uniqueTargets = [...new Set(data.chargeTargets)];
  const refundedMap = await sumContainerChargeRefundedCents([scoped.container.id]);
  const existingPending = await pendingContainerRefundRequestsByLineIds([
    scoped.container.id,
  ]);

  const inserts: {
    orderContainerItemId: string;
    clerkUserId: string;
    chargeTarget: OrderContainerRefundChargeValue;
    reasonKind: typeof data.reasonKind;
    details: string;
    requestedAmountCents: null;
    status: "pending_approval";
  }[] = [];

  for (const chargeTarget of uniqueTargets) {
    const pricedCents = chargeAmountCentsForLine(pricedLine, chargeTarget);
    if (pricedCents < 1) continue;
    const refundedSoFar =
      refundedMap.get(
        containerChargeRefundKey(scoped.container.id, chargeTarget),
      ) ?? 0;
    const remainder = refundableLineRemainderCents(pricedCents, refundedSoFar);
    if (remainder < 1) continue;
    if (
      existingPending.has(
        containerChargeRefundKey(scoped.container.id, chargeTarget),
      )
    ) {
      return {
        ok: false,
        message:
          "A refund request is already awaiting staff review for this container.",
      };
    }
    inserts.push({
      orderContainerItemId: scoped.container.id,
      clerkUserId: userId,
      chargeTarget,
      reasonKind: data.reasonKind,
      details: data.details.trim(),
      requestedAmountCents: null,
      status: "pending_approval",
    });
  }

  if (inserts.length === 0) {
    return { ok: false, message: "Nothing is left to refund on this container." };
  }

  try {
    await db.insert(orderContainerRefundRequests).values(inserts);
  } catch (e) {
    if (isMissingOrderContainerRefundsTableError(e)) {
      return {
        ok: false,
        message:
          "Refund requests for containers are not available yet. Try again shortly.",
      };
    }
    console.error("[submitCustomerContainerRefundRequest]", e);
    return { ok: false, message: "Could not save your refund request. Try again." };
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/orders-history");
  revalidatePath("/dashboard");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders-history");
  revalidatePath("/admin/overview");

  return {
    ok: true,
    message:
      inserts.length > 1
        ? "Refund request submitted for the container and packing fee. Staff will review it."
        : "Refund request submitted. Staff will review it; this charge shows as awaiting approval.",
  };
}
