import { DASHBOARD_SHIPPING_ROUTES } from "@/lib/dashboard-shipping-routes";
import { profileFormSchema } from "@/lib/validations/profile";

function readString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Accepts FormData or a plain JSON-like object from the client; never trust shape until Zod runs. */
export function parseProfileFormSubmission(raw: unknown) {
  if (raw instanceof FormData) {
    return profileFormSchema.safeParse({
      fullName: readString(raw.get("fullName")),
      phone: readString(raw.get("phone")),
    });
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return profileFormSchema.safeParse({
      fullName: readString(o.fullName),
      phone: readString(o.phone),
    });
  }

  return profileFormSchema.safeParse({
    fullName: "",
    phone: "",
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
    v === DASHBOARD_SHIPPING_ROUTES.address ||
    v === "/onboarding"
  );
}

function normalizeAfterSaveRedirect(path: AfterSaveRedirect): AfterSaveRedirect {
  if (path === "/dashboard/settings" || path === "/settings/delivery") {
    return DASHBOARD_SHIPPING_ROUTES.address;
  }
  return path;
}

/** Same-origin paths only; prevents open redirects from client-supplied fields. */
export function resolveAfterSaveRedirect(raw: unknown): AfterSaveRedirect {
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
