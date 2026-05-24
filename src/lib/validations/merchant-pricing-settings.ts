import { z } from "zod";

export const containerPackingRatesSchema = z.object({
  singleBarrelPackingFeeCents: z.number().int().min(0).max(50_000_000),
  multiBarrelPackingPerUnitCents: z.number().int().min(0).max(50_000_000),
  singleBinPackingFeeCents: z.number().int().min(0).max(50_000_000),
  multiBinPackingPerUnitCents: z.number().int().min(0).max(50_000_000),
});

export const merchantPackingCardSaveSchema = z.object({
  packingFeePerLineCents: z.number().int().min(0).max(5_000_000),
  containerPackingRates: containerPackingRatesSchema,
});

const tierRowSchema = z.object({
  maxUnitPriceInclusiveCents: z
    .number()
    .int()
    .min(1)
    .max(2_147_483_647),
  feePerUnitCents: z.number().int().min(0).max(500_000),
});

function refineAscendingTiers(
  val: { tiers: z.infer<typeof tierRowSchema>[] },
  ctx: z.RefinementCtx,
) {
  const sorted = [...val.tiers].sort(
    (a, b) => a.maxUnitPriceInclusiveCents - b.maxUnitPriceInclusiveCents,
  );
  for (let i = 1; i < sorted.length; i++) {
    if (
      sorted[i]!.maxUnitPriceInclusiveCents <=
      sorted[i - 1]!.maxUnitPriceInclusiveCents
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Each tier max unit price (¢) must be greater than the previous tier (strictly ascending).",
        path: ["tiers"],
      });
      return;
    }
  }
}

export const serviceHandlingTiersOnlySchema = z
  .object({
    tiers: z.array(tierRowSchema).min(1).max(32),
  })
  .superRefine(refineAscendingTiers);

export const updateOutsidePurchaseServiceHandlingTiersSchema =
  serviceHandlingTiersOnlySchema;

export const updateMerchantPricingSettingsSchema = z
  .object({
    packingFeePerLineCents: z.number().int().min(0).max(5_000_000),
    containerPackingRates: containerPackingRatesSchema,
    tiers: z.array(tierRowSchema).min(1).max(32),
  })
  .superRefine(refineAscendingTiers);

export type UpdateMerchantPricingSettingsInput = z.infer<
  typeof updateMerchantPricingSettingsSchema
>;

export type MerchantPackingCardSaveInput = z.infer<
  typeof merchantPackingCardSaveSchema
>;
