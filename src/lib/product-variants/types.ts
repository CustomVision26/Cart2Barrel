/** One purchasable SKU / variant at a retailer (same store as the listing URL). */
export type ProductVariantOffer = {
  id: string;
  /** Human-readable row label, e.g. "Red · XL · 6 pack". */
  label: string;
  size: string | null;
  color: string | null;
  /** Pack count, volume, or other quantity descriptor when not size/color. */
  packLabel: string | null;
  priceUsdCents: number | null;
  productUrl: string | null;
  imageUrl: string | null;
  inStock: boolean | null;
  /** Matches the URL or selection the shopper started from. */
  isCurrent: boolean;
  source: "walmart" | "amazon" | "immersive" | "page_ai";
  /** SerpApi / retailer SKU used to refresh price and URL (Walmart `product_id`). */
  retailerProductId?: string | null;
  /** Parent listing title from SerpApi (Walmart/Amazon product API). */
  productTitle?: string | null;
};

export type FetchProductVariantsResult =
  | {
      ok: true;
      retailer: string;
      variants: ProductVariantOffer[];
      method: string;
      /** SerpApi listing title (Walmart/Amazon product API). */
      listingTitle?: string | null;
      /** SerpApi hero image for the listing. */
      listingImageUrl?: string | null;
    }
  | { ok: false; message: string };
