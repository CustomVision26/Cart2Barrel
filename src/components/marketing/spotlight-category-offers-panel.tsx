"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  SpotlightProductOffersCarousel,
  type SpotlightGalleryImage,
  type SpotlightOfferSlide,
} from "@/components/marketing/spotlight-product-offers-carousel";
import type { PublicSpotlightProduct } from "@/data/spotlight-category-products";
import {
  aiAssistedRequestUrlWithSpotlightProduct,
  aiAssistedRequestUrlWithSpotlightVariant,
} from "@/lib/ai-assisted-request-url";
import type { SpotlightCategoryDefinition } from "@/lib/spotlight-categories";
import { displaySiteName, retailerLabelFromProductUrl } from "@/lib/site-name";

function offerImageUrl(
  primary: string | null | undefined,
  fallback: string | null | undefined,
): string | null {
  const a = primary?.trim();
  if (a) return a;
  return fallback?.trim() || null;
}

function formatAttributes(parts: Array<string | null | undefined>): string | null {
  const text = parts.map((p) => p?.trim()).filter(Boolean).join(" · ");
  return text || null;
}

function buildProductGallery(
  product: PublicSpotlightProduct,
  parentTitle: string,
): SpotlightGalleryImage[] {
  const seen = new Set<string>();
  const images: SpotlightGalleryImage[] = [];

  function add(
    id: string,
    url: string | null | undefined,
    label: string | null,
  ) {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    images.push({ id, imageUrl: trimmed, label });
  }

  add(product.id, product.imageUrl, parentTitle);
  for (const variant of product.variants ?? []) {
    add(
      variant.id,
      offerImageUrl(variant.imageUrl, product.imageUrl),
      variant.label?.trim() ||
        formatAttributes([
          variant.productColor,
          variant.productSize,
          variant.packLabel,
        ]),
    );
  }

  return images;
}

export function buildOffersForProduct(
  product: PublicSpotlightProduct,
  isSignedIn: boolean,
): SpotlightOfferSlide[] {
  const title =
    product.label?.trim() || displaySiteName(null, product.productUrl);
  const variants = product.variants ?? [];
  const galleryImages = buildProductGallery(product, title);
  const parentAddHref =
    isSignedIn ?
      aiAssistedRequestUrlWithSpotlightProduct(product)
    : `/signup?redirect_url=${encodeURIComponent(aiAssistedRequestUrlWithSpotlightProduct(product))}`;

  const slides: SpotlightOfferSlide[] = [
    {
      id: product.id,
      title,
      imageUrl: offerImageUrl(product.imageUrl, null),
      priceUsdCents: product.priceUsdCents,
      attributes: formatAttributes([product.productSize, product.productColor]),
      storeUrl: product.productUrl,
      addHref: parentAddHref,
      retailerName: retailerLabelFromProductUrl(product.productUrl),
      galleryImages,
      badge: variants.length > 0 ? "Featured" : undefined,
    },
  ];

  for (const variant of variants) {
    const variantHref =
      isSignedIn ?
        aiAssistedRequestUrlWithSpotlightVariant(product, variant)
      : `/signup?redirect_url=${encodeURIComponent(aiAssistedRequestUrlWithSpotlightVariant(product, variant))}`;

    slides.push({
      id: variant.id,
      title: variant.label?.trim() || "Variant",
      imageUrl: offerImageUrl(variant.imageUrl, product.imageUrl),
      priceUsdCents: variant.priceUsdCents,
      attributes: formatAttributes([
        variant.productColor,
        variant.productSize,
        variant.packLabel,
      ]),
      storeUrl: variant.productUrl,
      addHref: variantHref,
      retailerName: retailerLabelFromProductUrl(variant.productUrl),
      galleryImages,
    });
  }

  return slides;
}

export function buildAllCategoryOffers(
  products: PublicSpotlightProduct[],
  isSignedIn: boolean,
): SpotlightOfferSlide[] {
  return products.flatMap((p) => buildOffersForProduct(p, isSignedIn));
}

export function countCategoryOffers(
  products: PublicSpotlightProduct[],
  isSignedIn: boolean,
): number {
  return buildAllCategoryOffers(products, isSignedIn).length;
}

function ProductOfferSection({
  product,
  isSignedIn,
}: {
  product: PublicSpotlightProduct;
  isSignedIn: boolean;
}) {
  const title =
    product.label?.trim() || displaySiteName(null, product.productUrl);
  const offers = buildOffersForProduct(product, isSignedIn);

  return (
    <li className="rounded-xl border border-border/80 bg-muted/10 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-pretty text-sm font-semibold text-foreground">
          {title}
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {offers.length} {offers.length === 1 ? "option" : "options"}
        </span>
      </div>
      <SpotlightProductOffersCarousel offers={offers} />
    </li>
  );
}

type SpotlightCategoryOffersPanelProps = {
  category: SpotlightCategoryDefinition;
  products: PublicSpotlightProduct[];
  isSignedIn: boolean;
};

export function SpotlightCategoryOffersPanel({
  category,
  products,
  isSignedIn,
}: SpotlightCategoryOffersPanelProps) {
  const signupReturn =
    products[0] ?
      aiAssistedRequestUrlWithSpotlightProduct(products[0])
    : "/dashboard/items/requested-items/ai-assisted-request";

  const allOffers = buildAllCategoryOffers(products, isSignedIn);
  const multipleProductLines = products.length > 1;

  if (products.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          No curated products in {category.title} yet. Check back soon or request
          any item from your dashboard.
        </p>
        <Button
          nativeButton={false}
          render={<Link href={isSignedIn ? "/dashboard" : "/signup"} />}
        >
          {isSignedIn ? "Go to dashboard" : "Get started"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {multipleProductLines ?
        <ul className="space-y-6">
          {products.map((product) => (
            <ProductOfferSection
              key={product.id}
              product={product}
              isSignedIn={isSignedIn}
            />
          ))}
        </ul>
      : <SpotlightProductOffersCarousel offers={allOffers} className="pb-1" />
      }

      {!isSignedIn ?
        <p className="text-center text-xs text-muted-foreground">
          <Link
            href={`/login?redirect_url=${encodeURIComponent(signupReturn)}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>{" "}
          to add a request with your account.
        </p>
      : null}
    </div>
  );
}
