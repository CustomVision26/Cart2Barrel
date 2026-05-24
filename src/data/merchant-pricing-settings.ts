import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  merchantPackingFeeSettings,
  outsidePurchaseServiceHandlingFeeTiers,
  serviceHandlingFeeTiers,
} from "@/db/schema";
import { getCustomerPricingPackage } from "@/data/customer-pricing-packages";
import {
  DEFAULT_MERCHANT_SERVICE_TIERS,
  type MerchantServiceTierRow,
} from "@/lib/admin-markup";
import {
  DEFAULT_CONTAINER_PACKING_RATES,
  mergeContainerPackingRates,
  withDefaultContainerPackingRates,
  type ContainerPackingRates,
} from "@/lib/container-packing-fee";

export type MerchantPricingEstimateSnapshot = {
  packingFeePerLineCents: number;
  containerPackingRates: ContainerPackingRates;
  serviceTiers: MerchantServiceTierRow[];
  outsidePurchaseServiceTiers: MerchantServiceTierRow[];
};

const PACK_KEY = "default" as const;

function packRowToContainerRates(
  packRow: typeof merchantPackingFeeSettings.$inferSelect | undefined,
): ContainerPackingRates {
  if (!packRow) return { ...DEFAULT_CONTAINER_PACKING_RATES };
  return withDefaultContainerPackingRates({
    singleBarrelPackingFeeCents: Math.max(0, packRow.barrelShippingFeeCents),
    multiBarrelPackingPerUnitCents: Math.max(
      0,
      packRow.multiBarrelPackingPerUnitCents ??
        DEFAULT_CONTAINER_PACKING_RATES.multiBarrelPackingPerUnitCents,
    ),
    singleBinPackingFeeCents: Math.max(0, packRow.binShippingFeeCents),
    multiBinPackingPerUnitCents: Math.max(
      0,
      packRow.multiBinPackingPerUnitCents ??
        DEFAULT_CONTAINER_PACKING_RATES.multiBinPackingPerUnitCents,
    ),
  });
}

/**
 * Tiers + packing used for staff quotes and cart. Falls back to code defaults if tables
 * are empty (e.g. before migration).
 */
export async function getMerchantPricingForEstimates(
  clerkUserId?: string | null,
): Promise<MerchantPricingEstimateSnapshot> {
  const global = await loadGlobalMerchantPricing();
  if (!clerkUserId?.trim()) return global;

  const custom = await getCustomerPricingPackage(clerkUserId.trim());
  if (!custom) return global;

  return {
    packingFeePerLineCents:
      custom.packingFeePerLineCents > 0 ?
        custom.packingFeePerLineCents
      : global.packingFeePerLineCents,
    containerPackingRates: withDefaultContainerPackingRates(
      mergeContainerPackingRates(custom.containerPackingRates, global.containerPackingRates),
    ),
    serviceTiers: custom.serviceTiers ?? global.serviceTiers,
    outsidePurchaseServiceTiers: global.outsidePurchaseServiceTiers,
  };
}

async function loadGlobalMerchantPricing(): Promise<MerchantPricingEstimateSnapshot> {
  const db = getDb();
  try {
    const [packRow, tierRows, outsideTierRows] = await Promise.all([
      db
        .select()
        .from(merchantPackingFeeSettings)
        .where(eq(merchantPackingFeeSettings.singletonKey, PACK_KEY))
        .limit(1)
        .then((rows) => rows[0]),
      db
        .select({
          maxUnitPriceInclusiveCents:
            serviceHandlingFeeTiers.maxUnitPriceInclusiveCents,
          feePerUnitCents: serviceHandlingFeeTiers.feePerUnitCents,
        })
        .from(serviceHandlingFeeTiers)
        .orderBy(asc(serviceHandlingFeeTiers.sortIndex)),
      db
        .select({
          maxUnitPriceInclusiveCents:
            outsidePurchaseServiceHandlingFeeTiers.maxUnitPriceInclusiveCents,
          feePerUnitCents:
            outsidePurchaseServiceHandlingFeeTiers.feePerUnitCents,
        })
        .from(outsidePurchaseServiceHandlingFeeTiers)
        .orderBy(asc(outsidePurchaseServiceHandlingFeeTiers.sortIndex)),
    ]);

    const packingFeePerLineCents = Math.max(
      0,
      packRow?.packingFeePerLineCents ?? 0,
    );
    const containerPackingRates = packRowToContainerRates(packRow);
    const serviceTiers =
      tierRows.length === 0 ?
        [...DEFAULT_MERCHANT_SERVICE_TIERS]
      : tierRows.map((r) => ({
          maxUnitPriceInclusiveCents: r.maxUnitPriceInclusiveCents,
          feePerUnitCents: r.feePerUnitCents,
        }));
    const outsidePurchaseServiceTiers =
      outsideTierRows.length === 0 ?
        [...DEFAULT_MERCHANT_SERVICE_TIERS]
      : outsideTierRows.map((r) => ({
          maxUnitPriceInclusiveCents: r.maxUnitPriceInclusiveCents,
          feePerUnitCents: r.feePerUnitCents,
        }));

    return {
      packingFeePerLineCents,
      containerPackingRates,
      serviceTiers,
      outsidePurchaseServiceTiers,
    };
  } catch {
    return {
      packingFeePerLineCents: 0,
      containerPackingRates: { ...DEFAULT_CONTAINER_PACKING_RATES },
      serviceTiers: [...DEFAULT_MERCHANT_SERVICE_TIERS],
      outsidePurchaseServiceTiers: [...DEFAULT_MERCHANT_SERVICE_TIERS],
    };
  }
}

export type MerchantPricingAdminRow = {
  packingFeePerLineCents: number;
  containerPackingRates: ContainerPackingRates;
  tiers: { id: number; maxUnitPriceInclusiveCents: number; feePerUnitCents: number; sortIndex: number }[];
  outsidePurchaseTiers: {
    id: number;
    maxUnitPriceInclusiveCents: number;
    feePerUnitCents: number;
    sortIndex: number;
  }[];
};

/** Tier ladder for outside-purchase intake quotes (customer-shipped products). */
export async function getOutsidePurchaseServiceTiersForEstimates(): Promise<
  MerchantServiceTierRow[]
> {
  const global = await loadGlobalMerchantPricing();
  return global.outsidePurchaseServiceTiers;
}

export async function getMerchantPricingForAdminEditor(): Promise<MerchantPricingAdminRow> {
  const snap = await getMerchantPricingForEstimates();
  const db = getDb();

  try {
    const [fullTiers, fullOutsideTiers] = await Promise.all([
      db
        .select()
        .from(serviceHandlingFeeTiers)
        .orderBy(asc(serviceHandlingFeeTiers.sortIndex)),
      db
        .select()
        .from(outsidePurchaseServiceHandlingFeeTiers)
        .orderBy(asc(outsidePurchaseServiceHandlingFeeTiers.sortIndex)),
    ]);

    const outsidePurchaseTiers =
      fullOutsideTiers.length === 0
        ? DEFAULT_MERCHANT_SERVICE_TIERS.map((t, i) => ({
            id: -(i + 1),
            maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
            feePerUnitCents: t.feePerUnitCents,
            sortIndex: i + 1,
          }))
        : fullOutsideTiers.map((r) => ({
            id: r.id,
            maxUnitPriceInclusiveCents: r.maxUnitPriceInclusiveCents,
            feePerUnitCents: r.feePerUnitCents,
            sortIndex: r.sortIndex,
          }));

    if (fullTiers.length === 0) {
      return {
        packingFeePerLineCents: snap.packingFeePerLineCents,
        containerPackingRates: snap.containerPackingRates,
        tiers: DEFAULT_MERCHANT_SERVICE_TIERS.map((t, i) => ({
          id: -(i + 1),
          maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
          feePerUnitCents: t.feePerUnitCents,
          sortIndex: i + 1,
        })),
        outsidePurchaseTiers,
      };
    }
    return {
      packingFeePerLineCents: snap.packingFeePerLineCents,
      containerPackingRates: snap.containerPackingRates,
      tiers: fullTiers.map((r) => ({
        id: r.id,
        maxUnitPriceInclusiveCents: r.maxUnitPriceInclusiveCents,
        feePerUnitCents: r.feePerUnitCents,
        sortIndex: r.sortIndex,
      })),
      outsidePurchaseTiers,
    };
  } catch {
    return {
      packingFeePerLineCents: snap.packingFeePerLineCents,
      containerPackingRates: snap.containerPackingRates,
      tiers: DEFAULT_MERCHANT_SERVICE_TIERS.map((t, i) => ({
        id: -(i + 1),
        maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
        feePerUnitCents: t.feePerUnitCents,
        sortIndex: i + 1,
      })),
      outsidePurchaseTiers: DEFAULT_MERCHANT_SERVICE_TIERS.map((t, i) => ({
        id: -(i + 1),
        maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
        feePerUnitCents: t.feePerUnitCents,
        sortIndex: i + 1,
      })),
    };
  }
}
