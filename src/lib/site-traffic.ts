/** HttpOnly cookie that correlates anonymous and later-signed-in page views. */
export const SITE_TRAFFIC_VISITOR_COOKIE = "c2b_vid";

export const SITE_TRAFFIC_VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "code",
  "state",
  "secret",
  "password",
  "access_token",
  "refresh_token",
  "id_token",
  "session",
  "key",
  "api_key",
  "clerk_status",
]);

export function isSiteTrafficVisitorId(value: string | undefined | null): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isInternalSiteTrafficPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next")
  );
}

function pathnameOnly(raw: string): string {
  const noHash = raw.split("#")[0] ?? raw;
  const q = noHash.indexOf("?");
  return q >= 0 ? noHash.slice(0, q) : noHash;
}

/** Drop secrets from the query string and reject internal / invalid paths. */
export function sanitizeTrackedPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;

  const pathname = pathnameOnly(trimmed);
  if (!pathname.startsWith("/") || pathname.includes("\\")) return null;
  if (pathname.length > 512) return null;
  if (isInternalSiteTrafficPath(pathname)) return null;
  if (/[\u0000-\u001f]/.test(pathname)) return null;

  const qIndex = trimmed.indexOf("?");
  const hashIndex = trimmed.indexOf("#");
  const searchEnd = hashIndex >= 0 ? hashIndex : trimmed.length;
  const search =
    qIndex >= 0 && qIndex < searchEnd ? trimmed.slice(qIndex + 1, searchEnd) : "";

  const params = new URLSearchParams(search);
  for (const key of [...params.keys()]) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      params.delete(key);
    }
  }
  const qs = params.toString();
  const out = qs ? `${pathname}?${qs}` : pathname;
  return out.length > 768 ? out.slice(0, 768) : out;
}

export function sanitizeTrackedReferrer(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    const href = url.toString();
    return href.length > 768 ? href.slice(0, 768) : href;
  } catch {
    return null;
  }
}
