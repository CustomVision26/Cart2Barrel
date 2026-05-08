import { z } from "zod";

export const profileFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name")
    .max(200, "Name is too long"),
  phone: z
    .string()
    .trim()
    .min(10, "Enter a valid phone number")
    .max(32, "Phone number is too long"),
});

export type ProfileFormInput = z.infer<typeof profileFormSchema>;
