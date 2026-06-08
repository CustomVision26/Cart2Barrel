import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import {
  barrelItems,
  orderItemProductReturnRequests,
  orderItems,
  orders,
  packages,
  type OrderItem,
  type OrderItemProductReturnRequest,
} from "@/db/schema";
import { ensureInBarrelAwaitingShippingEnumValue } from "@/data/ensure-in-barrel-fulfillment-enum";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { isMissingProductReturnBarrelHoldColumnsError } from "@/lib/db-column-missing";
import { isProductReturnBarrelStageFulfillment } from "@/lib/product-return-barrel-hold";

export type ProductReturnBarrelHoldCapture = {
  heldFulfillmentStatus: OrderItem["fulfillmentStatus"];
  heldPackageId: string;
  heldBarrelId: string | null;
};

export async function captureProductReturnBarrelHold(
  orderItemId: string,
): Promise<ProductReturnBarrelHoldCapture | null> {
  const db = getDb();
  const [scoped] = await db
    .select({
      fulfillmentStatus: orderItems.fulfillmentStatus,
      orderStatus: orders.status,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orderItems.id, orderItemId))
    .limit(1);

  if (!scoped) return null;

  const fulfillment = effectiveOrderItemFulfillmentStatus(
    { fulfillmentStatus: scoped.fulfillmentStatus },
    { status: scoped.orderStatus },
  );
  if (!isProductReturnBarrelStageFulfillment(fulfillment)) {
    return null;
  }

  const [pkg] = await db
    .select({ id: packages.id })
    .from(packages)
    .where(eq(packages.orderItemId, orderItemId))
    .limit(1);
  if (!pkg) {
    return null;
  }

  const [assignment] = await db
    .select({ barrelId: barrelItems.barrelId })
    .from(barrelItems)
    .where(eq(barrelItems.packageId, pkg.id))
    .limit(1);

  return {
    heldFulfillmentStatus: fulfillment,
    heldPackageId: pkg.id,
    heldBarrelId: assignment?.barrelId ?? null,
  };
}

export async function releaseProductReturnBarrelHold(
  packageId: string,
): Promise<void> {
  const db = getDb();
  await db.delete(barrelItems).where(eq(barrelItems.packageId, packageId));
}

/** Aligns legacy rows where a pending return still has a container assignment. */
export async function reconcilePendingReturnBarrelHolds(): Promise<void> {
  const db = getDb();
  let pending: Array<{
    id: string;
    orderItemId: string;
    heldBarrelId: string | null;
    heldPackageId: string | null;
    heldFulfillmentStatus: OrderItem["fulfillmentStatus"] | null;
  }>;

  try {
    pending = await db
      .select({
        id: orderItemProductReturnRequests.id,
        orderItemId: orderItemProductReturnRequests.orderItemId,
        heldBarrelId: orderItemProductReturnRequests.heldBarrelId,
        heldPackageId: orderItemProductReturnRequests.heldPackageId,
        heldFulfillmentStatus: orderItemProductReturnRequests.heldFulfillmentStatus,
      })
      .from(orderItemProductReturnRequests)
      .where(eq(orderItemProductReturnRequests.status, "submitted"));
  } catch (e) {
    if (isMissingProductReturnBarrelHoldColumnsError(e)) {
      pending = (
        await db
          .select({
            id: orderItemProductReturnRequests.id,
            orderItemId: orderItemProductReturnRequests.orderItemId,
          })
          .from(orderItemProductReturnRequests)
          .where(eq(orderItemProductReturnRequests.status, "submitted"))
      ).map((row) => ({
        ...row,
        heldBarrelId: null,
        heldPackageId: null,
        heldFulfillmentStatus: null,
      }));
    } else {
      throw e;
    }
  }

  if (pending.length === 0) return;

  const orderItemIds = pending.map((row) => row.orderItemId);
  const assignments = await db
    .select({
      orderItemId: packages.orderItemId,
      packageId: packages.id,
      barrelId: barrelItems.barrelId,
    })
    .from(packages)
    .innerJoin(barrelItems, eq(barrelItems.packageId, packages.id))
    .where(inArray(packages.orderItemId, orderItemIds));

  const assignmentByOrderItem = new Map(
    assignments.map((row) => [row.orderItemId, row] as const),
  );

  for (const request of pending) {
    const assignment = assignmentByOrderItem.get(request.orderItemId);

    if (request.heldPackageId) {
      if (assignment) {
        await releaseProductReturnBarrelHold(request.heldPackageId);
      }
      continue;
    }

    const capture = await captureProductReturnBarrelHold(request.orderItemId);
    if (!capture) continue;

    if (assignment || capture.heldBarrelId) {
      await releaseProductReturnBarrelHold(capture.heldPackageId);
    }

    try {
      await db
        .update(orderItemProductReturnRequests)
        .set({
          heldBarrelId: capture.heldBarrelId,
          heldPackageId: capture.heldPackageId,
          heldFulfillmentStatus: capture.heldFulfillmentStatus,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(orderItemProductReturnRequests.id, request.id),
            eq(orderItemProductReturnRequests.status, "submitted"),
            isNull(orderItemProductReturnRequests.heldPackageId),
          )!,
        );
    } catch (e) {
      if (!isMissingProductReturnBarrelHoldColumnsError(e)) {
        throw e;
      }
    }
  }
}

export async function restoreProductReturnBarrelHold(
  returnRequest: Pick<
    OrderItemProductReturnRequest,
    | "id"
    | "orderItemId"
    | "heldBarrelId"
    | "heldPackageId"
    | "heldFulfillmentStatus"
  >,
): Promise<void> {
  if (!returnRequest.heldFulfillmentStatus || !returnRequest.heldPackageId) {
    return;
  }

  const enumReady = await ensureInBarrelAwaitingShippingEnumValue();
  if (
    returnRequest.heldFulfillmentStatus === "in_barrel_awaiting_shipping" &&
    !enumReady
  ) {
    return;
  }

  const db = getDb();

  if (returnRequest.heldBarrelId) {
    const [existing] = await db
      .select({ id: barrelItems.id })
      .from(barrelItems)
      .where(eq(barrelItems.packageId, returnRequest.heldPackageId))
      .limit(1);

    if (!existing) {
      await db.insert(barrelItems).values({
        barrelId: returnRequest.heldBarrelId,
        packageId: returnRequest.heldPackageId,
      });
    }
  }

  await db
    .update(orderItems)
    .set({ fulfillmentStatus: returnRequest.heldFulfillmentStatus })
    .where(eq(orderItems.id, returnRequest.orderItemId));

  await db
    .update(orderItemProductReturnRequests)
    .set({
      heldBarrelId: null,
      heldPackageId: null,
      heldFulfillmentStatus: null,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(orderItemProductReturnRequests.id, returnRequest.id),
        eq(orderItemProductReturnRequests.status, "cancelled"),
      )!,
    );
}
