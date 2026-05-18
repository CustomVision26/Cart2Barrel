import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { barrelItems, orderItems, orders, packages } from "@/db/schema";
import { ensureInBarrelAwaitingShippingEnumValue } from "@/data/ensure-in-barrel-fulfillment-enum";
import {
  BARREL_PIPELINE_AWAITING_ASSIGNMENT,
  BARREL_PIPELINE_IN_CONTAINER,
} from "@/lib/barrel-pipeline-fulfillment";
import { isLikelyOrderFulfillmentEnumInQueryFailure } from "@/lib/db-column-missing";

/**
 * Aligns `order_items.fulfillment_status` with `barrel_items` links (e.g. after deploy or manual DB edits).
 */
export async function syncBarrelPipelineFulfillmentForOwner(
  clerkUserId: string,
): Promise<void> {
  const enumReady = await ensureInBarrelAwaitingShippingEnumValue();
  if (!enumReady) {
    return;
  }

  const db = getDb();

  const assignedRows = await db
    .select({ orderItemId: orderItems.id })
    .from(barrelItems)
    .innerJoin(packages, eq(barrelItems.packageId, packages.id))
    .innerJoin(orderItems, eq(packages.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.clerkUserId, clerkUserId),
        eq(orders.status, "paid"),
        eq(orderItems.fulfillmentStatus, BARREL_PIPELINE_AWAITING_ASSIGNMENT),
      )!,
    );

  const assignedIds = assignedRows.map((r) => r.orderItemId);
  if (assignedIds.length > 0) {
    try {
      await db
        .update(orderItems)
        .set({ fulfillmentStatus: BARREL_PIPELINE_IN_CONTAINER })
        .where(inArray(orderItems.id, assignedIds));
    } catch (e) {
      if (!isLikelyOrderFulfillmentEnumInQueryFailure(e)) {
        throw e;
      }
    }
  }

  const unassignedRows = await db
    .select({ orderItemId: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(packages, eq(packages.orderItemId, orderItems.id))
    .leftJoin(barrelItems, eq(barrelItems.packageId, packages.id))
    .where(
      and(
        eq(orders.clerkUserId, clerkUserId),
        eq(orders.status, "paid"),
        eq(orderItems.fulfillmentStatus, BARREL_PIPELINE_IN_CONTAINER),
        isNull(barrelItems.id),
      )!,
    );

  const unassignedIds = unassignedRows.map((r) => r.orderItemId);
  if (unassignedIds.length > 0) {
    try {
      await db
        .update(orderItems)
        .set({ fulfillmentStatus: BARREL_PIPELINE_AWAITING_ASSIGNMENT })
        .where(inArray(orderItems.id, unassignedIds));
    } catch (e) {
      if (!isLikelyOrderFulfillmentEnumInQueryFailure(e)) {
        throw e;
      }
    }
  }
}

export async function syncBarrelPipelineFulfillmentAllOwners(): Promise<void> {
  const db = getDb();
  const owners = await db
    .selectDistinct({ clerkUserId: orders.clerkUserId })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      inArray(orderItems.fulfillmentStatus, [
        BARREL_PIPELINE_AWAITING_ASSIGNMENT,
        BARREL_PIPELINE_IN_CONTAINER,
      ]),
    );

  for (const { clerkUserId } of owners) {
    await syncBarrelPipelineFulfillmentForOwner(clerkUserId);
  }
}
