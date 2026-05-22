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

const AMAZON_ASIN_PATH = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i;
const AMAZON_ASIN_QUERY = /[?&]asin=([A-Z0-9]{10})/i;

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
  const ipMatch = path.match(/\/ip\/(?:[^/]+\/)?(\d{5,})/i);
  if (ipMatch?.[1]) return ipMatch[1];
  const short = path.match(/\/ip\/(\d+)/);
  return short?.[1] ?? null;
}

function parseAmazonAsin(url: URL): string | null {
  const fromPath = url.pathname.match(AMAZON_ASIN_PATH)?.[1];
  if (fromPath) return fromPath.toUpperCase();
  const fromQuery = url.search.match(AMAZON_ASIN_QUERY)?.[1];
  return fromQuery ? fromQuery.toUpperCase() : null;
}

export function amazonProductUrl(asin: string, amazonDomain: string): string {
  const domain = amazonDomain.trim() || "amazon.com";
  return `https://www.${domain}/dp/${asin}`;
}
