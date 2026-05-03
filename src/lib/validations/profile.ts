import { z } from "zod";

import { JAMAICA_PARISHES } from "@/lib/parishes";

const parishList = JAMAICA_PARISHES as readonly string[];

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
  addressLine1: z
    .string()
    .trim()
    .min(3, "Enter street address or P.O. details")
    .max(300, "Address line is too long"),
  addressLine2: z.string().trim().max(300, "Address line is too long").optional(),
  cityOrTown: z
    .string()
    .trim()
    .min(2, "Enter city or town")
    .max(120, "City or town is too long"),
  parish: z
    .string()
    .min(1, "Select a parish")
    .refine((p) => parishList.includes(p), { message: "Select a valid parish" }),
});

export type ProfileFormInput = z.infer<typeof profileFormSchema>;
