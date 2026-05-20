import { z } from "zod";

export const userAssignPackageToBarrelSchema = z.object({
  packageId: z.string().uuid(),
  barrelId: z.string().uuid(),
});

export type UserAssignPackageToBarrelInput = z.infer<
  typeof userAssignPackageToBarrelSchema
>;

export const userUnassignPackageFromBarrelSchema = z.object({
  packageId: z.string().uuid(),
});

export type UserUnassignPackageFromBarrelInput = z.infer<
  typeof userUnassignPackageFromBarrelSchema
>;

export const adminReassignPackageBarrelSchema = z.object({
  packageId: z.string().uuid(),
  toBarrelId: z.string().uuid(),
  adminNote: z.string().max(2000).optional(),
});

export type AdminReassignPackageBarrelInput = z.infer<
  typeof adminReassignPackageBarrelSchema
>;

export const adminRemovePackageFromBarrelSchema = z.object({
  packageId: z.string().uuid(),
  adminNote: z.string().max(2000).optional(),
});

export type AdminRemovePackageFromBarrelInput = z.infer<
  typeof adminRemovePackageFromBarrelSchema
>;

export const adminMarkBarrelContainerFullSchema = z.object({
  barrelId: z.string().uuid(),
});

export type AdminMarkBarrelContainerFullInput = z.infer<
  typeof adminMarkBarrelContainerFullSchema
>;

export const adminUnmarkBarrelContainerFullSchema = z.object({
  barrelId: z.string().uuid(),
});

export type AdminUnmarkBarrelContainerFullInput = z.infer<
  typeof adminUnmarkBarrelContainerFullSchema
>;

export const adminUpdateBarrelCapacitySchema = z.object({
  barrelId: z.string().uuid(),
  capacityPercentage: z
    .number()
    .int()
    .min(0)
    .max(100)
    .refine((n) => n % 5 === 0, "Progress must be in 5% steps."),
});

export type AdminUpdateBarrelCapacityInput = z.infer<
  typeof adminUpdateBarrelCapacitySchema
>;
