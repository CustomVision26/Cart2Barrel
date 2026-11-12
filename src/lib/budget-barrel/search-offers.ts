import {
  BUDGET_BARREL_MAX_RESULTS_PER_SEARCH,
  BUDGET_BARREL_MAX_STORE_LOOKUPS,
  BUDGET_BARREL_MAX_VARIANT_LOOKUPS,
  budgetBarrelRetailer,
  type BudgetBarrelRetailerKey,
} from "@/lib/budget-barrel/constants";
import { judgeClothingSize, marketplaceSellerName } from "@/lib/budget-barrel/constraints";
import {
  dedupeOffers,
  googlePriceCents,
  normalizeAmazonHit,
  normalizeGoogleShoppingHit,
  normalizeWalmartHit,
  offerSearchText,
} from "@/lib/budget-barrel/normalize";
import { pickStoreLookups } from "@/lib/budget-barrel/store-lookups";
import type { BudgetBarrelOffer, PlannedQuery } from "@/lib/budget-barrel/types";
import { listingUrlMatchesRetailer } from "@/lib/product-url/listing-url";
import { parseProductUrl } from "@/lib/product-url/retailer-id";
import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { fetchImmersiveProductStoreOffers, fetchImmersiveProductVariants } from "@/lib/serpapi/google-immersive-product";
import { searchGoogleShopping, type SerpShoppingResult } from "@/lib/serpapi/google-shopping";
import { isSerpApiRateLimitError } from "@/lib/serpapi/http";
import { fetchWalmartProductSummary, fetchWalmartVariants } from "@/lib/serpapi/walmart-product";
import { searchAmazonProducts } from "@/lib/serpapi/amazon-product";
import { searchWalmartProducts } from "@/lib/serpapi/walmart-search";

function logProviderFailure(retailer: string, error: unknown) {
  const message = error instanceof Error ? error.message : "unknown";
  console.warn(`[Amani Cart2Barrel] Budget barrel ${retailer} search failed:`, message);
}

function providerNote(retailer: string, error: unknown, othersSelected: boolean): string {
  logProviderFailure(retailer, error);
  const message = error instanceof Error ? error.message : "";
  const limited = isSerpApiRateLimitError(message);
  if (!othersSelected) {
    return limited
      ? `${retailer} search is temporarily rate limited. Adjust your preferences or try again shortly.`
      : `${retailer} search is unavailable right now. Adjust your preferences or try the product-link or upload flow.`;
  }
  return limited
    ? `${retailer} search is temporarily rate limited. Showing results from the other selected retailers.`
    : `${retailer} search is unavailable right now. Showing results from the other selected retailers.`;
}

function needsSizeLookup(offer: BudgetBarrelOffer): boolean {
  if (offer.category !== "clothing" || !offer.requiredSize || offer.variantVerified) {
    return false;
  }
  return judgeClothingSize(offerSearchText(offer), offer.requiredSize) === "unknown";
}

function offerFromVariant(
  offer: BudgetBarrelOffer,
  variant: ProductVariantOffer,
  retrievedAt: string,
): BudgetBarrelOffer {
  const host = budgetBarrelRetailer(offer.retailerKey).host;
  const productUrl =
    variant.productUrl && listingUrlMatchesRetailer(host, variant.productUrl)
      ? variant.productUrl
      : offer.productUrl;
  const priceCents = variant.priceUsdCents ?? offer.priceCents;
  const availability =
    variant.inStock === false ? "out_of_stock"
    : variant.inStock === true ? "in_stock"
    : offer.availability;
  const review =
    availability == null ? "Availability was not confirmed."
    : priceCents == null ? "USD price was not listed."
    : null;
  return {
    ...offer,
    productName: variant.productTitle?.trim() || offer.productName,
    productUrl,
    imageUrl: variant.imageUrl || offer.imageUrl,
    size: variant.size?.trim() || offer.requiredSize,
    color: variant.color?.trim() || offer.color,
    packSize: variant.packLabel?.trim() || offer.packSize,
    priceCents,
    currency: priceCents != null ? "USD" : null,
    availability,
    retrievedAt,
    variantVerified: true,
    needsStaffReview: review != null,
    reviewReason: review,
    retailerProductId: variant.retailerProductId ?? offer.retailerProductId,
  };
}

function markSizeConflict(offer: BudgetBarrelOffer, sizes: string[]): BudgetBarrelOffer {
  const different = sizes.find(
    (size) => judgeClothingSize(size, offer.requiredSize) === "conflict",
  );
  if (!different) return offer;
  return {
    ...offer,
    size: different,
    variantVerified: false,
    needsStaffReview: true,
    reviewReason: `Listing size does not match ${offer.requiredSize}. A different size was not substituted.`,
  };
}

async function enrichUnknownSizes(
  offers: BudgetBarrelOffer[],
  tokens: Map<string, string>,
): Promise<BudgetBarrelOffer[]> {
  let lookups = 0;
  const retrievedAt = new Date().toISOString();
  const next: BudgetBarrelOffer[] = [];

  for (const offer of offers) {
    if (!needsSizeLookup(offer) || lookups >= BUDGET_BARREL_MAX_VARIANT_LOOKUPS) {
      next.push(offer);
      continue;
    }

    try {
      if (offer.retailerKey === "walmart" && offer.retailerProductId) {
        lookups += 1;
        const result = await fetchWalmartVariants(offer.retailerProductId);
        const match = result.variants.find(
          (variant) =>
            judgeClothingSize(
              `${variant.size ?? ""} ${variant.label}`,
              offer.requiredSize,
            ) === "match" && Boolean(variant.productUrl),
        );
        next.push(
          match
            ? offerFromVariant(offer, match, retrievedAt)
            : markSizeConflict(
                offer,
                result.variants.map((variant) => variant.size ?? "").filter(Boolean),
              ),
        );
        continue;
      }

      const token = tokens.get(offer.id);
      if (offer.retailerKey !== "walmart" && token) {
        lookups += 1;
        const variants = await fetchImmersiveProductVariants(token, {
          retailerHostname: budgetBarrelRetailer(offer.retailerKey).host,
          fallbackProductUrl: offer.productUrl,
        });
        const match = variants.find(
          (variant) =>
            judgeClothingSize(
              `${variant.size ?? ""} ${variant.label}`,
              offer.requiredSize,
            ) === "match" && Boolean(variant.productUrl),
        );
        next.push(
          match
            ? offerFromVariant(offer, match, retrievedAt)
            : markSizeConflict(
                offer,
                variants.map((variant) => variant.size ?? "").filter(Boolean),
              ),
        );
        continue;
      }
    } catch (error) {
      logProviderFailure(offer.retailer, error);
      next.push({
        ...offer,
        needsStaffReview: true,
        reviewReason: "Variant lookup failed. Confirm the size before quoting.",
      });
      continue;
    }

    next.push(offer);
  }

  return next;
}

type PendingStoreLookup = {
  token: string;
  query: PlannedQuery;
  retailerKey: BudgetBarrelRetailerKey;
  title: string;
  imageUrl: string | null;
};

function sourceIsRetailer(source: string, retailerLabel: string): boolean {
  const trimmed = source.trim();
  if (!trimmed) return false;
  return marketplaceSellerName(trimmed, retailerLabel) == null;
}

function googleQueryText(text: string, retailerLabel: string | null): string {
  const trimmed = text.trim();
  if (!retailerLabel) return trimmed;
  if (trimmed.toLowerCase().includes(retailerLabel.toLowerCase())) return trimmed;
  return `${trimmed} ${retailerLabel}`;
}

async function searchGoogleForRetailers(input: {
  query: PlannedQuery;
  retailers: BudgetBarrelRetailerKey[];
  location: string | null;
  retrievedAt: string;
  tokens: Map<string, string>;
  pendingStores: PendingStoreLookup[];
  retailerLabel?: string | null;
}): Promise<BudgetBarrelOffer[]> {
  const queryText = googleQueryText(input.query.text, input.retailerLabel ?? null);
  const run = (location: string | null) =>
    searchGoogleShopping(queryText, {
      maxResults: BUDGET_BARREL_MAX_RESULTS_PER_SEARCH,
      location,
    });

  const absorb = (hits: SerpShoppingResult[]) => {
    const offers: BudgetBarrelOffer[] = [];
    let queued = 0;
    for (const retailerKey of input.retailers) {
      const retailer = budgetBarrelRetailer(retailerKey);
      for (const hit of hits) {
        const offer = normalizeGoogleShoppingHit(
          hit,
          retailerKey,
          input.query,
          input.retrievedAt,
        );
        if (offer) {
          if (hit.immersiveProductPageToken) {
            input.tokens.set(offer.id, hit.immersiveProductPageToken);
          }
          offers.push(offer);
          continue;
        }
        if (
          hit.immersiveProductPageToken &&
          sourceIsRetailer(hit.retailer, retailer.label) &&
          !input.pendingStores.some((row) => row.token === hit.immersiveProductPageToken)
        ) {
          input.pendingStores.push({
            token: hit.immersiveProductPageToken,
            query: input.query,
            retailerKey,
            title: hit.title,
            imageUrl: hit.imageUrl,
          });
          queued += 1;
        }
      }
    }
    return { offers, queued };
  };

  let hits: SerpShoppingResult[];
  try {
    hits = await run(input.location);
  } catch (error) {
    if (!input.location || isSerpApiRateLimitError(error)) throw error;
    hits = await run(null);
  }

  let absorbed = absorb(hits);
  if (input.location && absorbed.offers.length === 0 && absorbed.queued === 0) {
    absorbed = absorb(await run(null));
  }
  return absorbed.offers;
}

async function resolveStoreLookups(
  pending: PendingStoreLookup[],
  retrievedAt: string,
  coveredQueryIds: ReadonlySet<string>,
): Promise<BudgetBarrelOffer[]> {
  const offers: BudgetBarrelOffer[] = [];
  const slice = pickStoreLookups(
    pending.map((row) => ({ ...row, queryId: row.query.id })),
    coveredQueryIds,
    BUDGET_BARREL_MAX_STORE_LOOKUPS,
  );
  await Promise.all(
    slice.map(async (row) => {
      try {
        const stores = await fetchImmersiveProductStoreOffers(row.token);
        const retailer = budgetBarrelRetailer(row.retailerKey);
        const match = stores.find((store) => listingUrlMatchesRetailer(retailer.host, store.productUrl));
        if (!match) return;
        const hit: SerpShoppingResult = {
          title: match.title || row.title,
          retailer: match.retailer,
          productUrl: match.productUrl,
          priceUsd: match.priceUsd,
          priceText: null,
          imageUrl: match.imageUrl ?? row.imageUrl,
          immersiveProductPageToken: row.token,
          deliveryCents: null,
        };
        const offer = normalizeGoogleShoppingHit(hit, row.retailerKey, row.query, retrievedAt);
        if (offer) offers.push(offer);
      } catch (error) {
        logProviderFailure(budgetBarrelRetailer(row.retailerKey).label, error);
      }
    }),
  );
  return offers;
}

export async function searchBudgetBarrelOffers(input: {
  queries: PlannedQuery[];
  retailers: BudgetBarrelRetailerKey[];
  location: string | null;
}): Promise<{ offers: BudgetBarrelOffer[]; providerNotes: string[] }> {
  const retrievedAt = new Date().toISOString();
  const tokens = new Map<string, string>();
  const pendingStores: PendingStoreLookup[] = [];
  const notes = new Map<string, string>();
  const collected: BudgetBarrelOffer[] = [];
  const wantWalmart = input.retailers.includes("walmart");
  const wantAmazon = input.retailers.includes("amazon");
  const otherRetailers = input.retailers.filter((key) => key !== "walmart" && key !== "amazon");
  const othersSelected = input.retailers.length > 1;

  await Promise.all(
    input.queries.map(async (query) => {
      const tasks: Promise<void>[] = [];
      if (wantWalmart) {
        tasks.push(
          searchWalmartProducts(query.text, {
            maxResults: BUDGET_BARREL_MAX_RESULTS_PER_SEARCH,
          })
            .then((hits) => {
              for (const hit of hits) {
                const offer = normalizeWalmartHit(hit, query, retrievedAt);
                if (offer) collected.push(offer);
              }
            })
            .catch((error: unknown) => {
              notes.set("walmart", providerNote("Walmart", error, othersSelected));
            }),
        );
      }
      if (wantAmazon) {
        tasks.push(
          searchAmazonProducts(query.text, BUDGET_BARREL_MAX_RESULTS_PER_SEARCH)
            .then((hits) => {
              for (const hit of hits) {
                const offer = normalizeAmazonHit(hit, query, retrievedAt);
                if (offer) collected.push(offer);
              }
            })
            .catch((error: unknown) => {
              notes.set("amazon", providerNote("Amazon", error, othersSelected));
            }),
        );
      }
      if (otherRetailers.length > 0) {
        tasks.push(
          searchGoogleForRetailers({
            query,
            retailers: otherRetailers,
            location: input.location,
            retrievedAt,
            tokens,
            pendingStores,
            retailerLabel:
              otherRetailers.length === 1
                ? budgetBarrelRetailer(otherRetailers[0]).label
                : null,
          })
            .then((offers) => {
              collected.push(...offers);
            })
            .catch((error: unknown) => {
              for (const key of otherRetailers) {
                notes.set(
                  key,
                  providerNote(budgetBarrelRetailer(key).label, error, othersSelected),
                );
              }
            }),
        );
      }
      await Promise.all(tasks);
    }),
  );

  if (otherRetailers.length > 1) {
    const missing = input.queries.flatMap((query) =>
      otherRetailers
        .filter(
          (retailerKey) =>
            !collected.some(
              (offer) => offer.queryId === query.id && offer.retailerKey === retailerKey,
            ),
        )
        .map((retailerKey) => ({ query, retailerKey, queryId: query.id })),
    );
    const followUps = pickStoreLookups(missing, new Set(), BUDGET_BARREL_MAX_STORE_LOOKUPS);
    await Promise.all(
      followUps.map((row) =>
        searchGoogleForRetailers({
          query: row.query,
          retailers: [row.retailerKey],
          location: input.location,
          retrievedAt,
          tokens,
          pendingStores,
          retailerLabel: budgetBarrelRetailer(row.retailerKey).label,
        })
          .then((offers) => {
            collected.push(...offers);
          })
          .catch((error: unknown) => {
            notes.set(
              row.retailerKey,
              providerNote(budgetBarrelRetailer(row.retailerKey).label, error, true),
            );
          }),
      ),
    );
  }

  const coveredQueryIds = new Set(collected.map((offer) => offer.queryId));
  const resolvedStores = await resolveStoreLookups(pendingStores, retrievedAt, coveredQueryIds);
  const deduped = dedupeOffers([...collected, ...resolvedStores]);
  const enriched = await enrichUnknownSizes(deduped, tokens);
  return { offers: enriched, providerNotes: [...notes.values()] };
}

function flagUnrefreshed(offer: BudgetBarrelOffer, reason: string): BudgetBarrelOffer {
  return {
    ...offer,
    needsStaffReview: true,
    reviewReason: reason,
  };
}

/** Refresh one stale offer. Keeps the previous USD price when the new lookup has none. */
export async function refreshBudgetBarrelOffer(
  offer: BudgetBarrelOffer,
  location: string | null,
): Promise<BudgetBarrelOffer> {
  const retrievedAt = new Date().toISOString();
  try {
    if (offer.retailerKey === "walmart") {
      const productId =
        offer.retailerProductId ||
        parseProductUrl(offer.productUrl)?.walmartProductId ||
        null;
      if (!productId) return flagUnrefreshed(offer, "Price could not be refreshed. Confirm before quoting.");
      const summary = await fetchWalmartProductSummary(productId);
      const productUrl =
        summary.productUrl &&
        listingUrlMatchesRetailer(budgetBarrelRetailer("walmart").host, summary.productUrl)
          ? summary.productUrl
          : offer.productUrl;
      return {
        ...offer,
        productName: summary.title?.trim() || offer.productName,
        productUrl,
        imageUrl: summary.imageUrl || offer.imageUrl,
        priceCents: summary.priceUsdCents ?? offer.priceCents,
        currency: summary.priceUsdCents != null ? "USD" : offer.currency,
        retrievedAt,
        needsStaffReview: summary.priceUsdCents == null || offer.needsStaffReview,
        reviewReason:
          summary.priceUsdCents == null
            ? "Refreshed listing had no USD price. Confirm before quoting."
            : offer.reviewReason,
      };
    }

    const retailer = budgetBarrelRetailer(offer.retailerKey);
    const hits = await searchGoogleShopping(`${offer.productName} ${retailer.label}`, {
      maxResults: 5,
      location,
    });
    const match = hits.find((hit) => listingUrlMatchesRetailer(retailer.host, hit.productUrl));
    if (!match) return flagUnrefreshed(offer, "Price could not be refreshed. Confirm before quoting.");
    const priced = googlePriceCents(match);
    return {
      ...offer,
      productUrl: match.productUrl,
      imageUrl: match.imageUrl || offer.imageUrl,
      priceCents: priced.cents ?? offer.priceCents,
      currency: priced.cents != null ? "USD" : offer.currency,
      deliveryCents: match.deliveryCents ?? offer.deliveryCents,
      retrievedAt,
      needsStaffReview: priced.cents == null || offer.needsStaffReview,
      reviewReason:
        priced.cents == null
          ? "Refreshed listing had no USD price. Confirm before quoting."
          : offer.reviewReason,
    };
  } catch (error) {
    logProviderFailure(offer.retailer, error);
    return flagUnrefreshed(offer, "Price could not be refreshed. Confirm before quoting.");
  }
}
