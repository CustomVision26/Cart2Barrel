import { randomUUID } from "node:crypto";

import {
  budgetBarrelRetailer,
  type BudgetBarrelRetailerKey,
} from "@/lib/budget-barrel/constants";
import {
  detectClothingSize,
  detectColor,
  judgeClothingSize,
  judgeColor,
  judgePackSize,
  marketplaceSellerName,
  packLabelFromText,
} from "@/lib/budget-barrel/constraints";
import { usdAmountToCents } from "@/lib/budget-barrel/money";
import type { BudgetBarrelOffer, PlannedQuery } from "@/lib/budget-barrel/types";
import { listingUrlMatchesRetailer } from "@/lib/product-url/listing-url";
import { amazonProductUrl } from "@/lib/product-url/retailer-id";
import type { AmazonSearchHit } from "@/lib/serpapi/amazon-product";
import type { SerpShoppingResult } from "@/lib/serpapi/google-shopping";

export type WalmartSearchHit = {
  title?: string;
  us_item_id?: string;
  product_id?: string;
  product_page_url?: string;
  link?: string;
  thumbnail?: string;
  seller_name?: string;
  out_of_stock?: boolean;
  primary_offer?: {
    offer_price?: number | string;
    seller_name?: string;
    currency?: string;
  };
  price?: number | string | { current_price?: number; currency?: string };
};

function httpsRetailerUrl(raw: string | null | undefined, host: string): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!/^https:\/\//i.test(trimmed)) return null;
  return listingUrlMatchesRetailer(host, trimmed) ? trimmed : null;
}

function usdPriceFromUnknown(
  amount: number | string | null | undefined,
  currencyHint?: string | null,
): { cents: number | null; currency: "USD" | null } {
  if (currencyHint && !/^usd$/i.test(currencyHint.trim())) {
    return { cents: null, currency: null };
  }
  if (typeof amount === "number") {
    return { cents: usdAmountToCents(amount), currency: "USD" };
  }
  if (typeof amount !== "string") return { cents: null, currency: null };
  const text = amount.trim();
  if (!text) return { cents: null, currency: null };
  if (/€|£|¥|\b(?:cad|eur|gbp|aud)\b/i.test(text)) {
    return { cents: null, currency: null };
  }
  const parsed = Number.parseFloat(text.replace(/[^0-9.]/g, ""));
  const cents = usdAmountToCents(parsed);
  return cents == null ? { cents: null, currency: null } : { cents, currency: "USD" };
}

function walmartPrice(hit: WalmartSearchHit): { cents: number | null; currency: "USD" | null } {
  const offer = hit.primary_offer;
  if (offer?.offer_price != null) {
    const priced = usdPriceFromUnknown(offer.offer_price, offer.currency);
    if (priced.cents != null) return priced;
    if (offer.currency && !/^usd$/i.test(offer.currency)) return priced;
  }
  if (hit.price && typeof hit.price === "object") {
    return usdPriceFromUnknown(hit.price.current_price, hit.price.currency);
  }
  return usdPriceFromUnknown(hit.price);
}

function applyConstraints(
  offer: Omit<
    BudgetBarrelOffer,
    | "variantVerified"
    | "needsStaffReview"
    | "reviewReason"
    | "size"
    | "color"
    | "packSize"
  > & { text: string },
  query: PlannedQuery,
): BudgetBarrelOffer {
  const { text, ...rest } = offer;
  const size = detectClothingSize(text);
  const pack = packLabelFromText(text);
  const color = detectColor(text);
  const reasons: string[] = [];
  let variantVerified = true;

  if (query.category === "clothing" && query.size) {
    const judgment = judgeClothingSize(text, query.size);
    if (judgment === "match") variantVerified = true;
    else {
      variantVerified = false;
      reasons.push(
        judgment === "conflict"
          ? `Listing size does not match ${query.size}.`
          : `Size ${query.size} was not confirmed on the listing.`,
      );
    }
  }

  if (query.packSize) {
    const judgment = judgePackSize(text, query.packSize);
    if (judgment === "conflict") {
      reasons.push(`Pack size does not match ${query.packSize}.`);
    } else if (judgment === "unknown") {
      reasons.push(`Pack size ${query.packSize} was not confirmed.`);
    }
  }

  if (query.category === "clothing" && query.color) {
    const judgment = judgeColor(text, query.color);
    if (judgment === "conflict") reasons.push(`Color does not match ${query.color}.`);
    else if (judgment === "unknown") reasons.push(`Color ${query.color} was not confirmed.`);
  }

  if (offer.availability == null) {
    reasons.push("Availability was not confirmed.");
  }

  if (offer.priceCents == null) {
    reasons.push("USD price was not listed.");
  }

  return {
    ...rest,
    size: query.category === "clothing" ? (size?.label ?? null) : null,
    color: query.category === "clothing" ? color : null,
    packSize: pack,
    variantVerified,
    needsStaffReview: reasons.length > 0,
    reviewReason: reasons.length > 0 ? reasons.join(" ") : null,
  };
}

export function normalizeWalmartHit(
  hit: WalmartSearchHit,
  query: PlannedQuery,
  retrievedAt: string,
): BudgetBarrelOffer | null {
  const retailer = budgetBarrelRetailer("walmart");
  const title = hit.title?.trim() ?? "";
  if (title.length < 2) return null;
  const usItemId = hit.us_item_id?.trim() || "";
  const productUrl =
    httpsRetailerUrl(hit.product_page_url, retailer.host) ??
    httpsRetailerUrl(hit.link, retailer.host) ??
    (/^\d{5,}$/.test(usItemId) ? `https://www.walmart.com/ip/${usItemId}` : null);
  if (!productUrl) return null;

  const priced = walmartPrice(hit);
  const seller = marketplaceSellerName(
    hit.primary_offer?.seller_name || hit.seller_name,
    retailer.label,
  );
  const availability =
    hit.out_of_stock === true ? "out_of_stock"
    : hit.out_of_stock === false ? "in_stock"
    : null;

  return applyConstraints(
    {
      id: randomUUID(),
      productName: title,
      retailerKey: "walmart",
      retailer: retailer.label,
      sellerName: seller,
      productUrl,
      imageUrl: hit.thumbnail?.trim() || null,
      priceCents: priced.cents,
      currency: priced.cents == null ? null : priced.currency,
      availability,
      retrievedAt,
      deliveryCents: null,
      category: query.category,
      queryId: query.id,
      queryLabel: query.label,
      requiredSize: query.category === "clothing" ? query.size : null,
      requiredColor: query.category === "clothing" ? query.color : null,
      requiredPack: query.packSize,
      preferredBrand: query.brand,
      retailerProductId: usItemId || hit.product_id?.trim() || null,
      text: title,
    },
    query,
  );
}

export function googlePriceCents(hit: SerpShoppingResult): {
  cents: number | null;
  currency: "USD" | null;
} {
  if (hit.priceText && /€|£|¥|\b(?:cad|eur|gbp|aud)\b/i.test(hit.priceText)) {
    return { cents: null, currency: null };
  }
  const cents = usdAmountToCents(hit.priceUsd);
  return cents == null ? { cents: null, currency: null } : { cents, currency: "USD" };
}

export function normalizeAmazonHit(
  hit: AmazonSearchHit,
  query: PlannedQuery,
  retrievedAt: string,
): BudgetBarrelOffer | null {
  const retailer = budgetBarrelRetailer("amazon");
  const productUrl =
    httpsRetailerUrl(hit.link, retailer.host) ??
    (hit.asin ? amazonProductUrl(hit.asin, "amazon.com") : null);
  if (!productUrl || hit.title.trim().length < 2) return null;
  const priced = usdPriceFromUnknown(hit.priceUsd);
  return applyConstraints(
    {
      id: randomUUID(),
      productName: hit.title.trim(),
      retailerKey: "amazon",
      retailer: retailer.label,
      sellerName: null,
      productUrl,
      imageUrl: hit.imageUrl,
      priceCents: priced.cents,
      currency: priced.cents == null ? null : priced.currency,
      availability: null,
      retrievedAt,
      deliveryCents: null,
      category: query.category,
      queryId: query.id,
      queryLabel: query.label,
      requiredSize: query.category === "clothing" ? query.size : null,
      requiredColor: query.category === "clothing" ? query.color : null,
      requiredPack: query.packSize,
      preferredBrand: query.brand,
      retailerProductId: hit.asin,
      text: hit.title,
    },
    query,
  );
}

export function normalizeGoogleShoppingHit(
  hit: SerpShoppingResult,
  retailerKey: BudgetBarrelRetailerKey,
  query: PlannedQuery,
  retrievedAt: string,
): BudgetBarrelOffer | null {
  if (retailerKey === "walmart") return null;
  const retailer = budgetBarrelRetailer(retailerKey);
  const productUrl = httpsRetailerUrl(hit.productUrl, retailer.host);
  if (!productUrl || !hit.title.trim()) return null;
  const priced = googlePriceCents(hit);
  const seller = marketplaceSellerName(hit.retailer, retailer.label);

  return applyConstraints(
    {
      id: randomUUID(),
      productName: hit.title.trim(),
      retailerKey,
      retailer: retailer.label,
      sellerName: seller,
      productUrl,
      imageUrl: hit.imageUrl,
      priceCents: priced.cents,
      currency: priced.cents == null ? null : priced.currency,
      availability: null,
      retrievedAt,
      deliveryCents: hit.deliveryCents,
      category: query.category,
      queryId: query.id,
      queryLabel: query.label,
      requiredSize: query.category === "clothing" ? query.size : null,
      requiredColor: query.category === "clothing" ? query.color : null,
      requiredPack: query.packSize,
      preferredBrand: query.brand,
      retailerProductId: null,
      text: hit.title,
    },
    query,
  );
}

export function dedupeOffers(offers: BudgetBarrelOffer[]): BudgetBarrelOffer[] {
  const seen = new Set<string>();
  const out: BudgetBarrelOffer[] = [];
  for (const offer of offers) {
    const key = `${offer.queryId}:${offer.productUrl.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(offer);
  }
  return out;
}

export function offerSearchText(offer: Pick<BudgetBarrelOffer, "productName" | "size" | "packSize" | "color">): string {
  return [offer.productName, offer.size, offer.packSize, offer.color].filter(Boolean).join(" ");
}
