"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";

import { getDb } from "@/db";
import {
  merchantPackingFeeSettings,
  serviceHandlingFeeTiers,
} from "@/db/schema";
import type { ContainerPackingRates } from "@/lib/container-packing-fee";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  merchantPackingCardSaveSchema,
  updateMerchantPricingSettingsSchema,
} from "@/lib/validations/merchant-pricing-settings";

export type UpdateMerchantPricingSettingsState =
  | { ok: true; message: string }
  | { ok: false; message: string };

async function upsertMerchantPackingRow(params: {
  packingFeePerLineCents: number;
  containerPackingRates: ContainerPackingRates;
}): Promise<void> {
  const db = getDb();
  const { containerPackingRates: r } = params;
  const [existing] = await db
    .select({ k: merchantPackingFeeSettings.singletonKey })
    .from(merchantPackingFeeSettings)
    .where(eq(merchantPackingFeeSettings.singletonKey, "default"))
    .limit(1);

  const values = {
    packingFeePerLineCents: params.packingFeePerLineCents,
    barrelShippingFeeCents: r.singleBarrelPackingFeeCents,
    binShippingFeeCents: r.singleBinPackingFeeCents,
    multiBarrelPackingPerUnitCents: r.multiBarrelPackingPerUnitCents,
    multiBinPackingPerUnitCents: r.multiBinPackingPerUnitCents,
    updatedAt: sql`now()`,
  };

  if (existing) {
    await db
      .update(merchantPackingFeeSettings)
      .set(values)
      .where(eq(merchantPackingFeeSettings.singletonKey, "default"));
  } else {
    await db.insert(merchantPackingFeeSettings).values({
      singletonKey: "default",
      ...values,
    });
  }
}

/** Saves flat packing per line + per-kind container packing rates. Service tiers unchanged. */
export async function updateMerchantPackingBarrelFeesAction(
  raw: unknown,
): Promise<UpdateMerchantPricingSettingsState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = merchantPackingCardSaveSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid fee data.";
    return { ok: false, message: first };
  }

  const d = parsed.data;
  try {
    await upsertMerchantPackingRow({
      packingFeePerLineCents: d.packingFeePerLineCents,
      containerPackingRates: d.containerPackingRates,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save settings.";
    return {
      ok: false,
      message:
        msg.includes("merchant_packing_fee_settings") ||
        msg.includes("multi_barrel_packing") ||
        msg.includes("multi_bin_packing")
          ? "Database is missing packing columns. Run migration 0036 or npm run db:push, then try again."
          : msg,
    };
  }

  revalidatePath("/admin/overview");
  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard/barrels");
  return { ok: true, message: "Packing and container fees saved." };
}

export async function updateMerchantPricingSettingsAction(
  raw: unknown,
): Promise<UpdateMerchantPricingSettingsState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = updateMerchantPricingSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid pricing data.";
    return { ok: false, message: first };
  }

  const { packingFeePerLineCents, containerPackingRates, tiers } = parsed.data;
  const sorted = [...tiers].sort(
    (a, b) => a.maxUnitPriceInclusiveCents - b.maxUnitPriceInclusiveCents,
  );

  const db = getDb();
  try {
    await db.delete(serviceHandlingFeeTiers);
    await db.insert(serviceHandlingFeeTiers).values(
      sorted.map((t, i) => ({
        maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
        feePerUnitCents: t.feePerUnitCents,
        sortIndex: i + 1,
      })),
    );

    await upsertMerchantPackingRow({
      packingFeePerLineCents,
      containerPackingRates,
    });

    revalidatePath("/admin/overview");
    revalidatePath("/admin/item-requests", "layout");
    revalidatePath("/dashboard/cart");
    revalidatePath("/dashboard/barrels");
    return { ok: true, message: "Pricing settings saved." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save settings.";
    return {
      ok: false,
      message:
        msg.includes("service_handling_fee_tiers") ||
        msg.includes("merchant_packing_fee_settings")
          ? "Database is missing pricing tables or columns. Run migrations (0032–0036) or npm run db:push, then try again."
          : msg,
    };
  }
}
