import { z } from "zod";

import { JAMAICA_PARISHES } from "@/lib/parishes";
import {
  isJamaicaShippingCountry,
  isKnownShippingCountry,
  SHIPPING_COUNTRIES,
} from "@/lib/shipping-countries";

const parishList = JAMAICA_PARISHES as readonly string[];

export const shippingAddressFormSchema = z
  .object({
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
  })
  .superRefine((data, ctx) => {
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

    if (!data.postalCode?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postalCode"],
        message: "Enter postal or ZIP code",
      });
    }
  });

export type ShippingAddressFormInput = z.infer<typeof shippingAddressFormSchema>;

export { SHIPPING_COUNTRIES };
