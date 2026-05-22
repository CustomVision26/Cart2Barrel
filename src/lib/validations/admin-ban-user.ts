import { z } from "zod";

export const adminBanUserSchema = z.object({
  targetClerkUserId: z
    .string()
    .trim()
    .min(1, "User is required.")
    .max(128, "Invalid user id."),
});

export type AdminBanUserInput = z.infer<typeof adminBanUserSchema>;
