import { z } from "zod";

import { cargoBoxPackingSizeSchema } from "@/lib/validations/container-offering";

const packingKindSchema = z.enum(["barrel", "bin", "cargo_box"]);

export const adminCreateContainerPackingFeeRecordSchema = z
  .object({
    containerKind: packingKindSchema,
    cargoBoxSize: cargoBoxPackingSizeSchema.optional().nullable(),
    singleFeeCents: z.number().int().min(0).max(50_000_000),
    multiFeeCents: z.number().int().min(0).max(50_000_000),
  })
  .superRefine((data, ctx) => {
    if (data.containerKind === "cargo_box") {
      if (!data.cargoBoxSize) {
        ctx.addIssue({
          code: "custom",
          path: ["cargoBoxSize"],
          message: "Select cargo box size E, EH, or D.",
        });
      }
    } else if (data.cargoBoxSize) {
      ctx.addIssue({
        code: "custom",
        path: ["cargoBoxSize"],
        message: "Cargo box size is only for cargo boxes.",
      });
    }
  });

export type AdminCreateContainerPackingFeeRecordInput = z.infer<
  typeof adminCreateContainerPackingFeeRecordSchema
>;

export const adminUpdateContainerPackingFeeRecordSchema = z.object({
  id: z.string().uuid(),
  singleFeeCents: z.number().int().min(0).max(50_000_000),
  multiFeeCents: z.number().int().min(0).max(50_000_000),
});

export type AdminUpdateContainerPackingFeeRecordInput = z.infer<
  typeof adminUpdateContainerPackingFeeRecordSchema
>;

export const adminSetContainerPackingFeePublishedSchema = z.object({
  id: z.string().uuid(),
  published: z.boolean(),
});

export type AdminSetContainerPackingFeePublishedInput = z.infer<
  typeof adminSetContainerPackingFeePublishedSchema
>;

export const adminDeleteContainerPackingFeeRecordSchema = z.object({
  id: z.string().uuid(),
});

export type AdminDeleteContainerPackingFeeRecordInput = z.infer<
  typeof adminDeleteContainerPackingFeeRecordSchema
>;
