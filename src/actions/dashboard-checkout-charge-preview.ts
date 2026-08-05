"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  loadBatchCheckoutChargesPreview,
  loadLineCheckoutChargesPreview,
  loadOrderCheckoutChargesPreview,
  type CheckoutChargesPreview,
} from "@/data/dashboard-checkout-charge-preview";
import { sumPaidMerchandiseTopupAddOnCentsForOrderItems } from "@/data/merchandise-topup-cart";
import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { getClerkSessionGate } from "@/lib/clerk-session";

const orderScopeSchema = z.object({
  scope: z.literal("order"),
  orderId: z.string().uuid(),
});

const batchScopeSchema = z.object({
  scope: z.literal("batch"),
  orderId: z.string().uuid(),
  batchSessionId: z.string().uuid(),
});

const lineScopeSchema = z.object({
  scope: z.literal("line"),
  orderId: z.string().uuid(),
  orderItemId: z.string().uuid(),
});

const previewSchema = z.discriminatedUnion("scope", [
  orderScopeSchema,
  batchScopeSchema,
  lineScopeSchema,
]);

export type DashboardCheckoutChargePreviewInput = z.infer<typeof previewSchema>;

export type DashboardCheckoutChargePreviewResult =
  | { ok: false; message: string }
  | { ok: true; preview: CheckoutChargesPreview };

async function resolvePreviewOwnerClerkUserId(
  orderId: string,
  sessionUserId: string,
  isAdmin: boolean,
): Promise<{ ok: true; ownerClerkUserId: string } | { ok: false; message: string }> {
  const db = getDb();
  const [order] = await db
    .select({ clerkUserId: orders.clerkUserId })
    .from(orders)
    .where(
      isAdmin
        ? eq(orders.id, orderId)
        : and(eq(orders.id, orderId), eq(orders.clerkUserId, sessionUserId)),
    )
    .limit(1);

  if (!order) {
    return { ok: false, message: "Order not found." };
  }
  return { ok: true, ownerClerkUserId: order.clerkUserId };
}

export async function getDashboardCheckoutChargePreviewAction(
  input: DashboardCheckoutChargePreviewInput,
): Promise<DashboardCheckoutChargePreviewResult> {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid preview request." };
  }

  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }

  const owner = await resolvePreviewOwnerClerkUserId(
    parsed.data.orderId,
    gate.userId,
    gate.isAdmin,
  );
  if (!owner.ok) {
    return owner;
  }

  if (parsed.data.scope === "order") {
    return loadOrderCheckoutChargesPreview(
      owner.ownerClerkUserId,
      parsed.data.orderId,
    );
  }

  if (parsed.data.scope === "line") {
    return loadLineCheckoutChargesPreview(
      owner.ownerClerkUserId,
      parsed.data.orderId,
      parsed.data.orderItemId,
    );
  }

  return loadBatchCheckoutChargesPreview(
    owner.ownerClerkUserId,
    parsed.data.orderId,
    parsed.data.batchSessionId,
  );
}

const orderPaidTopupSchema = z.object({
  orderId: z.string().uuid(),
});

export type OrderPaidTopupAddOnTotalResult =
  | { ok: false; message: string }
  | { ok: true; paidTopupCents: number };

/**
 * Cumulative paid purchase-price top-ups for merchandise lines on an order
 * (batch siblings counted once). Admin or order owner.
 */
export async function getOrderPaidTopupAddOnTotalAction(
  input: z.infer<typeof orderPaidTopupSchema>,
): Promise<OrderPaidTopupAddOnTotalResult> {
  const parsed = orderPaidTopupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid order." };
  }

  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }

  const owner = await resolvePreviewOwnerClerkUserId(
    parsed.data.orderId,
    gate.userId,
    gate.isAdmin,
  );
  if (!owner.ok) {
    return owner;
  }

  const db = getDb();
  const lines = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.id, parsed.data.orderId),
        eq(orders.clerkUserId, owner.ownerClerkUserId),
      ),
    );

  const paidTopupCents = await sumPaidMerchandiseTopupAddOnCentsForOrderItems({
    clerkUserId: owner.ownerClerkUserId,
    orderItemIds: lines.map((l) => l.id),
  });

  return { ok: true, paidTopupCents };
}
