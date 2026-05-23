import type { ProductVariantOffer } from "@/lib/product-variants/types";

function variantAttributeLine(variant: ProductVariantOffer): string {
  return [variant.color, variant.size, variant.packLabel]
    .filter(Boolean)
    .join(" · ");
}

/** Attach SerpApi listing title and a readable row label for the variants table. */
export function enrichVariantsWithListingTitle(
  variants: ProductVariantOffer[],
  listingTitle: string | null | undefined,
): ProductVariantOffer[] {
  const title = listingTitle?.trim();
  if (!title) return variants;

  return variants.map((variant) => {
    const attrs = variantAttributeLine(variant);
    const label = variant.label?.trim() ?? "";
    let displayLabel = title;

    if (attrs) {
      displayLabel = `${title} · ${attrs}`;
    } else if (
      label &&
      label !== "Default" &&
      !label.toLowerCase().includes(title.toLowerCase())
    ) {
      displayLabel = `${title} · ${label}`;
    }

    return {
      ...variant,
      productTitle: title,
      label: displayLabel,
    };
  });
}
