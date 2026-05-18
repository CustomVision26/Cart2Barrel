import { z } from "zod";

import { containerPackingRatesSchema } from "@/lib/validations/merchant-pricing-settings";

const tierRowSchema = z.object({
  maxUnitPriceInclusiveCents: z
    .number()
    .int()
    .min(1)
    .max(2_147_483_647),
  feePerUnitCents: z.number().int().min(0).max(500_000),
});

export const saveCustomerPricingPackageSchema = z
  .object({
    clerkUserId: z.string().min(1).max(256),
    label: z.string().max(120).optional().nullable(),
    packingFeePerLineCents: z.number().int().min(0).max(5_000_000),
    containerPackingRates: containerPackingRatesSchema,
    overrideServiceTiers: z.boolean(),
    tiers: z.array(tierRowSchema).max(32),
  })
  .superRefine((val, ctx) => {
    if (!val.overrideServiceTiers) return;
    if (val.tiers.length < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Add at least one service & handling tier when overriding.",
        path: ["tiers"],
      });
      return;
    }
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
            "Each tier max unit price (¢) must be greater than the previous tier.",
          path: ["tiers"],
        });
        return;
      }
    }
  });

export type SaveCustomerPricingPackageInput = z.infer<
  typeof saveCustomerPricingPackageSchema
>;

export const deleteCustomerPricingPackageSchema = z.object({
  clerkUserId: z.string().min(1).max(256),
});
