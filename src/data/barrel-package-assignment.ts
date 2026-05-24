import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

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
import {
  buildContainerAliasMap,
  formatContainerDisplayLabel,
  formatContainerDropdownLabel,
} from "@/lib/container-slot-alias";
import { dashboardOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import type {
  AdminBarrelPipelineRow,
  ProductToBarrelLineRow,
  UserBarrelOptionRow,
} from "@/lib/barrel-container-types";
import {
  BARREL_PIPELINE_AWAITING_ASSIGNMENT,
  BARREL_PIPELINE_FULFILLMENT_STATUSES,
  BARREL_PIPELINE_IN_CONTAINER,
  BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID,
  PRODUCT_TO_BARREL_FULFILLMENT_STATUSES,
} from "@/lib/barrel-pipeline-fulfillment";
import { backfillOutsidePurchasePaidServiceFeeFulfillment } from "@/data/backfill-outside-purchase-paid-fulfillment";
import { ensurePaidOutsidePurchaseFulfillmentEnums } from "@/data/ensure-paid-outside-purchase-fulfillment-enum";
import { ensureInBarrelAwaitingShippingEnumValue } from "@/data/ensure-in-barrel-fulfillment-enum";
import { syncBarrelPipelineFulfillmentForOwner } from "@/data/sync-barrel-pipeline-fulfillment";
import {
  parseContainerOfferingKind,
} from "@/lib/validations/container-offering";
import { ensureInboundPackageForOrderItem } from "@/data/ensure-inbound-package-for-order-item";
import { ensureBarrelsProvisionedForUser } from "@/data/ensure-paid-order-barrels";
import {
  orderItemBarrelPipelineSelect,
  orderItemBarrelPipelineSelectWithoutWarehouse,
} from "@/data/order-list-select";

export type {
  AdminBarrelPipelineRow,
  ProductToBarrelLineRow,
  UserBarrelOptionRow,
} from "@/lib/barrel-container-types";

async function loadLatestAssignmentAtByPackage(
  packageIds: string[],
): Promise<Map<string, string>> {
  if (packageIds.length === 0) {
    return new Map();
  }
  const db = getDb();
  const events = await db
    .select({
      packageId: barrelPackageAssignmentEvents.packageId,
      createdAt: barrelPackageAssignmentEvents.createdAt,
      action: barrelPackageAssignmentEvents.action,
    })
    .from(barrelPackageAssignmentEvents)
    .where(
      and(
        inArray(barrelPackageAssignmentEvents.packageId, packageIds),
        or(
          eq(barrelPackageAssignmentEvents.action, "assigned"),
          eq(barrelPackageAssignmentEvents.action, "reassigned"),
        ),
      )!,
    )
    .orderBy(desc(barrelPackageAssignmentEvents.createdAt));

  const map = new Map<string, string>();
  for (const ev of events) {
    if (!map.has(ev.packageId)) {
      map.set(ev.packageId, ev.createdAt);
    }
  }
  return map;
}

async function loadLatestActorByBarrel(
  barrelIds: string[],
): Promise<Map<string, string>> {
  if (barrelIds.length === 0) {
    return new Map();
  }
  const db = getDb();
  const events = await db
    .select({
      fromBarrelId: barrelPackageAssignmentEvents.fromBarrelId,
      toBarrelId: barrelPackageAssignmentEvents.toBarrelId,
      actorClerkUserId: barrelPackageAssignmentEvents.actorClerkUserId,
      createdAt: barrelPackageAssignmentEvents.createdAt,
    })
    .from(barrelPackageAssignmentEvents)
    .where(
      or(
        inArray(barrelPackageAssignmentEvents.fromBarrelId, barrelIds),
        inArray(barrelPackageAssignmentEvents.toBarrelId, barrelIds),
      )!,
    )
    .orderBy(desc(barrelPackageAssignmentEvents.createdAt));

  const map = new Map<string, string>();
  for (const ev of events) {
    for (const barrelId of [ev.fromBarrelId, ev.toBarrelId]) {
      if (barrelId && !map.has(barrelId)) {
        map.set(barrelId, ev.actorClerkUserId);
      }
    }
  }
  return map;
}

async function loadLatestActorByPackage(
  packageIds: string[],
): Promise<Map<string, string>> {
  if (packageIds.length === 0) {
    return new Map();
  }
  const db = getDb();
  const events = await db
    .select({
      packageId: barrelPackageAssignmentEvents.packageId,
      actorClerkUserId: barrelPackageAssignmentEvents.actorClerkUserId,
      createdAt: barrelPackageAssignmentEvents.createdAt,
    })
    .from(barrelPackageAssignmentEvents)
    .where(inArray(barrelPackageAssignmentEvents.packageId, packageIds))
    .orderBy(desc(barrelPackageAssignmentEvents.createdAt));

  const map = new Map<string, string>();
  for (const ev of events) {
    if (!map.has(ev.packageId)) {
      map.set(ev.packageId, ev.actorClerkUserId);
    }
  }
  return map;
}

export async function ensurePackagesForOutsidePurchasePaidOwner(
  clerkUserId: string,
): Promise<void> {
  await ensurePaidOutsidePurchaseFulfillmentEnums();
  const db = getDb();
  const orphans = await db
    .select({ orderItemId: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(packages, eq(packages.orderItemId, orderItems.id))
    .where(
      and(
        eq(orders.clerkUserId, clerkUserId),
        eq(orders.status, "paid"),
        eq(
          orderItems.fulfillmentStatus,
          BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID,
        ),
        isNull(packages.id),
      )!,
    );

  for (const row of orphans) {
    await ensureInboundPackageForOrderItem(
      row.orderItemId,
      new Date().toISOString(),
    );
  }
}

export async function ensurePackagesForAwaitingBarrelOwner(
  clerkUserId: string,
): Promise<void> {
  const db = getDb();
  type AwaitingBarrelOrphan = {
    orderItemId: string;
    warehouseReceivedAt: string | null;
  };

  let orphans: AwaitingBarrelOrphan[];
  try {
    orphans = await db
      .select({
        orderItemId: orderItems.id,
        warehouseReceivedAt: orderItems.warehouseReceivedAt,
      })
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
  } catch {
    const ids = await db
      .select({ orderItemId: orderItems.id })
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
    orphans = ids.map((row) => ({
      orderItemId: row.orderItemId,
      warehouseReceivedAt: null,
    }));
  }

  for (const row of orphans) {
    const at = row.warehouseReceivedAt ?? new Date().toISOString();
    await ensureInboundPackageForOrderItem(row.orderItemId, at);
  }
}

type BarrelWithOciRow = {
  barrel: typeof barrels.$inferSelect;
  oci: typeof orderContainerItems.$inferSelect | null;
};

function mapBarrelRowsToOptions(
  rows: BarrelWithOciRow[],
  countByBarrel: Map<string, number>,
  ownerClerkUserId?: string,
  actorByBarrel?: Map<string, string>,
): UserBarrelOptionRow[] {
  const aliasMap = buildContainerAliasMap(
    rows.map((r) => ({
      barrelId: r.barrel.id,
      kind: parseContainerOfferingKind(r.oci?.kindSnapshot ?? "barrel"),
      createdAt: r.barrel.createdAt,
    })),
  );

  return rows.map((r) => {
    const kind = parseContainerOfferingKind(r.oci?.kindSnapshot ?? "barrel");
    const alias =
      aliasMap.get(r.barrel.id) ?? (kind === "barrel" ? "Barrel" : "Bin");
    const oci = r.oci;
    const slotLabel =
      oci ?
        formatBarrelSlotLabel({
          nameSnapshot: oci.nameSnapshot,
          sizeSnapshot: oci.sizeSnapshot,
          unitOrdinal: r.barrel.unitOrdinal,
        })
      : `Container ${r.barrel.id.slice(0, 8)}…`;
    const itemCount = countByBarrel.get(r.barrel.id) ?? 0;
    return {
      barrelId: r.barrel.id,
      kind,
      alias,
      slotLabel,
      label: formatContainerDropdownLabel(alias, slotLabel, itemCount),
      status: r.barrel.status,
      itemCount,
      capacityPercentage: r.barrel.capacityPercentage,
      ...(ownerClerkUserId ? { ownerClerkUserId } : {}),
      lastUpdatedByClerkUserId: actorByBarrel?.get(r.barrel.id) ?? null,
    };
  });
}

async function loadItemCountsByBarrel(
  barrelIds: string[],
): Promise<Map<string, number>> {
  if (barrelIds.length === 0) {
    return new Map();
  }
  const db = getDb();
  const counts = await db
    .select({
      barrelId: barrelItems.barrelId,
      c: sql<number>`count(*)::int`,
    })
    .from(barrelItems)
    .where(inArray(barrelItems.barrelId, barrelIds))
    .groupBy(barrelItems.barrelId);

  return new Map(counts.map((r) => [r.barrelId, r.c] as const));
}

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
    .orderBy(asc(barrels.createdAt));

  const barrelIds = rows.map((r) => r.barrel.id);
  const countByBarrel = await loadItemCountsByBarrel(barrelIds);
  const actorByBarrel = await loadLatestActorByBarrel(barrelIds);

  return mapBarrelRowsToOptions(rows, countByBarrel, clerkUserId, actorByBarrel);
}

export async function getBarrelDisplayLabelById(
  barrelId: string,
): Promise<string | null> {
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

  const opts = await listUserBarrelOptionsForAssignment(row.barrel.clerkUserId);
  const match = opts.find((o) => o.barrelId === barrelId);
  if (match) {
    return formatContainerDisplayLabel(match.alias, match.slotLabel);
  }

  const kind = parseContainerOfferingKind(row.oci?.kindSnapshot ?? "barrel");
  const slotLabel =
    row.oci ?
      formatBarrelSlotLabel({
        nameSnapshot: row.oci.nameSnapshot,
        sizeSnapshot: row.oci.sizeSnapshot,
        unitOrdinal: row.barrel.unitOrdinal,
      })
    : `Container ${row.barrel.id.slice(0, 8)}…`;
  return formatContainerDisplayLabel(
    kind === "barrel" ? "Barrel" : "Bin",
    slotLabel,
  );
}

type BarrelPipelineQueryRow = {
  orderItem: {
    id: string;
    quantity: number;
    fulfillmentStatus: string;
    warehouseReceivedCondition?: string | null;
  };
};

async function selectBarrelPipelineOrderItems<
  T extends BarrelPipelineQueryRow,
>(
  buildQuery: (
    orderItemSelect:
      | typeof orderItemBarrelPipelineSelect
      | typeof orderItemBarrelPipelineSelectWithoutWarehouse,
  ) => Promise<T[]>,
): Promise<
  Array<
    T & {
      orderItem: BarrelPipelineQueryRow["orderItem"] & {
        warehouseReceivedCondition: string | null;
      };
    }
  >
> {
  try {
    const rows = await buildQuery(orderItemBarrelPipelineSelect);
    return rows.map((row) => ({
      ...row,
      orderItem: {
        ...row.orderItem,
        warehouseReceivedCondition: row.orderItem.warehouseReceivedCondition ?? null,
      },
    }));
  } catch {
    const rows = await buildQuery(orderItemBarrelPipelineSelectWithoutWarehouse);
    return rows.map((row) => ({
      ...row,
      orderItem: {
        ...row.orderItem,
        warehouseReceivedCondition: null,
      },
    }));
  }
}

export async function listProductToBarrelLinesForUser(
  clerkUserId: string,
): Promise<ProductToBarrelLineRow[]> {
  await backfillOutsidePurchasePaidServiceFeeFulfillment();
  await ensureBarrelsProvisionedForUser(clerkUserId);
  await ensurePackagesForAwaitingBarrelOwner(clerkUserId);
  await ensurePackagesForOutsidePurchasePaidOwner(clerkUserId);
  const inBarrelEnumReady = await ensureInBarrelAwaitingShippingEnumValue();
  await syncBarrelPipelineFulfillmentForOwner(clerkUserId);
  const db = getDb();

  const pipelineStatuses = inBarrelEnumReady ?
    [...PRODUCT_TO_BARREL_FULFILLMENT_STATUSES]
  : [BARREL_PIPELINE_AWAITING_ASSIGNMENT, BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID];

  const base = await selectBarrelPipelineOrderItems(async (orderItemSelect) =>
    db
      .select({
        orderItem: orderItemSelect,
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
          inArray(orderItems.fulfillmentStatus, pipelineStatuses),
        )!,
      )
      .orderBy(desc(orders.createdAt)),
  );

  if (base.length === 0) {
    return [];
  }

  const orderItemIds = base.map((r) => r.orderItem.id);
  const refreshedStatuses = await db
    .select({
      id: orderItems.id,
      fulfillmentStatus: orderItems.fulfillmentStatus,
    })
    .from(orderItems)
    .where(inArray(orderItems.id, orderItemIds));
  const fulfillmentByOrderItemId = new Map(
    refreshedStatuses.map((r) => [r.id, r.fulfillmentStatus] as const),
  );

  const pkgIds = base.map((r) => r.pkg.id);
  const assignments = await db
    .select({
      packageId: barrelItems.packageId,
      barrelId: barrelItems.barrelId,
    })
    .from(barrelItems)
    .where(inArray(barrelItems.packageId, pkgIds));

  const pkgToBarrel = new Map(assignments.map((a) => [a.packageId, a.barrelId]));
  const assignedAtByPackage = await loadLatestAssignmentAtByPackage(pkgIds);

  const barrelOptions = await listUserBarrelOptionsForAssignment(clerkUserId);
  const aliasByBarrelId = new Map(
    barrelOptions.map((o) => [o.barrelId, o.alias] as const),
  );

  return base.map((r) => {
    const bid = pkgToBarrel.get(r.pkg.id) ?? null;
    const fulfillmentStatus =
      fulfillmentByOrderItemId.get(r.orderItem.id) ?? r.orderItem.fulfillmentStatus;
    return {
      orderItemId: r.orderItem.id,
      orderId: r.order.id,
      packageId: r.pkg.id,
      productName: r.request.productName?.trim() || "Unnamed product",
      productImageUrl: r.request.productImageUrl ?? null,
      quantity: r.orderItem.quantity,
      fulfillmentStatus,
      fulfillmentLabel: dashboardOrderLineStatusLabel(fulfillmentStatus, {
        warehouseReceivedCondition: r.orderItem.warehouseReceivedCondition,
      }),
      assignedContainerAlias: bid ? (aliasByBarrelId.get(bid) ?? null) : null,
      assignedAt: bid ? (assignedAtByPackage.get(r.pkg.id) ?? null) : null,
    };
  });
}

async function ensurePackagesForOutsidePurchasePaidAllOwners(): Promise<void> {
  await ensurePaidOutsidePurchaseFulfillmentEnums();
  const db = getDb();
  const owners = await db
    .selectDistinct({ clerkUserId: orders.clerkUserId })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.status, "paid"),
        eq(orderItems.fulfillmentStatus, BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID),
      )!,
    );

  for (const { clerkUserId } of owners) {
    await ensurePackagesForOutsidePurchasePaidOwner(clerkUserId);
  }
}

export async function listAdminBarrelPipelineLines(): Promise<
  AdminBarrelPipelineRow[]
> {
  await backfillOutsidePurchasePaidServiceFeeFulfillment();
  await ensurePackagesForOutsidePurchasePaidAllOwners();

  const inBarrelEnumReady = await ensureInBarrelAwaitingShippingEnumValue();
  const pipelineStatuses = inBarrelEnumReady ?
    [...PRODUCT_TO_BARREL_FULFILLMENT_STATUSES]
  : [BARREL_PIPELINE_AWAITING_ASSIGNMENT, BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID];

  const db = getDb();

  const base = await selectBarrelPipelineOrderItems(async (orderItemSelect) =>
    db
      .select({
        orderItem: orderItemSelect,
        order: orders,
        request: itemRequests,
        pkg: packages,
        biBarrelId: barrelItems.barrelId,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
      .innerJoin(packages, eq(packages.orderItemId, orderItems.id))
      .leftJoin(barrelItems, eq(barrelItems.packageId, packages.id))
      .where(
        and(
          eq(orders.status, "paid"),
          or(
            inArray(orderItems.fulfillmentStatus, pipelineStatuses),
            isNotNull(barrelItems.barrelId),
          ),
        )!,
      )
      .orderBy(desc(orders.createdAt)),
  );

  if (base.length === 0) {
    return [];
  }

  const ownerIds = [...new Set(base.map((r) => r.order.clerkUserId))];
  for (const ownerId of ownerIds) {
    await syncBarrelPipelineFulfillmentForOwner(ownerId);
  }

  const orderItemIds = base.map((r) => r.orderItem.id);
  const refreshedStatuses =
    orderItemIds.length === 0 ?
      []
    : await db
        .select({
          id: orderItems.id,
          fulfillmentStatus: orderItems.fulfillmentStatus,
        })
        .from(orderItems)
        .where(inArray(orderItems.id, orderItemIds));
  const fulfillmentByOrderItemId = new Map(
    refreshedStatuses.map((r) => [r.id, r.fulfillmentStatus] as const),
  );

  const pkgIds = base.map((r) => r.pkg.id);
  const assignedAtByPackage = await loadLatestAssignmentAtByPackage(pkgIds);
  const actorByPackage = await loadLatestActorByPackage(pkgIds);

  const aliasByBarrelId = new Map<string, string>();
  for (const ownerId of ownerIds) {
    const opts = await listUserBarrelOptionsForAssignment(ownerId);
    for (const o of opts) {
      aliasByBarrelId.set(o.barrelId, o.alias);
    }
  }

  return base.map((r) => {
    const bid = r.biBarrelId ?? null;
    const fulfillmentStatus =
      fulfillmentByOrderItemId.get(r.orderItem.id) ?? r.orderItem.fulfillmentStatus;
    return {
      packageId: r.pkg.id,
      orderItemId: r.orderItem.id,
      orderId: r.order.id,
      ownerClerkUserId: r.order.clerkUserId,
      productName: r.request.productName?.trim() || "Unnamed product",
      productImageUrl: r.request.productImageUrl ?? null,
      quantity: r.orderItem.quantity,
      fulfillmentStatus,
      fulfillmentLabel: dashboardOrderLineStatusLabel(fulfillmentStatus, {
        warehouseReceivedCondition: r.orderItem.warehouseReceivedCondition,
      }),
      assignedBarrelId: bid,
      assignedContainerAlias: bid ? (aliasByBarrelId.get(bid) ?? null) : null,
      assignedAt: bid ? (assignedAtByPackage.get(r.pkg.id) ?? null) : null,
      lastUpdatedByClerkUserId: actorByPackage.get(r.pkg.id) ?? null,
    };
  });
}

/** @deprecated Use listAdminBarrelPipelineLines */
export async function listAdminBarrelAssignments(): Promise<AdminBarrelPipelineRow[]> {
  return listAdminBarrelPipelineLines();
}

export type AssignmentHistoryRow = {
  id: string;
  createdAt: string;
  action: (typeof barrelPackageAssignmentEvents.$inferSelect)["action"];
  ownerClerkUserId: string;
  productNameSnapshot: string | null;
  productImageUrl: string | null;
  quantity: number;
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
  const rows = await db
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
      productImageUrl: itemRequests.productImageUrl,
      quantity: orderItems.quantity,
    })
    .from(barrelPackageAssignmentEvents)
    .innerJoin(orderItems, eq(barrelPackageAssignmentEvents.orderItemId, orderItems.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .where(eq(barrelPackageAssignmentEvents.ownerClerkUserId, clerkUserId))
    .orderBy(desc(barrelPackageAssignmentEvents.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    action: r.action,
    ownerClerkUserId: r.ownerClerkUserId,
    productNameSnapshot: r.productNameSnapshot,
    productImageUrl: r.productImageUrl ?? null,
    quantity: r.quantity,
    barrelLabelSnapshot: r.barrelLabelSnapshot,
    fromBarrelId: r.fromBarrelId,
    toBarrelId: r.toBarrelId,
    adminNote: r.adminNote,
    actorClerkUserId: r.actorClerkUserId,
    packageId: r.packageId,
    orderItemId: r.orderItemId,
  }));
}

export async function listBarrelAssignmentHistoryAdmin(
  limit = 500,
): Promise<AssignmentHistoryRow[]> {
  const db = getDb();
  const rows = await db
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
      productImageUrl: itemRequests.productImageUrl,
      quantity: orderItems.quantity,
    })
    .from(barrelPackageAssignmentEvents)
    .innerJoin(orderItems, eq(barrelPackageAssignmentEvents.orderItemId, orderItems.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .orderBy(desc(barrelPackageAssignmentEvents.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    action: r.action,
    ownerClerkUserId: r.ownerClerkUserId,
    productNameSnapshot: r.productNameSnapshot,
    productImageUrl: r.productImageUrl ?? null,
    quantity: r.quantity,
    barrelLabelSnapshot: r.barrelLabelSnapshot,
    fromBarrelId: r.fromBarrelId,
    toBarrelId: r.toBarrelId,
    adminNote: r.adminNote,
    actorClerkUserId: r.actorClerkUserId,
    packageId: r.packageId,
    orderItemId: r.orderItemId,
  }));
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
      orderItemId: orderItems.id,
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
    orderItemId: row.orderItemId,
    currentBarrelId: row.biBarrelId ?? null,
    productName: row.req.productName?.trim() || "Unnamed product",
  };
}

export async function getBarrelLabelById(barrelId: string): Promise<string | null> {
  return getBarrelDisplayLabelById(barrelId);
}
