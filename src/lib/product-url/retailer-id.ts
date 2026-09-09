import { hostnameFromProductUrl } from "@/lib/site-name";

export type RetailerKind =
  | "walmart"
  | "amazon"
  | "target"
  | "ebay"
  | "generic";

export type ParsedProductUrl = {
  kind: RetailerKind;
  hostname: string;
  walmartProductId: string | null;
  amazonAsin: string | null;
  amazonDomain: string;
};

const AMAZON_ASIN_PATH =
  /\/(?:dp|gp\/product|gp\/aw\/d|gp\/offer-listing)\/([A-Z0-9]{10})(?:[/?]|$)/i;
const AMAZON_ASIN_QUERY = /[?&](?:asin|ASIN)=([A-Z0-9]{10})(?:&|$)/i;

export function parseProductUrl(productUrl: string): ParsedProductUrl | null {
  let url: URL;
  try {
    url = new URL(productUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const hostname = hostnameFromProductUrl(productUrl);
  if (!hostname) return null;

  const host = hostname.toLowerCase();

  if (host === "walmart.com" || host.endsWith(".walmart.com")) {
    const id = parseWalmartProductId(url);
    return {
      kind: "walmart",
      hostname: host,
      walmartProductId: id,
      amazonAsin: null,
      amazonDomain: "amazon.com",
    };
  }

  if (
    host === "amazon.com" ||
    host.endsWith(".amazon.com") ||
    host.startsWith("amazon.")
  ) {
    const asin = parseAmazonAsin(url);
    const amazonDomain = host.startsWith("amazon.") ? host : "amazon.com";
    return {
      kind: "amazon",
      hostname: host,
      walmartProductId: null,
      amazonAsin: asin,
      amazonDomain,
    };
  }

  if (host === "target.com" || host.endsWith(".target.com")) {
    return {
      kind: "target",
      hostname: host,
      walmartProductId: null,
      amazonAsin: null,
      amazonDomain: "amazon.com",
    };
  }

  if (host.includes("ebay.")) {
    return {
      kind: "ebay",
      hostname: host,
      walmartProductId: null,
      amazonAsin: null,
      amazonDomain: "amazon.com",
    };
  }

  return {
    kind: "generic",
    hostname: host,
    walmartProductId: null,
    amazonAsin: null,
    amazonDomain: "amazon.com",
  };
}

function parseWalmartProductId(url: URL): string | null {
  const path = url.pathname;
  const numeric = path.match(/\/ip\/(?:[^/]+\/)?(\d{5,})(?:[/?]|$)/i);
  if (numeric?.[1]) return numeric[1];
  const alpha = path.match(/\/ip\/(?:[^/]+\/)?([A-Z0-9]{10,14})(?:[/?]|$)/i);
  if (alpha?.[1] && /\d/.test(alpha[1])) return alpha[1];
  return null;
}

function parseAmazonAsin(url: URL): string | null {
  const fromPath = url.pathname.match(AMAZON_ASIN_PATH)?.[1];
  if (fromPath) return fromPath.toUpperCase();
  const fromQuery = `${url.search}${url.hash}`.match(AMAZON_ASIN_QUERY)?.[1];
  if (fromQuery) return fromQuery.toUpperCase();
  return null;
}

const AMAZON_DP_TOKEN =
  /\/(?:dp|gp\/product|gp\/aw\/d|gp\/offer-listing)\/([^/?]*)/i;

/** True when the URL has /dp/ (or gp/product) but the ASIN is missing or shorter than 10 characters. */
export function isIncompleteAmazonDpUrl(productUrl: string): boolean {
  try {
    const url = new URL(productUrl.trim());
    if (!/amazon\./i.test(url.hostname)) return false;
    if (parseAmazonAsin(url)) return false;
    return AMAZON_DP_TOKEN.test(url.pathname);
  } catch {
    return false;
  }
}

const WALMART_IP_TOKEN = /\/ip\/([^/?]*)/i;

/** True when the URL has /ip/ but no Walmart item id (5+ digits or alphanumeric product id). */
export function isIncompleteWalmartIpUrl(productUrl: string): boolean {
  try {
    const url = new URL(productUrl.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (
      host !== "walmart.com" &&
      !host.endsWith(".walmart.com") &&
      !host.startsWith("walmart.")
    ) {
      return false;
    }
    if (parseWalmartProductId(url)) return false;
    return WALMART_IP_TOKEN.test(url.pathname);
  } catch {
    return false;
  }
}

export function isWalmartBrowseOrSearchUrl(productUrl: string): boolean {
  try {
    const url = new URL(productUrl.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (
      host !== "walmart.com" &&
      !host.endsWith(".walmart.com") &&
      !host.startsWith("walmart.")
    ) {
      return false;
    }
    const path = url.pathname.toLowerCase();
    return (
      path.startsWith("/search") ||
      path.startsWith("/browse") ||
      path.startsWith("/brand") ||
      path.startsWith("/cp/") ||
      path.startsWith("/shop")
    );
  } catch {
    return false;
  }
}

export function walmartProductUrl(productId: string): string {
  return `https://www.walmart.com/ip/${productId.trim()}`;
}

const TARGET_TCIN = /\/(?:-\/)?A-(\d{8,})(?:[/?]|$)/i;

export function parseTargetTcin(productUrl: string): string | null {
  try {
    const url = new URL(productUrl.trim());
    return url.pathname.match(TARGET_TCIN)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** True when the URL looks like a Target /p/ product page but has no A- TCIN. */
export function isIncompleteTargetProductUrl(productUrl: string): boolean {
  try {
    const url = new URL(productUrl.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "target.com" && !host.endsWith(".target.com")) return false;
    if (parseTargetTcin(productUrl)) return false;
    return /\/p\//i.test(url.pathname);
  } catch {
    return false;
  }
}

const EBAY_ITEM = /\/itm\/(?:[^/]+\/)?(\d{9,})(?:[/?]|$)/i;

export function parseEbayItemId(productUrl: string): string | null {
  try {
    const url = new URL(productUrl.trim());
    return url.pathname.match(EBAY_ITEM)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** True when the URL has /itm/ but no eBay item number. */
export function isIncompleteEbayItemUrl(productUrl: string): boolean {
  try {
    const url = new URL(productUrl.trim());
    if (!/ebay\./i.test(url.hostname)) return false;
    if (parseEbayItemId(productUrl)) return false;
    return /\/itm\//i.test(url.pathname);
  } catch {
    return false;
  }
}

/** Brand slug from amazon.com/stores/BrandName/... pages (not a product ASIN). */
export function amazonStoreBrandFromUrl(productUrl: string): string | null {
  try {
    const path = new URL(productUrl.trim()).pathname;
    const match = path.match(/\/stores\/([^/]+)/i);
    if (!match?.[1]) return null;
    const brand = decodeURIComponent(match[1]).replace(/[-_]+/g, " ").trim();
    return brand.length >= 2 ? brand : null;
  } catch {
    return null;
  }
}

export function isAmazonStoreOrBrowseUrl(productUrl: string): boolean {
  try {
    const url = new URL(productUrl.trim());
    const path = url.pathname.toLowerCase();
    return (
      path.startsWith("/stores") ||
      path === "/s" ||
      path.startsWith("/s/") ||
      path.startsWith("/shop/")
    );
  } catch {
    return false;
  }
}

export function amazonProductUrl(asin: string, amazonDomain: string): string {
  const domain = amazonDomain.trim() || "amazon.com";
  return `https://www.${domain}/dp/${asin}`;
}
