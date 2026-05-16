"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";

import { getDb } from "@/db";
import {
  merchantPackingComboFees,
  merchantPackingFeeSettings,
  serviceHandlingFeeTiers,
} from "@/db/schema";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  merchantPackingCardSaveSchema,
  updateMerchantPricingSettingsSchema,
} from "@/lib/validations/merchant-pricing-settings";

export type UpdateMerchantPricingSettingsState =
  | { ok: true; message: string }
  | { ok: false; message: string };

async function replaceMerchantPackingComboRows(
  combos: { barrelCount: number; binCount: number; feeCents: number }[],
): Promise<void> {
  const db = getDb();
  await db.delete(merchantPackingComboFees);
  if (combos.length === 0) return;
  await db.insert(merchantPackingComboFees).values(
    combos.map((c, i) => ({
      barrelCount: c.barrelCount,
      binCount: c.binCount,
      feeCents: c.feeCents,
      sortIndex: i + 1,
    })),
  );
}

/** Clears legacy per-kind columns; combo table is the source of truth for container mixes. */
async function upsertMerchantPackingRow(params: {
  packingFeePerLineCents: number;
}): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select({ k: merchantPackingFeeSettings.singletonKey })
    .from(merchantPackingFeeSettings)
    .where(eq(merchantPackingFeeSettings.singletonKey, "default"))
    .limit(1);

  if (existing) {
    await db
      .update(merchantPackingFeeSettings)
      .set({
        packingFeePerLineCents: params.packingFeePerLineCents,
        barrelShippingFeeCents: 0,
        binShippingFeeCents: 0,
        updatedAt: sql`now()`,
      })
      .where(eq(merchantPackingFeeSettings.singletonKey, "default"));
  } else {
    await db.insert(merchantPackingFeeSettings).values({
      singletonKey: "default",
      packingFeePerLineCents: params.packingFeePerLineCents,
      barrelShippingFeeCents: 0,
      binShippingFeeCents: 0,
    });
  }
}

/** Saves flat packing per line + manual (barrel × bin) combination fees. Service tiers unchanged. */
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
    await replaceMerchantPackingComboRows(d.combos);
    await upsertMerchantPackingRow({
      packingFeePerLineCents: d.packingFeePerLineCents,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save settings.";
    return {
      ok: false,
      message:
        msg.includes("merchant_packing_fee_settings") ||
        msg.includes("merchant_packing_combo_fees")
          ? "Database is missing packing tables or columns. Run migrations (0034–0035) or npm run db:push, then try again."
          : msg,
    };
  }

  revalidatePath("/admin/overview");
  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard/barrels");
  return { ok: true, message: "Packing and combination fees saved." };
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

  const { packingFeePerLineCents, combos, tiers } = parsed.data;
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

    await replaceMerchantPackingComboRows(combos);
    await upsertMerchantPackingRow({ packingFeePerLineCents });

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
        msg.includes("merchant_packing_fee_settings") ||
        msg.includes("merchant_packing_combo_fees")
          ? "Database is missing pricing tables or columns. Run migrations (0032–0035) or npm run db:push, then try again."
          : msg,
    };
  }
}
