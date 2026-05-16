import { z } from "zod";

const packingComboRowSchema = z.object({
  barrelCount: z.number().int().min(0).max(99_999),
  binCount: z.number().int().min(0).max(99_999),
  feeCents: z.number().int().min(0).max(50_000_000),
});

function refinePackingCombos(
  combos: z.infer<typeof packingComboRowSchema>[],
  ctx: z.RefinementCtx,
  pathPrefix: (string | number)[],
) {
  const seen = new Set<string>();
  for (let i = 0; i < combos.length; i++) {
    const c = combos[i]!;
    if (c.barrelCount + c.binCount < 1) {
      ctx.addIssue({
        code: "custom",
        message:
          "Each combination must include at least one container (barrels or bins > 0).",
        path: [...pathPrefix, i, "barrelCount"],
      });
      return;
    }
    const key = `${c.barrelCount},${c.binCount}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate combination (${c.barrelCount} barrel(s), ${c.binCount} bin(s)). Each mix may appear only once.`,
        path: [...pathPrefix],
      });
      return;
    }
    seen.add(key);
  }
}

export const merchantPackingCardSaveSchema = z
  .object({
    packingFeePerLineCents: z.number().int().min(0).max(5_000_000),
    combos: z.array(packingComboRowSchema).max(128),
  })
  .superRefine((val, ctx) => {
    refinePackingCombos(val.combos, ctx, ["combos"]);
  });

const tierRowSchema = z.object({
  maxUnitPriceInclusiveCents: z
    .number()
    .int()
    .min(1)
    .max(2_147_483_647),
  feePerUnitCents: z.number().int().min(0).max(500_000),
});

export const updateMerchantPricingSettingsSchema = z
  .object({
    packingFeePerLineCents: z.number().int().min(0).max(5_000_000),
    combos: z.array(packingComboRowSchema).max(128),
    tiers: z.array(tierRowSchema).min(1).max(32),
  })
  .superRefine((val, ctx) => {
    refinePackingCombos(val.combos, ctx, ["combos"]);
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
  });

export type UpdateMerchantPricingSettingsInput = z.infer<
  typeof updateMerchantPricingSettingsSchema
>;

export type MerchantPackingCardSaveInput = z.infer<
  typeof merchantPackingCardSaveSchema
>;
