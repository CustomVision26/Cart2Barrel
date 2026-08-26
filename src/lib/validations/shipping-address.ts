import { profileFormSchema } from "@/lib/validations/profile";
import { z } from "zod";

import { JAMAICA_PARISHES } from "@/lib/parishes";
import {
  isJamaicaShippingCountry,
  isKnownShippingCountry,
  isUnitedStatesShippingCountry,
  SHIPPING_COUNTRIES,
} from "@/lib/shipping-countries";
import { isUsState } from "@/lib/us-states";

const parishList = JAMAICA_PARISHES as readonly string[];

function refineShippingRegion(
  data: { country: string; stateOrRegion: string; postalCode?: string },
  ctx: z.RefinementCtx,
) {
  if (isJamaicaShippingCountry(data.country)) {
    if (!parishList.includes(data.stateOrRegion)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stateOrRegion"],
        message: "Select a valid parish",
      });
    }
    return;
  }

  if (isUnitedStatesShippingCountry(data.country)) {
    if (!isUsState(data.stateOrRegion)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stateOrRegion"],
        message: "Select a valid US state",
      });
    }
    if (!/^\d{5}(?:-\d{4})?$/.test(data.postalCode?.trim() ?? "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postalCode"],
        message: "Enter a 5-digit ZIP code",
      });
    }
    return;
  }

  if (!data.postalCode?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["postalCode"],
      message: "Enter postal or ZIP code",
    });
  }
}

const shippingAddressObjectSchema = z.object({
  line1: z
    .string()
    .trim()
    .min(3, "Enter street address or P.O. details")
    .max(300, "Address line is too long"),
  line2: z.string().trim().max(300, "Address line is too long").optional(),
  cityOrTown: z
    .string()
    .trim()
    .min(2, "Enter city or town")
    .max(120, "City or town is too long"),
  stateOrRegion: z
    .string()
    .trim()
    .min(1, "Enter state, province, or region")
    .max(120, "State or region is too long"),
  postalCode: z.string().trim().max(20, "Postal code is too long").optional(),
  country: z
    .string()
    .trim()
    .min(1, "Select a country")
    .refine((c) => isKnownShippingCountry(c), {
      message: "Select a valid country",
    }),
});

export const shippingAddressFormSchema =
  shippingAddressObjectSchema.superRefine(refineShippingRegion);

export type ShippingAddressFormInput = z.infer<typeof shippingAddressFormSchema>;

export const shippingContactAddressFormSchema = profileFormSchema
  .extend({
    id: z.string().uuid().optional(),
    isPrimary: z.boolean().optional().default(false),
    label: z.string().trim().max(80).optional(),
    ...shippingAddressObjectSchema.shape,
  })
  .superRefine(refineShippingRegion);

export type ShippingContactAddressFormInput = z.infer<
  typeof shippingContactAddressFormSchema
>;

export { SHIPPING_COUNTRIES };
