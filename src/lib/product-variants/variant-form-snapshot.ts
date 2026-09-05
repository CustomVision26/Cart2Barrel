import type { ProductVariantOffer } from "@/lib/product-variants/types";

export type VariantFormSnapshot = {
  productName: string | null;
  productSize: string | null;
  productColor: string | null;
  productUrl: string | null;
  priceUsdCents: number | null;
};

/** Fields copied into the request form when the shopper selects a variant. */
export function variantFormSnapshot(
  variant: ProductVariantOffer,
): VariantFormSnapshot {
  const label = variant.label?.trim() || "";
  let productName: string | null = null;
  if (label.includes("·")) {
    const parts = label.split("·").map((part) => part.trim()).filter(Boolean);
    productName = parts.at(-1) || parts[0] || null;
  } else if (label) {
    productName = label;
  }
  if (!productName) {
    productName = variant.productTitle?.trim() || null;
  }

  return {
    productName: productName && productName.length >= 2 ? productName : null,
    productSize: variant.size?.trim() || variant.packLabel?.trim() || null,
    productColor: variant.color?.trim() || null,
    productUrl: variant.productUrl?.trim() || null,
    priceUsdCents:
      variant.priceUsdCents != null && variant.priceUsdCents > 0
        ? variant.priceUsdCents
        : null,
  };
}
