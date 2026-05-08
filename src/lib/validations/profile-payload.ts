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
  | "/onboarding";

function isAllowedAfterSaveRedirect(v: string): v is AfterSaveRedirect {
  return (
    v === "/" ||
    v === "/settings/delivery" ||
    v === "/dashboard/settings" ||
    v === "/onboarding"
  );
}

/** Same-origin paths only; prevents open redirects from client-supplied fields. */
export function resolveAfterSaveRedirect(raw: unknown): AfterSaveRedirect {
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
