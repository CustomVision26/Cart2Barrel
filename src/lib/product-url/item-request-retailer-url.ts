import { assertHttpsProductUrl } from "@/lib/ai/url-safety";
import {
  parseProductUrl,
  type ParsedProductUrl,
} from "@/lib/product-url/retailer-id";

/** Parse a shopper product link as a safe https URL, or null if invalid/blocked. */
export function parseValidHttpsProductUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    return assertHttpsProductUrl(withScheme).href;
  } catch {
    return null;
  }
}

const NON_RETAILER_HOST_SUFFIXES = [
  "google.com",
  "google.co.uk",
  "bing.com",
  "yahoo.com",
  "duckduckgo.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "linkedin.com",
  "pinterest.com",
  "reddit.com",
  "wikipedia.org",
  "github.com",
  "cart2barrel.com",
  "cart2barrel.invalid",
] as const;

const NON_RETAILER_HOST_EXACT = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
]);

function isNonRetailerHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  if (NON_RETAILER_HOST_EXACT.has(host)) return true;
  if (host.includes("cart2barrel")) return true;
  return NON_RETAILER_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

function isSearchOrBrowseOnlyPath(url: URL, parsed: ParsedProductUrl): boolean {
  const path = url.pathname.toLowerCase();
  if (path === "/" || path === "") return true;
  if (
    path.startsWith("/search") ||
    path.startsWith("/s?") ||
    path === "/s" ||
    path.startsWith("/browse") ||
    path.startsWith("/shop/all") ||
    path.startsWith("/stores")
  ) {
    return true;
  }
  if (parsed.kind === "amazon" && !parsed.amazonAsin && path === "/s") {
    return true;
  }
  return false;
}

function looksLikeProductListing(url: URL, parsed: ParsedProductUrl): boolean {
  if (isSearchOrBrowseOnlyPath(url, parsed)) return false;

  if (parsed.kind === "walmart" && parsed.walmartProductId) return true;
  if (parsed.kind === "amazon" && parsed.amazonAsin) return true;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;

  // Temu / Shein / most fashion marketplaces use deep paths for SKUs.
  if (
    parsed.hostname.includes("temu.") ||
    parsed.hostname.includes("shein.")
  ) {
    return segments.length >= 2;
  }

  return segments.length >= 1 && url.pathname.length >= 4;
}

export type ItemRequestRetailerUrlValidation =
  | { ok: true; href: string }
  | { ok: false; message: string };

/** Client + server guard for AI-assisted item request product links. */
export function validateItemRequestRetailerUrl(
  raw: string,
): ItemRequestRetailerUrlValidation {
  const href = parseValidHttpsProductUrl(raw);
  if (!href) {
    return {
      ok: false,
      message: "Enter a valid https product link from a retailer store.",
    };
  }

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { ok: false, message: "Enter a valid https product link." };
  }

  const host = url.hostname.toLowerCase();
  if (isNonRetailerHost(host)) {
    return {
      ok: false,
      message:
        "This link is not from a retailer product page. Paste a direct https product URL from a store (e.g. Walmart, Amazon, Target, Temu).",
    };
  }

  const parsed = parseProductUrl(href);
  if (!parsed) {
    return { ok: false, message: "Enter a valid https product link." };
  }

  if (!looksLikeProductListing(url, parsed)) {
    return {
      ok: false,
      message:
        "Use a direct product page URL—not a store homepage, search results, or this app’s address.",
    };
  }

  return { ok: true, href };
}

export function isItemRequestRetailerUrl(raw: string): boolean {
  return validateItemRequestRetailerUrl(raw).ok;
}
