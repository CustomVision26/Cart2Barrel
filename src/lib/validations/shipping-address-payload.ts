import { shippingAddressFormSchema } from "@/lib/validations/shipping-address";

function readString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function parseShippingAddressFormSubmission(raw: unknown) {
  if (raw instanceof FormData) {
    const line2Raw = raw.get("line2");
    return shippingAddressFormSchema.safeParse({
      line1: readString(raw.get("line1")),
      line2:
        typeof line2Raw === "string" && line2Raw.trim() ? line2Raw : undefined,
      cityOrTown: readString(raw.get("cityOrTown")),
      parish: readString(raw.get("parish")),
    });
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const l2 = o.line2;
    return shippingAddressFormSchema.safeParse({
      line1: readString(o.line1),
      line2: typeof l2 === "string" && l2.trim() ? l2 : undefined,
      cityOrTown: readString(o.cityOrTown),
      parish: readString(o.parish),
    });
  }

  return shippingAddressFormSchema.safeParse({
    line1: "",
    cityOrTown: "",
    parish: "",
  });
}

export type AfterSaveRedirect =
  | "/"
  | "/settings/delivery"
  | "/dashboard/settings"
  | "/onboarding";

function isAllowedAfterSaveRedirect(v: string): v is AfterSaveRedirect {
  return (
    v === "/" ||
    v === "/settings/delivery" ||
    v === "/dashboard/settings" ||
    v === "/onboarding"
  );
}

export function resolveShippingAfterSaveRedirect(raw: unknown): AfterSaveRedirect {
  if (raw instanceof FormData) {
    const x = raw.get("afterSaveRedirect");
    if (typeof x === "string" && isAllowedAfterSaveRedirect(x)) {
      return x;
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const x = (raw as Record<string, unknown>).afterSaveRedirect;
    if (typeof x === "string" && isAllowedAfterSaveRedirect(x)) {
      return x;
    }
  }
  return "/";
}
