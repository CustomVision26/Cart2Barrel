"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { SpotlightVariantShop } from "@/components/marketing/spotlight-variant-shop";
import {
  filterProductsByRetailer,
  SPOTLIGHT_RETAILER_ALL,
  SpotlightCategoryRetailerMenu,
  uniqueSpotlightRetailers,
} from "@/components/marketing/spotlight-category-retailer-menu";
import {
  galleryStartIndex,
  SpotlightImageViewer,
  type ImageViewerState,
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
import type { SpotlightVariantSku } from "@/lib/spotlight-variant-axes";

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

function requestHref(
  isSignedIn: boolean,
  href: string,
): string {
  return isSignedIn
    ? href
    : `/signup?redirect_url=${encodeURIComponent(href)}`;
}

function skuFromParent(
  product: PublicSpotlightProduct,
  isSignedIn: boolean,
): SpotlightVariantSku {
  return {
    id: product.id,
    color: product.productColor?.trim() || null,
    size: product.productSize?.trim() || null,
    packLabel: null,
    imageUrl: product.imageUrl,
    priceUsdCents: product.priceUsdCents,
    storeUrl: product.productUrl,
    addHref: requestHref(
      isSignedIn,
      aiAssistedRequestUrlWithSpotlightProduct(product),
    ),
  };
}

function collectVariantSkus(
  product: PublicSpotlightProduct,
  isSignedIn: boolean,
): SpotlightVariantSku[] {
  const variants = product.variants ?? [];
  if (variants.length > 0) {
    return variants.map((variant) => ({
      id: variant.id,
      color: variant.productColor?.trim() || null,
      size: variant.productSize?.trim() || null,
      packLabel: variant.packLabel?.trim() || null,
      imageUrl: offerImageUrl(variant.imageUrl, product.imageUrl),
      priceUsdCents: variant.priceUsdCents,
      storeUrl: variant.productUrl,
      addHref: requestHref(
        isSignedIn,
        aiAssistedRequestUrlWithSpotlightVariant(product, variant),
      ),
    }));
  }

  return [skuFromParent(product, isSignedIn)];
}

export function buildOffersForProduct(
  product: PublicSpotlightProduct,
  isSignedIn: boolean,
): SpotlightOfferSlide[] {
  const title =
    product.label?.trim() || displaySiteName(null, product.productUrl);
  const variants = product.variants ?? [];
  const galleryImages = buildProductGallery(product, title);
  const variantSkus = collectVariantSkus(product, isSignedIn);

  return [
    {
      id: product.id,
      title,
      imageUrl: offerImageUrl(product.imageUrl, null),
      priceUsdCents: product.priceUsdCents,
      attributes: formatAttributes([product.productSize, product.productColor]),
      storeUrl: product.productUrl,
      addHref: requestHref(
        isSignedIn,
        aiAssistedRequestUrlWithSpotlightProduct(product),
      ),
      retailerName: retailerLabelFromProductUrl(product.productUrl),
      galleryImages,
      badge: variants.length > 0 ? "Featured" : undefined,
      variantSkus,
    },
  ];
}

export function countCategoryOffers(
  products: PublicSpotlightProduct[],
): number {
  return products.length;
}

function ProductOfferSection({
  product,
  isSignedIn,
  onOpenGallery,
}: {
  product: PublicSpotlightProduct;
  isSignedIn: boolean;
  onOpenGallery: (offer: SpotlightOfferSlide) => void;
}) {
  const [offer] = buildOffersForProduct(product, isSignedIn);
  if (!offer) return null;
  const extraGalleryCount = Math.max(0, (offer.galleryImages ?? []).length - 1);

  return (
    <li>
      <SpotlightVariantShop
        key={`${product.id}:${offer.variantSkus.map((sku) => sku.id).join("\0")}`}
        layout="catalog"
        title={offer.title}
        retailerName={offer.retailerName}
        fallbackImageUrl={offer.imageUrl}
        fallbackPriceUsdCents={offer.priceUsdCents}
        fallbackStoreUrl={offer.storeUrl}
        fallbackAddHref={offer.addHref}
        fallbackAttributes={offer.attributes}
        skus={offer.variantSkus}
        badge={offer.badge}
        extraGalleryCount={extraGalleryCount}
        onImageDoubleClick={
          (offer.galleryImages ?? []).length > 0
            ? () => onOpenGallery(offer)
            : undefined
        }
      />
    </li>
  );
}

type SpotlightCategoryOffersPanelProps = {
  category: SpotlightCategoryDefinition;
  products: PublicSpotlightProduct[];
  isSignedIn: boolean;
};

const CATALOG_PAGE_SIZE = 6;

export function SpotlightCategoryOffersPanel({
  category,
  products,
  isSignedIn,
}: SpotlightCategoryOffersPanelProps) {
  const [viewer, setViewer] = useState<ImageViewerState | null>(null);
  const [selectedRetailer, setSelectedRetailer] = useState(SPOTLIGHT_RETAILER_ALL);
  const [page, setPage] = useState(1);
  const visibleProducts = useMemo(
    () => filterProductsByRetailer(products, selectedRetailer),
    [products, selectedRetailer],
  );
  const signupReturn =
    visibleProducts[0] ?? products[0] ?
      aiAssistedRequestUrlWithSpotlightProduct(
        visibleProducts[0] ?? products[0]!,
      )
    : "/dashboard/items/requested-items/ai-assisted-request";

  useEffect(() => {
    setSelectedRetailer(SPOTLIGHT_RETAILER_ALL);
  }, [category.slug]);

  useEffect(() => {
    setPage(1);
  }, [category.slug, selectedRetailer]);

  useEffect(() => {
    if (selectedRetailer === SPOTLIGHT_RETAILER_ALL) return;
    if (!uniqueSpotlightRetailers(products).includes(selectedRetailer)) {
      setSelectedRetailer(SPOTLIGHT_RETAILER_ALL);
    }
  }, [products, selectedRetailer]);

  const totalPages = Math.max(
    1,
    Math.ceil(visibleProducts.length / CATALOG_PAGE_SIZE),
  );
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const sliceStart = (pageSafe - 1) * CATALOG_PAGE_SIZE;
  const pageSlice = visibleProducts.slice(
    sliceStart,
    sliceStart + CATALOG_PAGE_SIZE,
  );
  const showFrom = visibleProducts.length === 0 ? 0 : sliceStart + 1;
  const showTo = Math.min(
    sliceStart + CATALOG_PAGE_SIZE,
    visibleProducts.length,
  );

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
    <div className="space-y-4">
      <SpotlightCategoryRetailerMenu
        categorySlug={category.slug}
        products={products}
        selectedRetailer={selectedRetailer}
        onSelectRetailer={setSelectedRetailer}
      />
      {visibleProducts.length === 0 ?
        <p className="text-sm text-muted-foreground">
          No curated products from this retailer in {category.title} yet.
        </p>
      : <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {pageSlice.map((product) => (
              <ProductOfferSection
                key={product.id}
                product={product}
                isSignedIn={isSignedIn}
                onOpenGallery={(offer) =>
                  setViewer({
                    title: offer.title,
                    retailerName: offer.retailerName,
                    images: offer.galleryImages ?? [],
                    startIndex: galleryStartIndex(
                      offer.galleryImages ?? [],
                      offer.imageUrl,
                      offer.id,
                    ),
                  })
                }
              />
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs tabular-nums text-muted-foreground">
              Showing {showFrom}–{showTo} of {visibleProducts.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pageSafe <= 1}
                onClick={() => setPage(Math.max(1, pageSafe - 1))}
                aria-label="Previous products"
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                Page {pageSafe} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pageSafe >= totalPages}
                onClick={() => setPage(Math.min(totalPages, pageSafe + 1))}
                aria-label="Next products"
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
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

      <SpotlightImageViewer viewer={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
