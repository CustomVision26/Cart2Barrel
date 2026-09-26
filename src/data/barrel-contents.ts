import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  barrelItems,
  barrels,
  itemRequests,
  orderContainerItems,
  orderItems,
  packages,
} from "@/db/schema";
import { listItemQuotesForOwnerByRequestIds } from "@/data/item-quotes";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import {
  clampBarrelContentUnitsPerPack,
  type BarrelContentItem,
  type BarrelContentsRecord,
} from "@/lib/barrel-contents";
import { isOperationalQuoteRow } from "@/lib/checkout-snapshot-kind";
import {
  inferUnitsPerPackFromCheckoutService,
  inferUnitsPerPackFromProductLabel,
} from "@/lib/merchandise-reconciliation";
import { parseOutsidePurchaseUnitsPerPackFromStaffNote } from "@/lib/outside-purchase-service-quote";
import { formatBarrelSlotLabel } from "@/lib/barrel-slot-label";
import { parseContainerOfferingKind } from "@/lib/validations/container-offering";
import type { MerchantServiceTierRow } from "@/lib/admin-markup";

function resolveUnitsPerPack(params: {
  productName: string;
  productSize: string | null;
  quantity: number;
  quoteItemCostCents: number | null;
  quoteServiceFeeCents: number | null;
  quoteStaffNote: string | null;
  serviceTiers: readonly MerchantServiceTierRow[] | null;
}): number {
  const fromNote = parseOutsidePurchaseUnitsPerPackFromStaffNote(
    params.quoteStaffNote,
  );
  if (fromNote != null) return clampBarrelContentUnitsPerPack(fromNote);

  const fromQuote = inferUnitsPerPackFromCheckoutService({
    packCount: params.quantity,
    checkoutMerchandiseCents: params.quoteItemCostCents ?? 0,
    checkoutServiceCents: params.quoteServiceFeeCents ?? 0,
    serviceTiers: params.serviceTiers,
  });
  if (fromQuote) return clampBarrelContentUnitsPerPack(fromQuote);

  const fromLabel = inferUnitsPerPackFromProductLabel(
    [params.productName, params.productSize].filter(Boolean).join(" "),
  );
  return clampBarrelContentUnitsPerPack(fromLabel);
}

export async function getBarrelContentsByBarrelIds(
  clerkUserId: string,
  barrelIds: string[],
): Promise<Map<string, BarrelContentItem[]>> {
  const byBarrel = new Map<string, BarrelContentItem[]>();
  if (barrelIds.length === 0) return byBarrel;

  const db = getDb();
  const rows = await db
    .select({
      barrelId: barrelItems.barrelId,
      packageId: packages.id,
      productName: itemRequests.productName,
      productImageUrl: itemRequests.productImageUrl,
      productSize: itemRequests.productSize,
      productColor: itemRequests.productColor,
      itemRequestId: itemRequests.id,
      quantity: orderItems.quantity,
      linePriceCents: orderItems.price,
    })
    .from(barrelItems)
    .innerJoin(barrels, eq(barrelItems.barrelId, barrels.id))
    .innerJoin(packages, eq(barrelItems.packageId, packages.id))
    .innerJoin(orderItems, eq(packages.orderItemId, orderItems.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .where(
      and(
        eq(barrels.clerkUserId, clerkUserId),
        inArray(barrelItems.barrelId, barrelIds),
      )!,
    )
    .orderBy(asc(itemRequests.productName), asc(packages.id));

  if (rows.length === 0) return byBarrel;

  const requestIds = [...new Set(rows.map((row) => row.itemRequestId))];
  const [pricing, quotes] = await Promise.all([
    getMerchantPricingForEstimates(clerkUserId),
    listItemQuotesForOwnerByRequestIds(clerkUserId, requestIds),
  ]);
  const latestQuoteByRequest = new Map<string, (typeof quotes)[number]>();
  for (const quote of quotes) {
    if (quote.voidedAt || !isOperationalQuoteRow(quote)) continue;
    if (!latestQuoteByRequest.has(quote.itemRequestId)) {
      latestQuoteByRequest.set(quote.itemRequestId, quote);
    }
  }

  for (const row of rows) {
    const quote = latestQuoteByRequest.get(row.itemRequestId);
    const list = byBarrel.get(row.barrelId) ?? [];
    const productName = row.productName?.trim() || "Unnamed product";
    const productSize = row.productSize?.trim() || null;
    list.push({
      packageId: row.packageId,
      productName,
      productImageUrl: row.productImageUrl?.trim() || null,
      productSize,
      productColor: row.productColor?.trim() || null,
      quantity: row.quantity,
      unitsPerPack: resolveUnitsPerPack({
        productName,
        productSize,
        quantity: row.quantity,
        quoteItemCostCents: quote?.itemCost ?? null,
        quoteServiceFeeCents: quote?.serviceFee ?? null,
        quoteStaffNote: quote?.staffNote ?? null,
        serviceTiers: pricing.serviceTiers,
      }),
      linePriceCents: row.linePriceCents,
    });
    byBarrel.set(row.barrelId, list);
  }

  return byBarrel;
}

export async function getBarrelContentsRecordForUser(
  clerkUserId: string,
  barrelId: string,
): Promise<BarrelContentsRecord | null> {
  const db = getDb();
  const [row] = await db
    .select({
      barrel: barrels,
      oci: orderContainerItems,
    })
    .from(barrels)
    .leftJoin(
      orderContainerItems,
      eq(barrels.orderContainerItemId, orderContainerItems.id),
    )
    .where(and(eq(barrels.id, barrelId), eq(barrels.clerkUserId, clerkUserId))!)
    .limit(1);

  if (!row) return null;

  const kind = parseContainerOfferingKind(row.oci?.kindSnapshot ?? "barrel");
  const alias = kind === "barrel" ? "Barrel" : "Bin";
  const slotLabel =
    row.oci ?
      formatBarrelSlotLabel({
        nameSnapshot: row.oci.nameSnapshot,
        sizeSnapshot: row.oci.sizeSnapshot,
        unitOrdinal: row.barrel.unitOrdinal,
      })
    : alias;
  const containerName = row.oci?.nameSnapshot.trim() || alias;
  const contentsByBarrel = await getBarrelContentsByBarrelIds(clerkUserId, [
    barrelId,
  ]);

  return {
    barrelId,
    containerName,
    containerAlias: alias,
    slotLabel,
    items: contentsByBarrel.get(barrelId) ?? [],
  };
}
