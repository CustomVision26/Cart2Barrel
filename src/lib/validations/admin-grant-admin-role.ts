import { z } from "zod";

export const grantAdminRoleSchema = z.object({
  targetClerkUserId: z
    .string()
    .trim()
    .min(1, "Select a user.")
    .max(128, "Invalid user id."),
});

export type GrantAdminRoleInput = z.infer<typeof grantAdminRoleSchema>;
