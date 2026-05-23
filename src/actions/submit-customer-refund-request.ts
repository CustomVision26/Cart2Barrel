"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@clerk/nextjs/server";

import { getDb } from "@/db";
import {
  itemRequestLineSnapshots,
  itemRequests,
  orderItemRefundRequests,
  orderItems,
  orders,
} from "@/db/schema";
import { lineSnapshotPayloadFromItemRequest } from "@/data/item-request-line-snapshots";
import { recordRefundRequestSubmittedActivity } from "@/data/admin-user-activity-events";
import { getItemRequestById } from "@/data/item-requests";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import { pendingRefundRequestsByOrderItemIds } from "@/data/order-item-refund-requests";
import {
  buildRefundRequestAuditMemo,
  refundRequestReasonKindLabel,
} from "@/lib/refund-request-audit-memo";
import {
  orderLineFulfillmentAllowsRefundWorkflow,
  parseUsdDecimalToCents,
  refundableLineRemainderCents,
} from "@/lib/order-line-refund-eligibility";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { submitCustomerRefundRequestSchema } from "@/lib/validations/order-item-refund-request";

export type SubmitCustomerRefundRequestState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function submitCustomerRefundRequestAction(
  raw: unknown,
): Promise<SubmitCustomerRefundRequestState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to request a refund." };
  }

  const parsed = submitCustomerRefundRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const first =
      parsed.error.flatten().fieldErrors.details?.[0] ??
      parsed.error.flatten().fieldErrors.orderItemId?.[0] ??
      parsed.error.flatten().fieldErrors.reasonKind?.[0] ??
      parsed.error.flatten().fieldErrors.refundFullLineRemainder?.[0] ??
      parsed.error.flatten().fieldErrors.acknowledgeProcessing?.[0];
    return {
      ok: false,
      message:
        first ?? "We could not read this refund request. Check all fields.",
    };
  }

  const data = parsed.data;

  const [scoped] = await getDb()
    .select({
      orderItem: orderItems,
      order: orders,
      itemRequest: itemRequests,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .where(eq(orderItems.id, data.orderItemId))
    .limit(1);

  if (!scoped || scoped.order.clerkUserId !== userId) {
    return { ok: false, message: "Order line not found." };
  }

  if (scoped.order.status !== "paid") {
    return {
      ok: false,
      message: "Only paid orders can request a merchandise-line refund.",
    };
  }

  const effectiveFulfillment = effectiveOrderItemFulfillmentStatus(
    scoped.orderItem,
    scoped.order,
  );
  if (effectiveFulfillment === "refunded") {
    return { ok: false, message: "This line has already been refunded." };
  }
  if (!orderLineFulfillmentAllowsRefundWorkflow(scoped.orderItem, scoped.order)) {
    return {
      ok: false,
      message:
        "This item is not in a refundable stage yet. Reach support if this looks wrong.",
    };
  }

  const refundedMap = await sumRefundedCentsByOrderItemIds([
    scoped.orderItem.id,
  ]);
  const refundedSoFar = refundedMap.get(scoped.orderItem.id) ?? 0;
  const remainder = refundableLineRemainderCents(
    scoped.orderItem.price,
    refundedSoFar,
  );
  if (remainder < 1) {
    return { ok: false, message: "Nothing is left to refund on this line." };
  }

  const existingPending = await pendingRefundRequestsByOrderItemIds([
    scoped.orderItem.id,
  ]);
  if (existingPending.has(scoped.orderItem.id)) {
    return {
      ok: false,
      message:
        "A refund request is already awaiting staff review for this item.",
    };
  }

  let requestedAmountCents: number | null = null;
  if (!data.refundFullLineRemainder) {
    const cents = parseUsdDecimalToCents(data.requestedAmountUsd);
    if (cents == null || cents > remainder) {
      return {
        ok: false,
        message:
          `Enter a valid partial refund amount in USD (maximum ${(
            remainder / 100
          ).toFixed(2)} remaining on this line).`,
      };
    }
    requestedAmountCents = cents;
  }

  const req = await getItemRequestById(scoped.orderItem.itemRequestId);
  if (!req) {
    return { ok: false, message: "Product request not found." };
  }
  const snapPayload = lineSnapshotPayloadFromItemRequest(req);

  const noteLines = [
    `Refund requested — awaiting approval · ${refundRequestReasonKindLabel(data.reasonKind)} (${data.refundFullLineRemainder ? "full refundable line remainder" : `partial up to ${((requestedAmountCents ?? remainder) / 100).toFixed(2)} USD`})`,
    "",
    data.details.trim(),
  ];
  const note = noteLines.join("\n");

  const db = getDb();
  try {
    const [inserted] = await db
      .insert(orderItemRefundRequests)
      .values({
        orderItemId: scoped.orderItem.id,
        clerkUserId: userId,
        reasonKind: data.reasonKind,
        details: data.details.trim(),
        requestedAmountCents,
        status: "pending_approval",
      })
      .returning({ id: orderItemRefundRequests.id });

    if (!inserted) {
      throw new Error("insert refund request failed");
    }

    const auditMemo = buildRefundRequestAuditMemo({
      orderItemRefundRequestId: inserted.id,
      orderItemId: scoped.orderItem.id,
      reasonKind: data.reasonKind,
      details: data.details.trim(),
      requestedAmountCents,
    });

    await db.insert(itemRequestLineSnapshots).values({
      itemRequestId: scoped.orderItem.itemRequestId,
      phase: "customer_refund_request_submitted",
      itemQuoteId: null,
      batchQuoteSessionId: req.batchQuoteSessionId,
      auditMemo,
      productUrl: snapPayload.productUrl,
      productName: snapPayload.productName,
      productSize: snapPayload.productSize,
      productColor: snapPayload.productColor,
      quantity: snapPayload.quantity,
      note,
      productImageUrl: snapPayload.productImageUrl,
      siteName: snapPayload.siteName,
    });
  } catch (e) {
    console.error("[Cart2Barrel] Could not save refund request:", e);
    return { ok: false, message: "Could not save your refund request. Try again." };
  }

  await recordRefundRequestSubmittedActivity({
    customerClerkUserId: userId,
    orderItemId: scoped.orderItem.id,
    productName: scoped.itemRequest.productName,
  });

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  revalidatePath("/admin/overview");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/packages");

  return {
    ok: true,
    message:
      "Refund request submitted. Staff will review it; your line shows as awaiting approval.",
  };
}
