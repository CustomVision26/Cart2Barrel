import {
  shippingAddressFormSchema,
  shippingContactAddressFormSchema,
} from "@/lib/validations/shipping-address";

function readString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function optionalTrimmed(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function readBoolean(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v === "string") {
    const n = v.trim().toLowerCase();
    return n === "on" || n === "true" || n === "1";
  }
  return false;
}

export function parseShippingAddressFormSubmission(raw: unknown) {
  if (raw instanceof FormData) {
    const line2Raw = raw.get("line2");
    const postalRaw = raw.get("postalCode");
    return shippingAddressFormSchema.safeParse({
      line1: readString(raw.get("line1")),
      line2:
        typeof line2Raw === "string" && line2Raw.trim() ? line2Raw : undefined,
      cityOrTown: readString(raw.get("cityOrTown")),
      stateOrRegion: readString(raw.get("stateOrRegion")),
      postalCode:
        typeof postalRaw === "string" && postalRaw.trim() ? postalRaw : undefined,
      country: readString(raw.get("country")),
    });
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const l2 = o.line2;
    const postal = o.postalCode;
    return shippingAddressFormSchema.safeParse({
      line1: readString(o.line1),
      line2: typeof l2 === "string" && l2.trim() ? l2 : undefined,
      cityOrTown: readString(o.cityOrTown),
      stateOrRegion: readString(o.stateOrRegion),
      postalCode: typeof postal === "string" && postal.trim() ? postal : undefined,
      country: readString(o.country),
    });
  }

  return shippingAddressFormSchema.safeParse({
    line1: "",
    cityOrTown: "",
    stateOrRegion: "",
    country: "",
  });
}

function contactAddressFieldsFromRecord(o: Record<string, unknown>) {
  return {
    fullName: readString(o.fullName),
    phone: readString(o.phone),
    line1: readString(o.line1),
    line2: optionalTrimmed(o.line2),
    cityOrTown: readString(o.cityOrTown),
    stateOrRegion: readString(o.stateOrRegion),
    postalCode: optionalTrimmed(o.postalCode),
    country: readString(o.country),
    id: optionalTrimmed(o.id),
    isPrimary: readBoolean(o.isPrimary),
    label: optionalTrimmed(o.label),
  };
}

export function parseShippingContactAddressFormSubmission(raw: unknown) {
  if (raw instanceof FormData) {
    return shippingContactAddressFormSchema.safeParse(
      contactAddressFieldsFromRecord({
        fullName: raw.get("fullName"),
        phone: raw.get("phone"),
        line1: raw.get("line1"),
        line2: raw.get("line2"),
        cityOrTown: raw.get("cityOrTown"),
        stateOrRegion: raw.get("stateOrRegion"),
        postalCode: raw.get("postalCode"),
        country: raw.get("country"),
        id: raw.get("id"),
        isPrimary: raw.get("isPrimary"),
        label: raw.get("label"),
      }),
    );
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return shippingContactAddressFormSchema.safeParse(
      contactAddressFieldsFromRecord(raw as Record<string, unknown>),
    );
  }

  return shippingContactAddressFormSchema.safeParse({
    fullName: "",
    phone: "",
    line1: "",
    cityOrTown: "",
    stateOrRegion: "",
    country: "",
  });
}

export type AfterSaveRedirect =
  | "/"
  | "/settings/delivery"
  | "/dashboard/settings"
  | "/dashboard/shipping/profile"
  | "/dashboard/shipping/address"
  | "/onboarding";

function isAllowedAfterSaveRedirect(v: string): v is AfterSaveRedirect {
  return (
    v === "/" ||
    v === "/settings/delivery" ||
    v === "/dashboard/settings" ||
    v === "/dashboard/shipping/profile" ||
    v === "/dashboard/shipping/address" ||
    v === "/onboarding"
  );
}

function normalizeAfterSaveRedirect(path: AfterSaveRedirect): AfterSaveRedirect {
  if (
    path === "/dashboard/settings" ||
    path === "/settings/delivery" ||
    path === "/dashboard/shipping/address"
  ) {
    return "/dashboard/shipping/profile";
  }
  return path;
}

export function resolveShippingAfterSaveRedirect(raw: unknown): AfterSaveRedirect {
  if (raw instanceof FormData) {
    const x = raw.get("afterSaveRedirect");
    if (typeof x === "string" && isAllowedAfterSaveRedirect(x)) {
      return normalizeAfterSaveRedirect(x);
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const x = (raw as Record<string, unknown>).afterSaveRedirect;
    if (typeof x === "string" && isAllowedAfterSaveRedirect(x)) {
      return normalizeAfterSaveRedirect(x);
    }
  }
  return "/";
}
