"use client";

import { useState } from "react";
import { FileTextIcon, Package, SparklesIcon } from "lucide-react";

import { HomeHubStockAddToCartDialog } from "@/components/marketing/home-hub-stock-add-to-cart-dialog";
import {
  HubStockFeatureList,
  HubStockMetaChips,
  HubStockProductHeroCarousel,
} from "@/components/marketing/hub-stock-product-presentation";
import {
  SpotlightProductCarouselNext,
  SpotlightProductCarouselPrevious,
} from "@/components/marketing/spotlight-carousel-nav";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SerializableShippingAddress } from "@/data/addresses";
import type { PublicHubStockProduct } from "@/data/hub-stock-products";
import { formatUsd } from "@/lib/admin-markup";
import { hubStockQtyIsLow } from "@/lib/hub-stock";
import { cn } from "@/lib/utils";

const SLIDE_BASIS =
  "basis-[72%] pl-3 sm:basis-[46%] md:basis-[34%] lg:basis-[26%] xl:basis-[22%]";

function HubStockQtyLabel({ qty }: { qty: number }) {
  const low = hubStockQtyIsLow(qty);
  return (
    <p className="text-[11px] leading-none">
      <span
        className={cn(
          "tabular-nums",
          low ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground",
        )}
      >
        {qty}
      </span>{" "}
      <span
        className={cn(
          low ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground",
        )}
      >
        in stock
      </span>
    </p>
  );
}

function HubStockSizeColorLine({
  sizeLabel,
  colorLabel,
  className,
}: {
  sizeLabel: string;
  colorLabel: string;
  className?: string;
}) {
  return (
    <p className={cn("truncate text-[11px] text-muted-foreground", className)}>
      Size {sizeLabel} · Color {colorLabel}
    </p>
  );
}

function HubStockImageGalleryDialog({
  product,
  open,
  onOpenChange,
}: {
  product: PublicHubStockProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const images = (product?.imageUrls ?? []).map((url) => url.trim()).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-lg duration-300 data-open:zoom-in-95">
        <HubStockProductHeroCarousel
          productName={product?.name ?? "Product"}
          imageUrls={images}
          className="-mx-4 -mt-4"
        />

        <DialogHeader className="gap-1.5 pr-6">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <SparklesIcon className="size-3 text-primary" aria-hidden />
            Product photos
          </div>
          <DialogTitle className="font-heading text-lg leading-snug">
            {product?.name ?? "Product photos"}
          </DialogTitle>
          <DialogDescription>
            {images.length > 1 ?
              `${images.length} photos — swipe or use the arrows.`
            : "Product photo."}
          </DialogDescription>
          {product ?
            <HubStockMetaChips
              sizeLabel={product.sizeLabel}
              colorLabel={product.colorLabel}
            />
          : null}
        </DialogHeader>

        {product?.description.trim() ?
          <HubStockFeatureList description={product.description} />
        : null}
      </DialogContent>
    </Dialog>
  );
}

function HubStockDescriptionDialog({
  product,
  open,
  onOpenChange,
}: {
  product: PublicHubStockProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const description = product?.description.trim() ?? "";
  const cover = product?.imageUrls[0]?.trim() ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-lg duration-300 data-open:zoom-in-95">
        <div className="flex items-start gap-3 pr-6">
          <div className="relative size-[4.5rem] shrink-0 overflow-hidden rounded-xl ring-1 ring-foreground/10">
            {cover ?
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={cover}
                alt=""
                className="size-full object-cover motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-105 motion-safe:duration-700"
              />
            : (
              <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
                <Package className="size-6" aria-hidden />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
          </div>
          <DialogHeader className="min-w-0 flex-1 gap-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <SparklesIcon className="size-3 text-primary" aria-hidden />
              Product description
            </div>
            <DialogTitle className="font-heading text-lg leading-snug">
              {product?.name ?? "Description"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Details for {product?.name ?? "this product"}.
            </DialogDescription>
            {product ?
              <HubStockMetaChips
                sizeLabel={product.sizeLabel}
                colorLabel={product.colorLabel}
              />
            : null}
          </DialogHeader>
        </div>

        {description ?
          <HubStockFeatureList description={description} className="max-h-[50vh]" />
        : (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/80 px-3 py-6 text-sm text-muted-foreground">
            <FileTextIcon className="size-4 shrink-0" aria-hidden />
            No description available.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HomeHubStockProductCard({
  product,
  onAddToCart,
  onOpenGallery,
  onOpenDescription,
}: {
  product: PublicHubStockProduct;
  onAddToCart: () => void;
  onOpenGallery: () => void;
  onOpenDescription: () => void;
}) {
  const cover = product.imageUrls[0]?.trim() ?? "";
  const extraCount = Math.max(0, product.imageUrls.filter((url) => url.trim()).length - 1);
  const hasDescription = product.description.trim().length > 0;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
      {cover ?
        <button
          type="button"
          className="relative aspect-square max-h-36 w-full shrink-0 cursor-zoom-in bg-muted p-0 text-left ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Double-click to view photos"
          aria-label={`View photos for ${product.name}`}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpenGallery();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt=""
            className="size-full object-cover"
            draggable={false}
          />
          {extraCount > 0 ?
            <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-background/90 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-foreground shadow-sm backdrop-blur">
              +{extraCount}
            </span>
          : null}
        </button>
      : (
        <div className="relative flex aspect-square max-h-36 w-full shrink-0 items-center justify-center bg-muted text-muted-foreground">
          <Package className="size-6" aria-hidden />
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <div className="min-h-[2.6rem] space-y-0.5">
          <h3 className="line-clamp-2 font-heading text-sm font-medium leading-snug text-foreground">
            {product.name}
          </h3>
          <HubStockSizeColorLine
            sizeLabel={product.sizeLabel}
            colorLabel={product.colorLabel}
          />
          {hasDescription ?
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0 py-0 text-[11px]"
              onClick={onOpenDescription}
            >
              Description
            </Button>
          : null}
        </div>
        <div className="mt-auto space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {formatUsd(product.priceUsdCents)}
            </p>
            <HubStockQtyLabel qty={product.stockQty} />
          </div>
          <Button size="sm" className="h-7 w-full text-[11px]" onClick={onAddToCart}>
            Add to cart
          </Button>
        </div>
      </div>
    </article>
  );
}

export function HomeHubStockProductGrid({
  products,
  isSignedIn,
  savedAddresses,
}: {
  products: PublicHubStockProduct[];
  isSignedIn: boolean;
  savedAddresses: SerializableShippingAddress[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [galleryId, setGalleryId] = useState<string | null>(null);
  const [descriptionId, setDescriptionId] = useState<string | null>(null);
  const active = products.find((p) => p.id === activeId) ?? null;
  const galleryProduct = products.find((p) => p.id === galleryId) ?? null;
  const descriptionProduct = products.find((p) => p.id === descriptionId) ?? null;

  if (products.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          In-hub products
        </h2>
        <p className="text-sm text-muted-foreground">
          Already at the warehouse — add to cart and check out. No estimate request needed.
        </p>
      </div>
      <Carousel
        opts={{ align: "start", loop: products.length > 2, dragFree: true }}
        className="w-full"
      >
        <div className="relative px-1 sm:px-2">
          <CarouselContent className="-ml-3">
            {products.map((product) => (
              <CarouselItem key={product.id} className={SLIDE_BASIS}>
                <HomeHubStockProductCard
                  product={product}
                  onAddToCart={() => setActiveId(product.id)}
                  onOpenGallery={() => setGalleryId(product.id)}
                  onOpenDescription={() => setDescriptionId(product.id)}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          {products.length > 1 ?
            <>
              <SpotlightProductCarouselPrevious />
              <SpotlightProductCarouselNext />
            </>
          : null}
        </div>
      </Carousel>
      {active ?
        <HomeHubStockAddToCartDialog
          product={active}
          isSignedIn={isSignedIn}
          savedAddresses={savedAddresses}
          open={activeId != null}
          onOpenChange={(open) => {
            if (!open) setActiveId(null);
          }}
        />
      : null}
      <HubStockImageGalleryDialog
        product={galleryProduct}
        open={galleryId != null}
        onOpenChange={(open) => {
          if (!open) setGalleryId(null);
        }}
      />
      <HubStockDescriptionDialog
        product={descriptionProduct}
        open={descriptionId != null}
        onOpenChange={(open) => {
          if (!open) setDescriptionId(null);
        }}
      />
    </section>
  );
}
