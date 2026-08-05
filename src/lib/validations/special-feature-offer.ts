import { z } from "zod";

import { priceUsdStringToCents } from "@/lib/validations/container-offering";

const usAirlineNameSchema = z
  .string()
  .trim()
  .min(1, "Select an airline.")
  .max(200);

export const specialFeaturePackagingModeSchema = z.enum(["in_app", "outside"]);

export type SpecialFeaturePackagingMode = z.infer<
  typeof specialFeaturePackagingModeSchema
>;

export function specialFeaturePackagingModeLabel(
  mode: SpecialFeaturePackagingMode,
): string {
  switch (mode) {
    case "in_app":
      return "In-app packaging";
    case "outside":
      return "Outside packaging";
    default: {
      const _x: never = mode;
      return _x;
    }
  }
}

function parseLocalDateTimeToIso(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already an absolute instant from the browser (preferred for admin forms).
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Convert `<input type="datetime-local">` value to UTC ISO in the user's browser. */
export function datetimeLocalValueToIso(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(trimmed)) {
    return trimmed;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;
  return d.toISOString();
}

const dateTimeField = z
  .string()
  .trim()
  .min(1, "Enter a date and time.")
  .refine((s) => parseLocalDateTimeToIso(s) != null, {
    message: "Enter a valid date and time.",
  });

/** Optional USD amount as a decimal string (AI bag fees). */
const optionalUsdAmountField = z
  .string()
  .trim()
  .refine(
    (s) =>
      s === "" ||
      (Number.isFinite(Number.parseFloat(s)) && Number.parseFloat(s) >= 0),
    { message: "Enter a valid amount." },
  );

function refineSpecialFeatureWindowAndTravel(
  data: { startsAt: string; endsAt: string; travelAt: string },
  ctx: z.RefinementCtx,
) {
  const startIso = parseLocalDateTimeToIso(data.startsAt);
  const endIso = parseLocalDateTimeToIso(data.endsAt);
  const travelIso = parseLocalDateTimeToIso(data.travelAt);
  if (startIso && endIso && startIso >= endIso) {
    ctx.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "End must be after start.",
    });
  }
  if (endIso && travelIso && travelIso <= endIso) {
    ctx.addIssue({
      code: "custom",
      path: ["travelAt"],
      message: "Travel day must be after the special end date.",
    });
  }
}

function refineTransportationFee(
  data: {
    packagingMode: SpecialFeaturePackagingMode;
    priceUsd: string;
  },
  ctx: z.RefinementCtx,
) {
  if (data.packagingMode === "in_app") {
    const cents = priceUsdStringToCents(data.priceUsd || "0");
    if (cents < 50) {
      ctx.addIssue({
        code: "custom",
        path: ["priceUsd"],
        message: "Transportation fee must be at least $0.50 USD.",
      });
    }
  } else if (
    data.priceUsd.trim() !== "" &&
    !Number.isFinite(Number.parseFloat(data.priceUsd))
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["priceUsd"],
      message: "Enter a valid transportation fee or leave blank.",
    });
  }
}

const bagFeeUsdFields = {
  airlineSecondBagUsd: optionalUsdAmountField.optional().default(""),
  airlineThirdBagUsd: optionalUsdAmountField.optional().default(""),
  airlineFourthBagUsd: optionalUsdAmountField.optional().default(""),
};

export const adminCreateSpecialFeatureOfferSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    /** Optional; UI no longer collects this — defaults applied server-side. */
    sizeLabel: z.string().trim().max(200).optional().default("Suitcase"),
    /** Optional; UI no longer collects this — defaults applied server-side. */
    destinationLocation: z.string().trim().max(300).optional().default("—"),
    packagingMode: specialFeaturePackagingModeSchema,
    priceUsd: z.string().trim(),
    airlineName: usAirlineNameSchema,
    /** Courier travel day — not the special end date. */
    travelAt: dateTimeField,
    airlineBagFeeExtraNote: z.string().max(4000).optional().default(""),
    notes: z.string().max(4000).optional().default(""),
    startsAt: dateTimeField,
    endsAt: dateTimeField,
    suitcaseSlotCapacity: z
      .string()
      .trim()
      .optional()
      .default("")
      .refine(
        (s) =>
          s === "" ||
          (Number.isFinite(Number.parseInt(s, 10)) &&
            Number.parseInt(s, 10) >= 1 &&
            Number.parseInt(s, 10) <= 999),
        { message: "Enter a whole number from 1 to 999, or leave blank for no limit." },
      ),
    ...bagFeeUsdFields,
  })
  .superRefine((data, ctx) => {
    refineSpecialFeatureWindowAndTravel(data, ctx);
    refineTransportationFee(data, ctx);
  });

export type AdminCreateSpecialFeatureOfferInput = z.infer<
  typeof adminCreateSpecialFeatureOfferSchema
>;

export const adminUpdateSpecialFeatureOfferSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    sizeLabel: z.string().trim().max(200).optional(),
    destinationLocation: z.string().trim().max(300).optional(),
    packagingMode: specialFeaturePackagingModeSchema,
    priceUsd: z.string().trim(),
    airlineName: usAirlineNameSchema,
    travelAt: dateTimeField,
    airlineBagFeeExtraNote: z.string().max(4000).optional().default(""),
    notes: z.string().max(4000).optional().default(""),
    startsAt: dateTimeField,
    endsAt: dateTimeField,
    isActive: z.boolean(),
    suitcaseSlotCapacity: z
      .string()
      .trim()
      .optional()
      .default("")
      .refine(
        (s) =>
          s === "" ||
          (Number.isFinite(Number.parseInt(s, 10)) &&
            Number.parseInt(s, 10) >= 1 &&
            Number.parseInt(s, 10) <= 999),
        { message: "Enter a whole number from 1 to 999, or leave blank for no limit." },
      ),
    ...bagFeeUsdFields,
  })
  .superRefine((data, ctx) => {
    refineSpecialFeatureWindowAndTravel(data, ctx);
    refineTransportationFee(data, ctx);
  });

export type AdminUpdateSpecialFeatureOfferInput = z.infer<
  typeof adminUpdateSpecialFeatureOfferSchema
>;

export const adminEstimateAirlineBagFeeSchema = z.object({
  airlineName: usAirlineNameSchema,
  /** Courier travel day for outside bag fees — not the special end date. */
  travelDate: dateTimeField,
});

export type AdminEstimateAirlineBagFeeInput = z.infer<
  typeof adminEstimateAirlineBagFeeSchema
>;

export const adminPublishSpecialFeatureOfferSchema = z.object({
  id: z.string().uuid(),
});

export type AdminPublishSpecialFeatureOfferInput = z.infer<
  typeof adminPublishSpecialFeatureOfferSchema
>;

export function parseSuitcaseSlotCapacity(raw: string | undefined): number | null {
  const s = raw?.trim() ?? "";
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

export function specialFeatureDateTimeToIso(raw: string): string {
  return parseLocalDateTimeToIso(raw) ?? new Date().toISOString();
}

/** Format DB ISO timestamp for `<input type="datetime-local">`. */
export function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function usdStringToCentsOrZero(raw: string | undefined): number {
  const s = raw?.trim() ?? "";
  if (!s) return 0;
  return priceUsdStringToCents(s);
}
