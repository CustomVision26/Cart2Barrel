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
import { getItemRequestById } from "@/data/item-requests";
import { restoreProductReturnBarrelHold } from "@/data/product-return-barrel-hold";
import {
  isMissingOrderItemProductReturnRequestsTableError,
  isMissingProductReturnBarrelHoldColumnsError,
} from "@/lib/db-column-missing";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { dashboardOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { revalidateProductReturnBarrelPaths } from "@/lib/revalidate-product-return-barrel-paths";
import { cancelProductReturnRequestSchema } from "@/lib/validations/product-return-request";

export type CancelProductReturnRequestState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function cancelProductReturnRequestAction(
  raw: unknown,
): Promise<CancelProductReturnRequestState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to cancel the return request." };
  }

  const parsed = cancelProductReturnRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  const db = getDb();
  const [scoped] = await db
    .select({
      orderItem: orderItems,
      order: orders,
      itemRequest: itemRequests,
      returnRequest: orderItemProductReturnRequests,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .innerJoin(
      orderItemProductReturnRequests,
      eq(orderItemProductReturnRequests.orderItemId, orderItems.id),
    )
    .where(eq(orderItems.id, parsed.data.orderItemId))
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

  if (scoped.returnRequest.status !== "submitted") {
    return {
      ok: false,
      message: "This return request cannot be cancelled from your account right now.",
    };
  }

  const fulfillment = effectiveOrderItemFulfillmentStatus(
    scoped.orderItem,
    scoped.order,
  );
  if (fulfillment === "product_return_awaiting_delivery") {
    return {
      ok: false,
      message: "Staff has already started the return shipment for this line.",
    };
  }

  const now = new Date().toISOString();
  const hadBarrelHold =
    scoped.returnRequest.heldFulfillmentStatus != null &&
    scoped.returnRequest.heldPackageId != null;

  try {
    await db
      .update(orderItemProductReturnRequests)
      .set({
        status: "cancelled",
        updatedAt: now,
      })
      .where(
        and(
          eq(orderItemProductReturnRequests.id, scoped.returnRequest.id),
          eq(orderItemProductReturnRequests.status, "submitted"),
        )!,
      );

    if (hadBarrelHold) {
      try {
        await restoreProductReturnBarrelHold(scoped.returnRequest);
      } catch (restoreErr) {
        if (!isMissingProductReturnBarrelHoldColumnsError(restoreErr)) {
          throw restoreErr;
        }
      }
    }

    const req = await getItemRequestById(scoped.itemRequest.id);
    if (req) {
      const payload = lineSnapshotPayloadFromItemRequest(req);
      try {
        await db.insert(itemRequestLineSnapshots).values({
          itemRequestId: scoped.itemRequest.id,
          phase: "customer_line_edit",
          itemQuoteId: null,
          batchQuoteSessionId: null,
          auditMemo:
            hadBarrelHold ?
              "Customer cancelled product return request. Product restored to container packing queue."
            : "Customer cancelled product return request.",
          productUrl: payload.productUrl,
          productName: payload.productName,
          productSize: payload.productSize,
          productColor: payload.productColor,
          quantity: payload.quantity,
          note: payload.note,
          productImageUrl: payload.productImageUrl,
          siteName: payload.siteName,
        });
      } catch {
        /* snapshot optional if migrations lag */
      }
    }
  } catch (e) {
    if (isMissingOrderItemProductReturnRequestsTableError(e)) {
      return {
        ok: false,
        message:
          "Return requests are not available yet — run npm run db:push to apply migration 0050_order_item_product_return_requests.",
      };
    }
    throw e;
  }

  const restoredFulfillment =
    hadBarrelHold && scoped.returnRequest.heldFulfillmentStatus ?
      scoped.returnRequest.heldFulfillmentStatus
    : fulfillment;
  const statusLabel = dashboardOrderLineStatusLabel(restoredFulfillment, {
    warehouseReceivedCondition: scoped.orderItem.warehouseReceivedCondition,
  });

  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/orders");
  revalidateDashboardAddItem();
  if (hadBarrelHold) {
    revalidateProductReturnBarrelPaths();
  }

  return {
    ok: true,
    message:
      hadBarrelHold ?
        `Return request cancelled. This product is back in the container packing queue (${statusLabel}).`
      : `Return request cancelled. This line is back to ${statusLabel}.`,
  };
}
