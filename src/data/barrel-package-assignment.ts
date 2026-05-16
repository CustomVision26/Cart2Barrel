import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  barrelItems,
  barrelPackageAssignmentEvents,
  barrels,
  itemRequests,
  orderContainerItems,
  orderItems,
  orders,
  packages,
} from "@/db/schema";
import { formatBarrelSlotLabel } from "@/lib/barrel-slot-label";
import { dashboardOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { ensureInboundPackageForOrderItem } from "@/data/ensure-inbound-package-for-order-item";
import { ensureBarrelsProvisionedForUser } from "@/data/ensure-paid-order-barrels";

export async function ensurePackagesForAwaitingBarrelOwner(
  clerkUserId: string,
): Promise<void> {
  const db = getDb();
  const orphans = await db
    .select({ oi: orderItems })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(packages, eq(packages.orderItemId, orderItems.id))
    .where(
      and(
        eq(orders.clerkUserId, clerkUserId),
        eq(orders.status, "paid"),
        eq(
          orderItems.fulfillmentStatus,
          "delivery_received_good_awaiting_barrel",
        ),
        isNull(packages.id),
      )!,
    );

  for (const row of orphans) {
    const at = row.oi.warehouseReceivedAt ?? new Date().toISOString();
    await ensureInboundPackageForOrderItem(row.oi.id, at);
  }
}

export type UserBarrelOptionRow = {
  barrelId: string;
  label: string;
  status: (typeof barrels.$inferSelect)["status"];
  itemCount: number;
};

export async function listUserBarrelOptionsForAssignment(
  clerkUserId: string,
): Promise<UserBarrelOptionRow[]> {
  await ensureBarrelsProvisionedForUser(clerkUserId);
  const db = getDb();

  const rows = await db
    .select({
      barrel: barrels,
      oci: orderContainerItems,
    })
    .from(barrels)
    .leftJoin(
      orderContainerItems,
      eq(barrels.orderContainerItemId, orderContainerItems.id),
    )
    .where(eq(barrels.clerkUserId, clerkUserId))
    .orderBy(desc(barrels.createdAt));

  const counts = await db
    .select({
      barrelId: barrelItems.barrelId,
      c: sql<number>`count(*)::int`,
    })
    .from(barrelItems)
    .groupBy(barrelItems.barrelId);

  const countByBarrel = new Map(
    counts.map((r) => [r.barrelId, r.c] as const),
  );

  return rows.map((r) => {
    const oci = r.oci;
    const label =
      oci ?
        formatBarrelSlotLabel({
          nameSnapshot: oci.nameSnapshot,
          sizeSnapshot: oci.sizeSnapshot,
          unitOrdinal: r.barrel.unitOrdinal,
        })
      : `Barrel ${r.barrel.id.slice(0, 8)}…`;
    return {
      barrelId: r.barrel.id,
      label,
      status: r.barrel.status,
      itemCount: countByBarrel.get(r.barrel.id) ?? 0,
    };
  });
}

export type ProductToBarrelLineRow = {
  orderItemId: string;
  orderId: string;
  packageId: string;
  productName: string;
  fulfillmentStatus: (typeof orderItems.$inferSelect)["fulfillmentStatus"];
  fulfillmentLabel: string;
  assignedBarrelId: string | null;
  assignedBarrelLabel: string | null;
};

export async function listProductToBarrelLinesForUser(
  clerkUserId: string,
): Promise<ProductToBarrelLineRow[]> {
  await ensureBarrelsProvisionedForUser(clerkUserId);
  await ensurePackagesForAwaitingBarrelOwner(clerkUserId);
  const db = getDb();

  const base = await db
    .select({
      orderItem: orderItems,
      order: orders,
      request: itemRequests,
      pkg: packages,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .innerJoin(packages, eq(packages.orderItemId, orderItems.id))
    .where(
      and(
        eq(orders.clerkUserId, clerkUserId),
        eq(orders.status, "paid"),
        eq(
          orderItems.fulfillmentStatus,
          "delivery_received_good_awaiting_barrel",
        ),
      )!,
    )
    .orderBy(desc(orders.createdAt));

  if (base.length === 0) {
    return [];
  }

  const pkgIds = base.map((r) => r.pkg.id);
  const assignments = await db
    .select({
      packageId: barrelItems.packageId,
      barrelId: barrelItems.barrelId,
    })
    .from(barrelItems)
    .where(inArray(barrelItems.packageId, pkgIds));

  const pkgToBarrel = new Map(assignments.map((a) => [a.packageId, a.barrelId]));

  const barrelIds = [...new Set(assignments.map((a) => a.barrelId))];
  const barrelMeta =
    barrelIds.length === 0 ?
      []
    : await db
        .select({ barrel: barrels, oci: orderContainerItems })
        .from(barrels)
        .leftJoin(
          orderContainerItems,
          eq(barrels.orderContainerItemId, orderContainerItems.id),
        )
        .where(inArray(barrels.id, barrelIds));

  const barrelLabelById = new Map(
    barrelMeta.map((r) => {
      const oci = r.oci;
      const label =
        oci ?
          formatBarrelSlotLabel({
            nameSnapshot: oci.nameSnapshot,
            sizeSnapshot: oci.sizeSnapshot,
            unitOrdinal: r.barrel.unitOrdinal,
          })
        : `Barrel ${r.barrel.id.slice(0, 8)}…`;
      return [r.barrel.id, label] as const;
    }),
  );

  return base.map((r) => {
    const bid = pkgToBarrel.get(r.pkg.id) ?? null;
    return {
      orderItemId: r.orderItem.id,
      orderId: r.order.id,
      packageId: r.pkg.id,
      productName: r.request.productName?.trim() || "Unnamed product",
      fulfillmentStatus: r.orderItem.fulfillmentStatus,
      fulfillmentLabel: dashboardOrderLineStatusLabel(
        r.orderItem.fulfillmentStatus,
      ),
      assignedBarrelId: bid,
      assignedBarrelLabel: bid ? (barrelLabelById.get(bid) ?? null) : null,
    };
  });
}

export type AdminBarrelAssignmentRow = {
  packageId: string;
  orderItemId: string;
  ownerClerkUserId: string;
  productName: string;
  barrelId: string;
  barrelLabel: string;
};

export async function listAdminBarrelAssignments(): Promise<
  AdminBarrelAssignmentRow[]
> {
  const db = getDb();
  const rows = await db
    .select({
      bi: barrelItems,
      pkg: packages,
      oi: orderItems,
      ord: orders,
      req: itemRequests,
      barrel: barrels,
      oci: orderContainerItems,
    })
    .from(barrelItems)
    .innerJoin(packages, eq(barrelItems.packageId, packages.id))
    .innerJoin(orderItems, eq(packages.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .innerJoin(barrels, eq(barrelItems.barrelId, barrels.id))
    .leftJoin(
      orderContainerItems,
      eq(barrels.orderContainerItemId, orderContainerItems.id),
    )
    .orderBy(desc(barrels.createdAt));

  return rows.map((r) => {
    const oci = r.oci;
    const label =
      oci ?
        formatBarrelSlotLabel({
          nameSnapshot: oci.nameSnapshot,
          sizeSnapshot: oci.sizeSnapshot,
          unitOrdinal: r.barrel.unitOrdinal,
        })
      : `Barrel ${r.barrel.id.slice(0, 8)}…`;
    return {
      packageId: r.pkg.id,
      orderItemId: r.oi.id,
      ownerClerkUserId: r.ord.clerkUserId,
      productName: r.req.productName?.trim() || "Unnamed product",
      barrelId: r.barrel.id,
      barrelLabel: label,
    };
  });
}

export type AssignmentHistoryRow = {
  id: string;
  createdAt: string;
  action: (typeof barrelPackageAssignmentEvents.$inferSelect)["action"];
  ownerClerkUserId: string;
  productNameSnapshot: string | null;
  barrelLabelSnapshot: string | null;
  fromBarrelId: string | null;
  toBarrelId: string | null;
  adminNote: string | null;
  actorClerkUserId: string;
  packageId: string;
  orderItemId: string;
};

export async function listBarrelAssignmentHistoryForOwner(
  clerkUserId: string,
  limit = 200,
): Promise<AssignmentHistoryRow[]> {
  const db = getDb();
  return await db
    .select({
      id: barrelPackageAssignmentEvents.id,
      createdAt: barrelPackageAssignmentEvents.createdAt,
      action: barrelPackageAssignmentEvents.action,
      ownerClerkUserId: barrelPackageAssignmentEvents.ownerClerkUserId,
      productNameSnapshot: barrelPackageAssignmentEvents.productNameSnapshot,
      barrelLabelSnapshot: barrelPackageAssignmentEvents.barrelLabelSnapshot,
      fromBarrelId: barrelPackageAssignmentEvents.fromBarrelId,
      toBarrelId: barrelPackageAssignmentEvents.toBarrelId,
      adminNote: barrelPackageAssignmentEvents.adminNote,
      actorClerkUserId: barrelPackageAssignmentEvents.actorClerkUserId,
      packageId: barrelPackageAssignmentEvents.packageId,
      orderItemId: barrelPackageAssignmentEvents.orderItemId,
    })
    .from(barrelPackageAssignmentEvents)
    .where(eq(barrelPackageAssignmentEvents.ownerClerkUserId, clerkUserId))
    .orderBy(desc(barrelPackageAssignmentEvents.createdAt))
    .limit(limit);
}

export async function listBarrelAssignmentHistoryAdmin(
  limit = 500,
): Promise<AssignmentHistoryRow[]> {
  const db = getDb();
  return await db
    .select({
      id: barrelPackageAssignmentEvents.id,
      createdAt: barrelPackageAssignmentEvents.createdAt,
      action: barrelPackageAssignmentEvents.action,
      ownerClerkUserId: barrelPackageAssignmentEvents.ownerClerkUserId,
      productNameSnapshot: barrelPackageAssignmentEvents.productNameSnapshot,
      barrelLabelSnapshot: barrelPackageAssignmentEvents.barrelLabelSnapshot,
      fromBarrelId: barrelPackageAssignmentEvents.fromBarrelId,
      toBarrelId: barrelPackageAssignmentEvents.toBarrelId,
      adminNote: barrelPackageAssignmentEvents.adminNote,
      actorClerkUserId: barrelPackageAssignmentEvents.actorClerkUserId,
      packageId: barrelPackageAssignmentEvents.packageId,
      orderItemId: barrelPackageAssignmentEvents.orderItemId,
    })
    .from(barrelPackageAssignmentEvents)
    .orderBy(desc(barrelPackageAssignmentEvents.createdAt))
    .limit(limit);
}

export async function listBarrelOptionsForOwner(
  ownerClerkUserId: string,
): Promise<UserBarrelOptionRow[]> {
  return listUserBarrelOptionsForAssignment(ownerClerkUserId);
}

export async function getPackageAssignmentContextForAdmin(packageId: string): Promise<{
  ownerClerkUserId: string;
  orderItemId: string;
  currentBarrelId: string | null;
  productName: string;
} | null> {
  const db = getDb();
  const [row] = await db
    .select({
      pkg: packages,
      oi: orderItems,
      ord: orders,
      req: itemRequests,
      biBarrelId: barrelItems.barrelId,
    })
    .from(packages)
    .innerJoin(orderItems, eq(packages.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .leftJoin(barrelItems, eq(barrelItems.packageId, packages.id))
    .where(eq(packages.id, packageId))
    .limit(1);

  if (!row) return null;
  return {
    ownerClerkUserId: row.ord.clerkUserId,
    orderItemId: row.oi.id,
    currentBarrelId: row.biBarrelId ?? null,
    productName: row.req.productName?.trim() || "Unnamed product",
  };
}

export async function getBarrelLabelById(barrelId: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ barrel: barrels, oci: orderContainerItems })
    .from(barrels)
    .leftJoin(
      orderContainerItems,
      eq(barrels.orderContainerItemId, orderContainerItems.id),
    )
    .where(eq(barrels.id, barrelId))
    .limit(1);
  if (!row) return null;
  const oci = row.oci;
  if (oci) {
    return formatBarrelSlotLabel({
      nameSnapshot: oci.nameSnapshot,
      sizeSnapshot: oci.sizeSnapshot,
      unitOrdinal: row.barrel.unitOrdinal,
    });
  }
  return `Barrel ${row.barrel.id.slice(0, 8)}…`;
}
