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
