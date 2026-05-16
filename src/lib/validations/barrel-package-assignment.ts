import { z } from "zod";

export const userAssignPackageToBarrelSchema = z.object({
  packageId: z.string().uuid(),
  barrelId: z.string().uuid(),
});

export type UserAssignPackageToBarrelInput = z.infer<
  typeof userAssignPackageToBarrelSchema
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
