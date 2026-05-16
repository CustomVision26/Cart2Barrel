import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  merchantPackingComboFees,
  merchantPackingFeeSettings,
  serviceHandlingFeeTiers,
} from "@/db/schema";
import {
  DEFAULT_MERCHANT_SERVICE_TIERS,
  type MerchantServiceTierRow,
} from "@/lib/admin-markup";
import type { PackingComboFeeRow } from "@/lib/merchant-packing-combo-fee";

export type MerchantPackingComboAdminRow = {
  id: number;
  barrelCount: number;
  binCount: number;
  feeCents: number;
  sortIndex: number;
};

export type MerchantPricingEstimateSnapshot = {
  packingFeePerLineCents: number;
  packingComboFees: PackingComboFeeRow[];
  serviceTiers: MerchantServiceTierRow[];
};

const PACK_KEY = "default" as const;

async function loadPackingComboFeesForEstimates(): Promise<PackingComboFeeRow[]> {
  const db = getDb();
  try {
    const rows = await db
      .select({
        barrelCount: merchantPackingComboFees.barrelCount,
        binCount: merchantPackingComboFees.binCount,
        feeCents: merchantPackingComboFees.feeCents,
      })
      .from(merchantPackingComboFees)
      .orderBy(asc(merchantPackingComboFees.sortIndex));
    return rows.map((r) => ({
      barrelCount: r.barrelCount,
      binCount: r.binCount,
      feeCents: r.feeCents,
    }));
  } catch {
    return [];
  }
}

/**
 * Tiers + packing used for staff quotes and AI estimate previews. Falls back to code
 * defaults if tables are empty (e.g. before migration).
 */
export async function getMerchantPricingForEstimates(): Promise<MerchantPricingEstimateSnapshot> {
  const db = getDb();
  try {
    const [packRow] = await db
      .select()
      .from(merchantPackingFeeSettings)
      .where(eq(merchantPackingFeeSettings.singletonKey, PACK_KEY))
      .limit(1);

    const tierRows = await db
      .select({
        maxUnitPriceInclusiveCents:
          serviceHandlingFeeTiers.maxUnitPriceInclusiveCents,
        feePerUnitCents: serviceHandlingFeeTiers.feePerUnitCents,
      })
      .from(serviceHandlingFeeTiers)
      .orderBy(asc(serviceHandlingFeeTiers.sortIndex));

    const packingFeePerLineCents = Math.max(
      0,
      packRow?.packingFeePerLineCents ?? 0,
    );
    const packingComboFees = await loadPackingComboFeesForEstimates();

    if (tierRows.length === 0) {
      return {
        packingFeePerLineCents,
        packingComboFees,
        serviceTiers: [...DEFAULT_MERCHANT_SERVICE_TIERS],
      };
    }

    return {
      packingFeePerLineCents,
      packingComboFees,
      serviceTiers: tierRows.map((r) => ({
        maxUnitPriceInclusiveCents: r.maxUnitPriceInclusiveCents,
        feePerUnitCents: r.feePerUnitCents,
      })),
    };
  } catch {
    return {
      packingFeePerLineCents: 0,
      packingComboFees: [],
      serviceTiers: [...DEFAULT_MERCHANT_SERVICE_TIERS],
    };
  }
}

export type MerchantPricingAdminRow = {
  packingFeePerLineCents: number;
  combos: MerchantPackingComboAdminRow[];
  tiers: { id: number; maxUnitPriceInclusiveCents: number; feePerUnitCents: number; sortIndex: number }[];
};

export async function getMerchantPricingForAdminEditor(): Promise<MerchantPricingAdminRow> {
  const snap = await getMerchantPricingForEstimates();
  const db = getDb();
  let combos: MerchantPackingComboAdminRow[] = [];
  try {
    combos = await db
      .select()
      .from(merchantPackingComboFees)
      .orderBy(asc(merchantPackingComboFees.sortIndex));
  } catch {
    combos = [];
  }

  try {
    const fullTiers = await db
      .select()
      .from(serviceHandlingFeeTiers)
      .orderBy(asc(serviceHandlingFeeTiers.sortIndex));
    if (fullTiers.length === 0) {
      return {
        packingFeePerLineCents: snap.packingFeePerLineCents,
        combos,
        tiers: DEFAULT_MERCHANT_SERVICE_TIERS.map((t, i) => ({
          id: -(i + 1),
          maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
          feePerUnitCents: t.feePerUnitCents,
          sortIndex: i + 1,
        })),
      };
    }
    return {
      packingFeePerLineCents: snap.packingFeePerLineCents,
      combos,
      tiers: fullTiers.map((r) => ({
        id: r.id,
        maxUnitPriceInclusiveCents: r.maxUnitPriceInclusiveCents,
        feePerUnitCents: r.feePerUnitCents,
        sortIndex: r.sortIndex,
      })),
    };
  } catch {
    return {
      packingFeePerLineCents: snap.packingFeePerLineCents,
      combos,
      tiers: DEFAULT_MERCHANT_SERVICE_TIERS.map((t, i) => ({
        id: -(i + 1),
        maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
        feePerUnitCents: t.feePerUnitCents,
        sortIndex: i + 1,
      })),
    };
  }
}
