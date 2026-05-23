import {
  verifyShoppingMatchesWithOpenAI,
  type ShoppingMatchCandidate,
} from "@/lib/ai/verify-shopping-matches";
import { fetchImmersiveProductStoreOffers } from "@/lib/serpapi/google-immersive-product";
import {
  searchGoogleShopping,
  type SerpShoppingResult,
} from "@/lib/serpapi/google-shopping";
import { hostnameFromProductUrl } from "@/lib/site-name";

export type RetailerPriceOffer = {
  id: string;
  retailer: string;
  title: string;
  productUrl: string;
  priceUsdCents: number | null;
  imageUrl: string | null;
  matchConfidence: number | null;
  /** OpenAI confirmed same SKU (see COMPARE_VERIFIED_THRESHOLD). */
  aiVerified: boolean;
  isOriginal: boolean;
};

export type CompareRetailerPricesResult =
  | {
      ok: true;
      offers: RetailerPriceOffer[];
      searchQuery: string;
      verifiedCount: number;
    }
  | { ok: false; message: string };

/** Minimum AI confidence to label an offer as verified (same SKU). */
export const COMPARE_VERIFIED_THRESHOLD = 0.75;

function buildSearchQuery(input: {
  productName: string;
  productSize?: string;
  productColor?: string;
}): string {
  return [input.productName, input.productSize, input.productColor]
    .filter((s) => s?.trim())
    .join(" ")
    .trim();
}

function priceUsdToCents(usd: number | null): number | null {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return null;
  return Math.round(usd * 100);
}

function normalizeRetailerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function pickShoppingHitForImmersive(
  hits: SerpShoppingResult[],
  productName: string,
  originalRetailer?: string,
): SerpShoppingResult | null {
  const withToken = hits.filter((h) => h.immersiveProductPageToken);
  if (withToken.length === 0) return null;

  const retailerNeedle = originalRetailer?.trim().toLowerCase();
  if (retailerNeedle) {
    const byRetailer = withToken.find((h) => {
      const r = h.retailer.toLowerCase();
      return r.includes(retailerNeedle) || retailerNeedle.includes(r.split(" ")[0] ?? "");
    });
    if (byRetailer) return byRetailer;
  }

  const origHost = originalRetailer?.trim().toLowerCase();
  const nameTokens = productName
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3)
    .slice(0, 4);

  let best: SerpShoppingResult | null = null;
  let bestScore = -1;
  for (const hit of withToken) {
    let score = 0;
    const title = hit.title.toLowerCase();
    for (const token of nameTokens) {
      if (title.includes(token)) score += 1;
    }
    if (origHost && hit.retailer.toLowerCase().includes(origHost.split(".")[0] ?? "")) {
      score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = hit;
    }
  }

  return best ?? withToken[0] ?? null;
}

export async function compareRetailerPrices(input: {
  productName: string;
  productSize?: string;
  productColor?: string;
  originalProductUrl?: string;
  originalRetailer?: string;
  originalPriceUsdCents?: number;
  originalImageUrl?: string;
}): Promise<CompareRetailerPricesResult> {
  const searchQuery = buildSearchQuery(input);
  if (searchQuery.length < 2) {
    return { ok: false, message: "Product name is required to compare retailers." };
  }

  try {
    const shoppingHits = await searchGoogleShopping(searchQuery, {
      maxResults: 20,
    });

    if (shoppingHits.length === 0) {
      return {
        ok: false,
        message:
          "No shopping results found for this product. Try a more specific product name.",
      };
    }

    const immersiveHit = pickShoppingHitForImmersive(
      shoppingHits,
      input.productName,
      input.originalRetailer,
    );
    const immersiveStores =
      immersiveHit?.immersiveProductPageToken ?
        await fetchImmersiveProductStoreOffers(immersiveHit.immersiveProductPageToken)
      : [];

    const verificationCandidates: ShoppingMatchCandidate[] = [];

    if (immersiveStores.length > 0) {
      for (let i = 0; i < immersiveStores.length; i++) {
        const store = immersiveStores[i]!;
        verificationCandidates.push({
          index: i,
          title: store.title,
          retailer: store.retailer,
        });
      }
    } else {
      for (let i = 0; i < shoppingHits.length; i++) {
        const hit = shoppingHits[i]!;
        verificationCandidates.push({
          index: i,
          title: hit.title,
          retailer: hit.retailer,
        });
      }
    }

    let verifications: Awaited<
      ReturnType<typeof verifyShoppingMatchesWithOpenAI>
    > = [];
    try {
      if (verificationCandidates.length > 0) {
        verifications = await verifyShoppingMatchesWithOpenAI(
          {
            title: input.productName,
            size: input.productSize?.trim() || null,
            color: input.productColor?.trim() || null,
            retailer: input.originalRetailer?.trim() || null,
          },
          verificationCandidates,
        );
      }
    } catch {
      /* Show SerpApi rows even when AI verification is unavailable. */
    }

    const offers: RetailerPriceOffer[] = [];
    const seenUrls = new Set<string>();
    const seenRetailers = new Set<string>();

    const pushOffer = (offer: RetailerPriceOffer) => {
      const urlKey = offer.productUrl.trim().toLowerCase();
      const retailerKey = normalizeRetailerKey(offer.retailer);
      if (seenUrls.has(urlKey)) return;
      if (!offer.isOriginal && seenRetailers.has(retailerKey)) return;
      seenUrls.add(urlKey);
      if (!offer.isOriginal) seenRetailers.add(retailerKey);
      offers.push(offer);
    };

    if (immersiveStores.length > 0) {
      for (let i = 0; i < immersiveStores.length; i++) {
        const store = immersiveStores[i]!;
        const v = verifications.find((r) => r.candidateIndex === i);
        const confidence = v?.confidence ?? null;
        const aiVerified = Boolean(
          v?.match &&
            confidence != null &&
            confidence >= COMPARE_VERIFIED_THRESHOLD,
        );

        pushOffer({
          id: `immersive-${i}`,
          retailer: store.retailer,
          title: store.title,
          productUrl: store.productUrl,
          priceUsdCents: priceUsdToCents(store.priceUsd),
          imageUrl: store.imageUrl,
          matchConfidence: confidence,
          aiVerified,
          isOriginal: false,
        });
      }
    }

    if (immersiveStores.length === 0) {
      for (let i = 0; i < shoppingHits.length; i++) {
        const hit = shoppingHits[i]!;
        const v = verifications.find((r) => r.candidateIndex === i);
        const confidence = v?.confidence ?? null;
        const aiVerified = Boolean(
          v?.match &&
            confidence != null &&
            confidence >= COMPARE_VERIFIED_THRESHOLD,
        );

        pushOffer({
          id: `serp-${i}`,
          retailer: hit.retailer,
          title: hit.title,
          productUrl: hit.productUrl,
          priceUsdCents: priceUsdToCents(hit.priceUsd),
          imageUrl: hit.imageUrl,
          matchConfidence: confidence,
          aiVerified,
          isOriginal: false,
        });
      }
    }

    const origUrl = input.originalProductUrl?.trim();
    if (origUrl) {
      const existingIdx = offers.findIndex((o) => o.productUrl === origUrl);
      if (existingIdx < 0) {
        pushOffer({
          id: "original",
          retailer:
            input.originalRetailer?.trim() ||
            hostnameFromProductUrl(origUrl) ||
            "Original listing",
          title: input.productName,
          productUrl: origUrl,
          priceUsdCents: input.originalPriceUsdCents ?? null,
          imageUrl: input.originalImageUrl?.trim() || null,
          matchConfidence: null,
          aiVerified: true,
          isOriginal: true,
        });
      } else {
        offers[existingIdx] = {
          ...offers[existingIdx]!,
          isOriginal: true,
          aiVerified: true,
          matchConfidence: null,
          priceUsdCents:
            offers[existingIdx]!.priceUsdCents ??
            input.originalPriceUsdCents ??
            null,
          imageUrl:
            offers[existingIdx]!.imageUrl ??
            input.originalImageUrl?.trim() ??
            null,
        };
      }
    }

    offers.sort((a, b) => {
      if (a.isOriginal && !b.isOriginal) return -1;
      if (!a.isOriginal && b.isOriginal) return 1;
      if (a.aiVerified && !b.aiVerified) return -1;
      if (!a.aiVerified && b.aiVerified) return 1;
      const pa = a.priceUsdCents ?? Number.MAX_SAFE_INTEGER;
      const pb = b.priceUsdCents ?? Number.MAX_SAFE_INTEGER;
      return pa - pb;
    });

    const verifiedCount = offers.filter((o) => o.aiVerified && !o.isOriginal).length;

    return {
      ok: true,
      offers,
      searchQuery,
      verifiedCount,
    };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not compare retailer prices.";
    return { ok: false, message };
  }
}
