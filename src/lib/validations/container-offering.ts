import { z } from "zod";

export const containerOfferingKindSchema = z.enum([
  "barrel",
  "bin",
  "suitcase",
  "cargo_box",
]);

export type ContainerOfferingKind = z.infer<typeof containerOfferingKindSchema>;

export function containerOfferingKindLabel(kind: ContainerOfferingKind): string {
  switch (kind) {
    case "barrel":
      return "Barrel";
    case "bin":
      return "Bin";
    case "suitcase":
      return "Suitcase";
    case "cargo_box":
      return "Cargo box";
    default: {
      const _x: never = kind;
      return _x;
    }
  }
}

/** Barrels, bins, and cargo boxes use the catalog Publish control (not suitcase specials). */
export function isShopperCatalogContainerKind(
  kind: ContainerOfferingKind,
): boolean {
  return kind === "barrel" || kind === "bin" || kind === "cargo_box";
}

/** Packing fees apply only to barrels and bins. */
export function containerKindChargesPackingFee(
  kind: ContainerOfferingKind,
): boolean {
  return kind === "barrel" || kind === "bin";
}

/** Snapshot / legacy rows: unknown values fall back to barrel. */
export function parseContainerOfferingKind(raw: unknown): ContainerOfferingKind {
  const parsed = containerOfferingKindSchema.safeParse(raw);
  return parsed.success ? parsed.data : "barrel";
}

export const suitcaseSizeOptionSchema = z.enum([
  'Small 20"',
  'Medium 24"',
  'Large 28"',
]);

export type SuitcaseSizeOption = z.infer<typeof suitcaseSizeOptionSchema>;

const optionalCatalogNoteSchema = z.string().trim().max(2000).optional().default("");
const optionalDimensionLabelSchema = z
  .string()
  .trim()
  .max(200)
  .optional()
  .default("");

export const adminCreateContainerOfferingSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    sizeLabel: z.string().trim().max(200).optional().default(""),
    customerNote: optionalCatalogNoteSchema,
    dimensionLabel: optionalDimensionLabelSchema,
    kind: containerOfferingKindSchema,
    /** USD dollars as decimal string or whole number, e.g. "12.99" or "13" */
    priceUsd: z
      .string()
      .trim()
      .min(1)
      .refine((s) => Number.isFinite(Number.parseFloat(s)) && Number.parseFloat(s) >= 0, {
        message: "Enter a valid price.",
      }),
    /** When true, creates suitcase SKU(s) linked to an existing special feature. */
    specialFeatureOffer: z.boolean().optional().default(false),
    /** Existing special feature id when `specialFeatureOffer` is true. */
    specialFeatureOfferId: z.string().uuid().optional(),
    /** Checked suitcase sizes when `specialFeatureOffer` is true. */
    suitcaseSizes: z.array(suitcaseSizeOptionSchema).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.specialFeatureOffer) {
      if (data.kind !== "suitcase") {
        ctx.addIssue({
          code: "custom",
          path: ["kind"],
          message: "Special feature containers must be Suitcase.",
        });
      }
      if (!data.specialFeatureOfferId?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["specialFeatureOfferId"],
          message: "Select a special feature.",
        });
      }
      if (!data.suitcaseSizes?.length) {
        ctx.addIssue({
          code: "custom",
          path: ["suitcaseSizes"],
          message: "Select at least one suitcase size.",
        });
      }
    } else if (!data.sizeLabel?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["sizeLabel"],
        message: "Enter a size label.",
      });
    }
    if (!data.specialFeatureOffer && data.kind === "cargo_box" && !data.dimensionLabel?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["dimensionLabel"],
        message: "Enter cargo box dimensions.",
      });
    }
  });

export type AdminCreateContainerOfferingInput = z.infer<
  typeof adminCreateContainerOfferingSchema
>;

export const adminUpdateContainerOfferingSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    sizeLabel: z.string().trim().min(1).max(200),
    customerNote: optionalCatalogNoteSchema,
    dimensionLabel: optionalDimensionLabelSchema,
    kind: containerOfferingKindSchema,
    priceUsd: z
      .string()
      .trim()
      .min(1)
      .refine((s) => Number.isFinite(Number.parseFloat(s)) && Number.parseFloat(s) >= 0, {
        message: "Enter a valid price.",
      }),
    isActive: z.boolean(),
    specialFeatureOfferId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "cargo_box" && !data.dimensionLabel?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["dimensionLabel"],
        message: "Enter cargo box dimensions.",
      });
    }
  });

export type AdminUpdateContainerOfferingInput = z.infer<
  typeof adminUpdateContainerOfferingSchema
>;

export const adminSetContainerOfferingPublishedSchema = z.object({
  offeringId: z.string().uuid(),
  published: z.boolean(),
});

export type AdminSetContainerOfferingPublishedInput = z.infer<
  typeof adminSetContainerOfferingPublishedSchema
>;

export function priceUsdStringToCents(usd: string): number {
  const n = Number.parseFloat(usd.trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export const userContainerCartMutationSchema = z.object({
  offeringId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(99),
});

export type UserContainerCartMutationInput = z.infer<
  typeof userContainerCartMutationSchema
>;
