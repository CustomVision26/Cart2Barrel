import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v === "" ? null : v));

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v === "" ? null : v));

const optionalLongText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v === "" ? null : v));

export const updateHubContactSettingsSchema = z.object({
  supportEmail: optionalText,
  supportPhone: optionalText,
  whatsAppNumber: optionalText,
  instagramUrl: optionalUrl,
  facebookUrl: optionalUrl,
  xUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  businessHours: optionalLongText,
  publicIntro: optionalLongText,
});

export type UpdateHubContactSettingsInput = z.infer<
  typeof updateHubContactSettingsSchema
>;
