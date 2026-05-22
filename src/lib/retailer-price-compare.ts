import {
  MATCH_CONFIDENCE_THRESHOLD,
  verifyShoppingMatchesWithOpenAI,
  type ShoppingMatchCandidate,
} from "@/lib/ai/verify-shopping-matches";
import { searchGoogleShopping } from "@/lib/serpapi/google-shopping";
import { hostnameFromProductUrl } from "@/lib/site-name";

export type RetailerPriceOffer = {
  id: string;
  retailer: string;
  title: string;
  productUrl: string;
  priceUsdCents: number | null;
  imageUrl: string | null;
  matchConfidence: number | null;
  isOriginal: boolean;
};

export type CompareRetailerPricesResult =
  | { ok: true; offers: RetailerPriceOffer[]; searchQuery: string }
  | { ok: false; message: string };

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
      maxResults: 12,
    });

    const candidates: ShoppingMatchCandidate[] = shoppingHits.map((hit, index) => ({
      index,
      title: hit.title,
      retailer: hit.retailer,
    }));

    const verifications =
      candidates.length > 0 ?
        await verifyShoppingMatchesWithOpenAI(
          {
            title: input.productName,
            size: input.productSize?.trim() || null,
            color: input.productColor?.trim() || null,
            retailer: input.originalRetailer?.trim() || null,
          },
          candidates,
        )
      : [];

    const verifiedOffers: RetailerPriceOffer[] = [];

    for (let i = 0; i < shoppingHits.length; i++) {
      const hit = shoppingHits[i]!;
      const v = verifications.find((r) => r.candidateIndex === i);
      const confidence = v?.match ? v.confidence : 0;
      if (!v?.match || confidence < MATCH_CONFIDENCE_THRESHOLD) continue;

      verifiedOffers.push({
        id: `serp-${i}`,
        retailer: hit.retailer,
        title: hit.title,
        productUrl: hit.productUrl,
        priceUsdCents: priceUsdToCents(hit.priceUsd),
        imageUrl: hit.imageUrl,
        matchConfidence: confidence,
        isOriginal: false,
      });
    }

    const origUrl = input.originalProductUrl?.trim();
    if (origUrl) {
      const alreadyListed = verifiedOffers.some((o) => o.productUrl === origUrl);
      if (!alreadyListed) {
        verifiedOffers.unshift({
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
          isOriginal: true,
        });
      } else {
        const idx = verifiedOffers.findIndex((o) => o.productUrl === origUrl);
        if (idx >= 0) {
          verifiedOffers[idx] = {
            ...verifiedOffers[idx],
            isOriginal: true,
            matchConfidence: null,
            priceUsdCents:
              verifiedOffers[idx].priceUsdCents ?? input.originalPriceUsdCents ?? null,
            imageUrl:
              verifiedOffers[idx].imageUrl ?? input.originalImageUrl?.trim() ?? null,
          };
        }
      }
    }

    verifiedOffers.sort((a, b) => {
      if (a.isOriginal && !b.isOriginal) return -1;
      if (!a.isOriginal && b.isOriginal) return 1;
      const pa = a.priceUsdCents ?? Number.MAX_SAFE_INTEGER;
      const pb = b.priceUsdCents ?? Number.MAX_SAFE_INTEGER;
      return pa - pb;
    });

    if (verifiedOffers.length === 0) {
      return {
        ok: false,
        message:
          "No matching offers passed verification. Try refining the product name.",
      };
    }

    return { ok: true, offers: verifiedOffers, searchQuery };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not compare retailer prices.";
    return { ok: false, message };
  }
}
