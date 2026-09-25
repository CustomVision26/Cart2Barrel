import { hostnameLikelyBlocksHtmlFetch } from "@/lib/ai/fetch-page-for-ai";
import { assertHttpsProductUrl } from "@/lib/ai/url-safety";
import { retailerLabelFromProductUrl } from "@/lib/site-name";
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
    path.startsWith("/stores") ||
    path.startsWith("/channel/") ||
    path.startsWith("/category") ||
    path.includes("search_result")
  ) {
    return true;
  }
  if (parsed.kind === "amazon" && !parsed.amazonAsin && path === "/s") {
    return true;
  }
  return false;
}

const TEMU_SHEIN_NON_PRODUCT_SEGMENTS = new Set([
  "cart",
  "login",
  "signup",
  "about",
  "help",
  "mall",
  "channel",
  "category",
  "categories",
  "best-sellers",
  "new-arrivals",
  "flash-sale",
]);

function looksLikeTemuOrSheinListing(url: URL): boolean {
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;
  const slug = segments[segments.length - 1] ?? "";
  const slugLower = slug.toLowerCase();
  if (TEMU_SHEIN_NON_PRODUCT_SEGMENTS.has(slugLower)) return false;

  // Goods / product ids: ...-g-601099670847207.html or ...-p-123456.html
  if (/-g-\d+/i.test(slug) || /-p-\d+/i.test(slug)) return true;
  if (/\.html$/i.test(slug) && slug.length >= 8) return true;

  // Temu often uses a single hyphenated product slug with no extra folders.
  if (segments.length === 1) {
    return slug.length >= 12 && slug.includes("-");
  }

  return url.pathname.length >= 8;
}

function looksLikeProductListing(url: URL, parsed: ParsedProductUrl): boolean {
  if (isSearchOrBrowseOnlyPath(url, parsed)) return false;

  if (parsed.kind === "walmart" && parsed.walmartProductId) return true;
  if (parsed.kind === "amazon" && parsed.amazonAsin) return true;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;

  const host = parsed.hostname.toLowerCase();
  if (host.includes("temu.") || host.includes("shein.")) {
    return looksLikeTemuOrSheinListing(url);
  }

  return segments.length >= 1 && url.pathname.length >= 4;
}

export type ItemRequestRetailerUrlValidation =
  | { ok: true; href: string }
  | { ok: false; message: string };

/** Shopper-facing reason we cannot auto-load this store (e.g. Bath & Body Works). */
export function unsupportedShopperCatalogLookupMessage(
  productUrl: string,
): string | null {
  let host: string;
  try {
    host = new URL(productUrl.trim()).hostname;
  } catch {
    return null;
  }
  if (!hostnameLikelyBlocksHtmlFetch(host)) return null;
  const retailer = retailerLabelFromProductUrl(productUrl);
  return `Amani Cart2Barrel cannot load ${retailer} product links automatically. That store blocks our catalog lookup, and unlike Amazon or Walmart there is no product listing feed we can read. Paste a product page from Amazon, Walmart, Target, eBay, Temu, or SHEIN.`;
}

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

  const unsupported = unsupportedShopperCatalogLookupMessage(href);
  if (unsupported) {
    return { ok: false, message: unsupported };
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
