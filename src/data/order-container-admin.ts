import { and, eq, inArray } from "drizzle-orm";

import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import { getDb } from "@/db";
import { orderContainerItems, orders } from "@/db/schema";
import {
  allocateContainerPackingFeeToLineCents,
  containerPackingPerUnitCentsForKind,
  type ContainerPackingRates,
} from "@/lib/container-packing-fee";
import { isMissingOrderContainerPackagingFeeColumnError } from "@/lib/db-column-missing";
import { parseContainerOfferingKind } from "@/lib/validations/container-offering";

export type OrderContainerLineAdmin = {
  id: string;
  orderId: string;
  nameSnapshot: string;
  sizeSnapshot: string;
  kindSnapshot: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  packagingFeeCents: number;
  packagingPerUnitCents: number;
};

type ContainerRow = {
  id: string;
  orderId: string;
  nameSnapshot: string;
  sizeSnapshot: string;
  kindSnapshot: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  packagingFeeCents: number;
  packagingPerUnitCents: number;
  clerkUserId: string;
};

function toAdminLine(r: ContainerRow): OrderContainerLineAdmin {
  return {
    id: r.id,
    orderId: r.orderId,
    nameSnapshot: r.nameSnapshot,
    sizeSnapshot: r.sizeSnapshot,
    kindSnapshot: r.kindSnapshot,
    quantity: r.quantity,
    unitPriceCents: r.unitPriceCents,
    lineTotalCents: r.lineTotalCents,
    packagingFeeCents: r.packagingFeeCents,
    packagingPerUnitCents: r.packagingPerUnitCents,
  };
}

function applyPackingFallback(
  rows: ContainerRow[],
  ratesByClerkUserId: Map<string, ContainerPackingRates>,
): ContainerRow[] {
  const byOrder = new Map<string, ContainerRow[]>();
  for (const row of rows) {
    const list = byOrder.get(row.orderId) ?? [];
    list.push(row);
    byOrder.set(row.orderId, list);
  }

  const out: ContainerRow[] = [];
  for (const orderRows of byOrder.values()) {
    const barrelCount = orderRows.reduce((sum, r) => {
      return parseContainerOfferingKind(r.kindSnapshot) === "barrel"
        ? sum + r.quantity
        : sum;
    }, 0);
    const binCount = orderRows.reduce((sum, r) => {
      return parseContainerOfferingKind(r.kindSnapshot) === "bin"
        ? sum + r.quantity
        : sum;
    }, 0);
    const clerkUserId = orderRows[0]?.clerkUserId ?? "";
    const rates = ratesByClerkUserId.get(clerkUserId);

    for (const row of orderRows) {
      if (row.packagingFeeCents > 0 || !rates) {
        out.push(row);
        continue;
      }
      const kind = parseContainerOfferingKind(row.kindSnapshot);
      out.push({
        ...row,
        packagingFeeCents: allocateContainerPackingFeeToLineCents({
          kind,
          quantity: row.quantity,
          barrelCount,
          binCount,
          rates,
        }),
        packagingPerUnitCents: containerPackingPerUnitCentsForKind(
          kind,
          barrelCount,
          binCount,
          rates,
        ),
      });
    }
  }
  return out;
}

async function ratesForClerkUserIds(
  clerkUserIds: string[],
): Promise<Map<string, ContainerPackingRates>> {
  const unique = [...new Set(clerkUserIds.filter(Boolean))];
  const map = new Map<string, ContainerPackingRates>();
  await Promise.all(
    unique.map(async (id) => {
      const pricing = await getMerchantPricingForEstimates(id);
      map.set(id, pricing.containerPackingRates);
    }),
  );
  return map;
}

function orderContainerWhere(orderIds: string[], ownerClerkUserId?: string) {
  if (ownerClerkUserId) {
    return and(
      inArray(orderContainerItems.orderId, orderIds),
      eq(orders.clerkUserId, ownerClerkUserId),
    );
  }
  return inArray(orderContainerItems.orderId, orderIds);
}

/**
 * Loads checkout container lines for a set of orders (admin paid orders / history UIs).
 * Pass `ownerClerkUserId` on customer dashboard so only that shopper's orders are returned.
 */
export async function listOrderContainerItemsByOrderIds(
  orderIds: string[],
  options?: { ownerClerkUserId?: string },
): Promise<Map<string, OrderContainerLineAdmin[]>> {
  const map = new Map<string, OrderContainerLineAdmin[]>();
  if (orderIds.length === 0) return map;

  const db = getDb();
  const where = orderContainerWhere(orderIds, options?.ownerClerkUserId);
  let rows: ContainerRow[] = [];
  try {
    rows = await db
      .select({
        id: orderContainerItems.id,
        orderId: orderContainerItems.orderId,
        nameSnapshot: orderContainerItems.nameSnapshot,
        sizeSnapshot: orderContainerItems.sizeSnapshot,
        kindSnapshot: orderContainerItems.kindSnapshot,
        quantity: orderContainerItems.quantity,
        unitPriceCents: orderContainerItems.unitPriceCents,
        lineTotalCents: orderContainerItems.lineTotalCents,
        packagingFeeCents: orderContainerItems.packagingFeeCents,
        packagingPerUnitCents: orderContainerItems.packagingPerUnitCents,
        clerkUserId: orders.clerkUserId,
      })
      .from(orderContainerItems)
      .innerJoin(orders, eq(orderContainerItems.orderId, orders.id))
      .where(where);
  } catch (e) {
    if (!isMissingOrderContainerPackagingFeeColumnError(e)) throw e;
    const legacy = await db
      .select({
        id: orderContainerItems.id,
        orderId: orderContainerItems.orderId,
        nameSnapshot: orderContainerItems.nameSnapshot,
        sizeSnapshot: orderContainerItems.sizeSnapshot,
        kindSnapshot: orderContainerItems.kindSnapshot,
        quantity: orderContainerItems.quantity,
        unitPriceCents: orderContainerItems.unitPriceCents,
        lineTotalCents: orderContainerItems.lineTotalCents,
        clerkUserId: orders.clerkUserId,
      })
      .from(orderContainerItems)
      .innerJoin(orders, eq(orderContainerItems.orderId, orders.id))
      .where(where);
    rows = legacy.map((r) => ({
      ...r,
      packagingFeeCents: 0,
      packagingPerUnitCents: 0,
    }));
  }

  const ratesByClerkUserId = await ratesForClerkUserIds(
    rows.map((r) => r.clerkUserId),
  );
  const withPacking = applyPackingFallback(rows, ratesByClerkUserId);

  for (const r of withPacking) {
    const list = map.get(r.orderId) ?? [];
    list.push(toAdminLine(r));
    map.set(r.orderId, list);
  }
  return map;
}
