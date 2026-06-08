"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@clerk/nextjs/server";

import { getDb } from "@/db";
import {
  itemRequestLineSnapshots,
  itemRequests,
  orderItemProductReturnRequests,
  orderItems,
  orders,
} from "@/db/schema";
import { lineSnapshotPayloadFromItemRequest } from "@/data/item-request-line-snapshots";
import { recordProductReturnRequestedActivity } from "@/data/admin-user-activity-events";
import { getItemRequestById } from "@/data/item-requests";
import {
  captureProductReturnBarrelHold,
  releaseProductReturnBarrelHold,
} from "@/data/product-return-barrel-hold";
import {
  getProductReturnRequestByOrderItemId,
  pendingProductReturnRequestsByOrderItemIds,
} from "@/data/order-item-product-return-requests";
import { pendingRefundRequestsByOrderItemIds } from "@/data/order-item-refund-requests";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import {
  isMissingOrderItemProductReturnRequestsTableError,
  isMissingProductReturnBarrelHoldColumnsError,
  isMissingProductReturnDesiredOutcomeColumnError,
} from "@/lib/db-column-missing";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { orderLineFulfillmentAllowsProductReturnRequest } from "@/lib/order-line-product-return-eligibility";
import { refundableLineRemainderCents } from "@/lib/order-line-refund-eligibility";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { revalidateProductReturnBarrelPaths } from "@/lib/revalidate-product-return-barrel-paths";
import {
  productReturnDesiredOutcomeContextFromFulfillment,
  productReturnDesiredOutcomeLabel,
} from "@/lib/product-return-desired-outcome";
import { submitProductReturnRequestSchema } from "@/lib/validations/product-return-request";

export type SubmitProductReturnRequestState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function submitProductReturnRequestAction(
  raw: unknown,
): Promise<SubmitProductReturnRequestState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to request a product return." };
  }

  const parsed = submitProductReturnRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const first =
      fieldErrors.desiredOutcome?.[0] ??
      fieldErrors.returnNote?.[0] ??
      fieldErrors.orderItemId?.[0] ??
      fieldErrors.acknowledgeChargesMayApply?.[0];
    return {
      ok: false,
      message: first ?? "We could not read this return request. Check all fields.",
    };
  }

  const data = parsed.data;
  const db = getDb();

  const [scoped] = await db
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

  if (isOutsidePurchaseRequest(scoped.itemRequest)) {
    return {
      ok: false,
      message: "Outside purchases use the return-to-retailer workflow on Active products.",
    };
  }

  if (scoped.order.status !== "paid") {
    return { ok: false, message: "Only paid order lines can request a return." };
  }

  const effectiveFulfillment = effectiveOrderItemFulfillmentStatus(
    scoped.orderItem,
    scoped.order,
  );
  if (effectiveFulfillment === "refunded") {
    return { ok: false, message: "This line has already been refunded." };
  }
  if (effectiveFulfillment === "product_return_awaiting_delivery") {
    return {
      ok: false,
      message: "A return shipment is already in progress for this line.",
    };
  }
  if (
    !orderLineFulfillmentAllowsProductReturnRequest(
      scoped.orderItem,
      scoped.order,
    )
  ) {
    return {
      ok: false,
      message: "This item is not eligible for a return request right now.",
    };
  }

  const refundedMap = await sumRefundedCentsByOrderItemIds([scoped.orderItem.id]);
  const refunded = refundedMap.get(scoped.orderItem.id) ?? 0;
  if (
    refundableLineRemainderCents(scoped.orderItem.price, refunded) < 1
  ) {
    return { ok: false, message: "This line has no remaining value to return." };
  }

  const pendingReturn = await pendingProductReturnRequestsByOrderItemIds([
    scoped.orderItem.id,
  ]);
  if (pendingReturn.has(scoped.orderItem.id)) {
    return {
      ok: false,
      message: "A return request is already pending for this line.",
    };
  }

  const pendingRefund = await pendingRefundRequestsByOrderItemIds([
    scoped.orderItem.id,
  ]);
  if (pendingRefund.has(scoped.orderItem.id)) {
    return {
      ok: false,
      message: "Cancel or wait for your refund request before starting a return.",
    };
  }

  const existingReturn = await getProductReturnRequestByOrderItemId(scoped.orderItem.id);
  if (existingReturn?.status === "fulfilled") {
    return {
      ok: false,
      message: "A return has already been processed for this line.",
    };
  }

  const now = new Date().toISOString();
  const returnNote = data.returnNote.trim();

  let barrelHold: Awaited<ReturnType<typeof captureProductReturnBarrelHold>> =
    null;
  try {
    barrelHold = await captureProductReturnBarrelHold(scoped.orderItem.id);
    if (barrelHold) {
      await releaseProductReturnBarrelHold(barrelHold.heldPackageId);
    }
  } catch (e) {
    if (!isMissingProductReturnBarrelHoldColumnsError(e)) {
      throw e;
    }
  }

  const returnValues = {
    clerkUserId: userId,
    desiredOutcome: data.desiredOutcome,
    reasonKind: "other" as const,
    details: returnNote,
    returnWindowStart: null,
    returnWindowEnd: null,
    customerNotes: null,
    status: "submitted" as const,
    fulfilledAt: null,
    fulfilledByClerkUserId: null,
    heldBarrelId: barrelHold?.heldBarrelId ?? null,
    heldPackageId: barrelHold?.heldPackageId ?? null,
    heldFulfillmentStatus: barrelHold?.heldFulfillmentStatus ?? null,
    updatedAt: now,
  };

  try {
    if (existingReturn?.status === "cancelled") {
      await db
        .update(orderItemProductReturnRequests)
        .set(returnValues)
        .where(eq(orderItemProductReturnRequests.id, existingReturn.id));
    } else {
      await db.insert(orderItemProductReturnRequests).values({
        orderItemId: scoped.orderItem.id,
        ...returnValues,
      });
    }
  } catch (e) {
    if (isMissingProductReturnBarrelHoldColumnsError(e)) {
      try {
        const {
          heldBarrelId: _b,
          heldPackageId: _p,
          heldFulfillmentStatus: _f,
          ...legacyValues
        } = returnValues;
        if (existingReturn?.status === "cancelled") {
          await db
            .update(orderItemProductReturnRequests)
            .set(legacyValues)
            .where(eq(orderItemProductReturnRequests.id, existingReturn.id));
        } else {
          await db.insert(orderItemProductReturnRequests).values({
            orderItemId: scoped.orderItem.id,
            ...legacyValues,
          });
        }
      } catch (retry) {
        if (isMissingOrderItemProductReturnRequestsTableError(retry)) {
          return {
            ok: false,
            message:
              "Return requests are not available yet — run npm run db:push to apply migration 0050_order_item_product_return_requests.",
          };
        }
        throw retry;
      }
    } else if (isMissingOrderItemProductReturnRequestsTableError(e)) {
      return {
        ok: false,
        message:
          "Return requests are not available yet — run npm run db:push to apply migration 0050_order_item_product_return_requests.",
      };
    }
    if (isMissingProductReturnDesiredOutcomeColumnError(e)) {
      return {
        ok: false,
        message:
          "Return outcome options are not available yet — run npm run db:push to apply migration 0051_product_return_desired_outcome.",
      };
    }
    const code =
      e && typeof e === "object" && "code" in e ?
        String((e as { code: unknown }).code)
      : "";
    if (code === "23505") {
      return {
        ok: false,
        message: "A return request already exists for this line.",
      };
    }
    throw e;
  }

  const req = await getItemRequestById(scoped.itemRequest.id);
  if (req) {
    const payload = lineSnapshotPayloadFromItemRequest(req);
    const outcomeLabel = productReturnDesiredOutcomeLabel(
      data.desiredOutcome,
      productReturnDesiredOutcomeContextFromFulfillment(effectiveFulfillment),
    );
    const note = `Desired outcome: ${outcomeLabel}\n\n${returnNote}`;
    const barrelMemo =
      barrelHold ?
        " Product removed from container packing queues pending staff review."
      : "";

    try {
      await db.insert(itemRequestLineSnapshots).values({
        itemRequestId: scoped.itemRequest.id,
        phase: "product_return_requested",
        itemQuoteId: null,
        batchQuoteSessionId: null,
        auditMemo: `Customer submitted product return request (${outcomeLabel}).${barrelMemo}`,
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
      /* snapshot phase may lag migrations */
    }
  }

  await recordProductReturnRequestedActivity({
    customerClerkUserId: userId,
    orderItemId: scoped.orderItem.id,
    productName: scoped.itemRequest.productName,
  });

  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/orders");
  revalidateDashboardAddItem();
  if (barrelHold) {
    revalidateProductReturnBarrelPaths();
  }

  return {
    ok: true,
    message:
      barrelHold ?
        "Return request submitted. This product was removed from container packing until staff review your request."
      : "Return request submitted. Cart2Barrel staff will handle the physical return and shipping.",
  };
}
