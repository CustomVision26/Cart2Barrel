import { parseProductUrl } from "@/lib/product-url/retailer-id";
import { fetchAmazonProductSummary } from "@/lib/serpapi/amazon-product";
import { getSerpApiKey } from "@/lib/serpapi/env";
import { fetchWalmartProductSummary } from "@/lib/serpapi/walmart-product";
import { resolveSpotlightProductPageMeta } from "@/lib/spotlight-product-preview";

export const SPOTLIGHT_RETAILER_DRIFT_FIELDS = [
  "price",
  "url",
  "name",
  "image",
  "unavailable",
] as const;

export type SpotlightRetailerDriftField =
  (typeof SPOTLIGHT_RETAILER_DRIFT_FIELDS)[number];

export type SpotlightRetailerLiveSnapshot = {
  productUrl: string | null;
  priceUsdCents: number | null;
  label: string | null;
  imageUrl: string | null;
};

export type SpotlightRetailerStoredSnapshot = {
  productUrl: string;
  priceUsdCents: number | null;
  label: string | null;
  imageUrl: string | null;
};

export type SpotlightRetailerCheckResult = {
  live: SpotlightRetailerLiveSnapshot;
  driftFields: SpotlightRetailerDriftField[];
  error: string | null;
};

const TRACKING_QUERY_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mcid",
  "ref",
  "tag",
]);

export function spotlightRetailerDriftSummary(
  fields: readonly string[] | null | undefined,
): string | null {
  if (!fields || fields.length === 0) return null;
  const labels = fields.map((field) => {
    switch (field) {
      case "price":
        return "price";
      case "url":
        return "product URL";
      case "name":
        return "name";
      case "image":
        return "image";
      case "unavailable":
        return "listing availability";
      default:
        return field;
    }
  });
  if (labels.length === 1) {
    return `Retailer ${labels[0]} changed — check this product with the retailer.`;
  }
  const last = labels[labels.length - 1];
  return `Retailer ${labels.slice(0, -1).join(", ")} and ${last} changed — check this product with the retailer.`;
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function namesDiffer(stored: string | null, live: string | null): boolean {
  const a = normalizeName(stored);
  const b = normalizeName(live);
  if (!a || !b) return false;
  if (a === b) return false;
  if (a.length >= 8 && b.includes(a)) return false;
  if (b.length >= 8 && a.includes(b)) return false;
  return true;
}

function canonicalizeProductUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return trimmed.toLowerCase();
  }
  url.hash = "";
  url.hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_QUERY_KEYS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  return url.toString();
}

function productIdentityKey(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const parsed = parseProductUrl(trimmed);
  if (parsed?.kind === "amazon" && parsed.amazonAsin) {
    return `amazon:${parsed.amazonAsin.toUpperCase()}`;
  }
  if (parsed?.kind === "walmart" && parsed.walmartProductId) {
    return `walmart:${parsed.walmartProductId}`;
  }
  return canonicalizeProductUrl(trimmed);
}

function canonicalizeImageUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
    return url.toString();
  } catch {
    return trimmed.toLowerCase();
  }
}

export function compareSpotlightRetailerDrift(
  stored: SpotlightRetailerStoredSnapshot,
  live: SpotlightRetailerLiveSnapshot,
): SpotlightRetailerDriftField[] {
  const drift: SpotlightRetailerDriftField[] = [];
  const liveMissing = !live.label && live.priceUsdCents == null && !live.productUrl;
  if (liveMissing) {
    drift.push("unavailable");
    return drift;
  }

  if (
    stored.priceUsdCents != null &&
    stored.priceUsdCents > 0 &&
    live.priceUsdCents != null &&
    live.priceUsdCents > 0 &&
    stored.priceUsdCents !== live.priceUsdCents
  ) {
    drift.push("price");
  }

  const storedId = productIdentityKey(stored.productUrl);
  const liveId = productIdentityKey(live.productUrl);
  if (storedId && liveId && storedId !== liveId) {
    drift.push("url");
  }

  if (namesDiffer(stored.label, live.label)) {
    drift.push("name");
  }

  const storedImage = canonicalizeImageUrl(stored.imageUrl);
  const liveImage = canonicalizeImageUrl(live.imageUrl);
  if (storedImage && liveImage && storedImage !== liveImage) {
    drift.push("image");
  }

  return drift;
}

export async function fetchSpotlightRetailerLiveSnapshot(
  productUrl: string,
): Promise<SpotlightRetailerLiveSnapshot> {
  const parsed = parseProductUrl(productUrl);
  if (parsed?.kind === "walmart" && parsed.walmartProductId && getSerpApiKey()) {
    const summary = await fetchWalmartProductSummary(parsed.walmartProductId);
    return {
      productUrl: summary.productUrl ?? productUrl,
      priceUsdCents: summary.priceUsdCents,
      label: summary.title,
      imageUrl: summary.imageUrl,
    };
  }
  if (parsed?.kind === "amazon" && parsed.amazonAsin && getSerpApiKey()) {
    const summary = await fetchAmazonProductSummary(
      parsed.amazonAsin,
      parsed.amazonDomain,
    );
    return {
      productUrl: summary.productUrl ?? productUrl,
      priceUsdCents: summary.priceUsdCents,
      label: summary.title,
      imageUrl: summary.imageUrl,
    };
  }

  const meta = await resolveSpotlightProductPageMeta(productUrl);
  return {
    productUrl,
    priceUsdCents: null,
    label: meta.title,
    imageUrl: meta.imageUrl,
  };
}
