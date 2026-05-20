import { shippingAddressFormSchema } from "@/lib/validations/shipping-address";

function readString(v: unknown): string {
  return typeof v === "string" ? v : "";
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

export type AfterSaveRedirect =
  | "/"
  | "/settings/delivery"
  | "/dashboard/settings"
  | "/dashboard/shipping/address"
  | "/onboarding";

function isAllowedAfterSaveRedirect(v: string): v is AfterSaveRedirect {
  return (
    v === "/" ||
    v === "/settings/delivery" ||
    v === "/dashboard/settings" ||
    v === "/dashboard/shipping/address" ||
    v === "/onboarding"
  );
}

function normalizeAfterSaveRedirect(path: AfterSaveRedirect): AfterSaveRedirect {
  if (path === "/dashboard/settings" || path === "/settings/delivery") {
    return "/dashboard/shipping/address";
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
