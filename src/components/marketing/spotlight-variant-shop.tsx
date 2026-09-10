"use client";

import Link from "next/link";
import { ExternalLink, ImageIcon, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/admin-markup";
import {
  buildSpotlightVariantAxes,
  colorSwatchPrice,
  findSpotlightVariantSku,
  firstAvailablePackKey,
  firstAvailableSizeKey,
  type SpotlightVariantSku,
} from "@/lib/spotlight-variant-axes";
import { cn } from "@/lib/utils";

const COLOR_PREVIEW_LIMIT = 5;

type SpotlightVariantShopProps = {
  title: string;
  retailerName: string;
  fallbackImageUrl: string | null;
  fallbackPriceUsdCents: number | null;
  fallbackStoreUrl: string;
  fallbackAddHref: string;
  fallbackAttributes: string | null;
  skus: SpotlightVariantSku[];
  badge?: string;
  layout: "card" | "detail" | "dialog" | "catalog";
  extraGalleryCount?: number;
  onImageDoubleClick?: () => void;
  onCardDoubleClick?: () => void;
};

function DiagonalUnavailable({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 bg-[linear-gradient(to_top_right,transparent_calc(50%-1px),oklch(0.7_0_0/0.85)_calc(50%-1px),oklch(0.7_0_0/0.85)_calc(50%+1px),transparent_calc(50%+1px))]",
        className,
      )}
    />
  );
}

export function SpotlightVariantShop({
  title,
  retailerName,
  fallbackImageUrl,
  fallbackPriceUsdCents,
  fallbackStoreUrl,
  fallbackAddHref,
  fallbackAttributes,
  skus,
  badge,
  layout,
  extraGalleryCount = 0,
  onImageDoubleClick,
  onCardDoubleClick,
}: SpotlightVariantShopProps) {
  const axes = useMemo(() => buildSpotlightVariantAxes(skus), [skus]);
  const colorKeys = axes.colors.map((c) => c.key);
  const sizeKeys = axes.sizes.map((s) => s.key);
  const packKeys = axes.packs.map((p) => p.key);

  const [colorKey, setColorKey] = useState<string | null>(colorKeys[0] ?? null);
  const [sizeKey, setSizeKey] = useState<string | null>(() =>
    sizeKeys.length > 0
      ? firstAvailableSizeKey(skus, colorKeys[0] ?? null, sizeKeys)
      : null,
  );
  const [packKey, setPackKey] = useState<string | null>(() =>
    packKeys.length > 0
      ? firstAvailablePackKey(skus, colorKeys[0] ?? null, packKeys)
      : null,
  );
  const [showAllColors, setShowAllColors] = useState(false);

  const selectedSku = findSpotlightVariantSku(
    skus,
    colorKeys.length > 0 ? colorKey : null,
    sizeKeys.length > 0 ? sizeKey : null,
    packKeys.length > 0 ? packKey : null,
  );

  const imageUrl = selectedSku?.imageUrl?.trim() || fallbackImageUrl;
  const priceUsdCents =
    selectedSku?.priceUsdCents != null && selectedSku.priceUsdCents > 0
      ? selectedSku.priceUsdCents
      : fallbackPriceUsdCents;
  const storeUrl = selectedSku?.storeUrl || fallbackStoreUrl;
  const addHref = selectedSku?.addHref || fallbackAddHref;
  const available = selectedSku != null || skus.length === 0;

  const selectedColor = axes.colors.find((c) => c.key === colorKey);
  const selectedSize = axes.sizes.find((s) => s.key === sizeKey);
  const selectedPack = axes.packs.find((p) => p.key === packKey);

  const visibleColors =
    showAllColors || axes.colors.length <= COLOR_PREVIEW_LIMIT
      ? axes.colors
      : axes.colors.slice(0, COLOR_PREVIEW_LIMIT);

  function selectColor(nextColor: string) {
    setColorKey(nextColor);
    if (sizeKeys.length > 0) {
      const keep =
        sizeKey != null &&
        findSpotlightVariantSku(skus, nextColor, sizeKey, null);
      setSizeKey(
        keep ? sizeKey : firstAvailableSizeKey(skus, nextColor, sizeKeys),
      );
    }
    if (packKeys.length > 0) {
      const keep =
        packKey != null &&
        findSpotlightVariantSku(skus, nextColor, null, packKey);
      setPackKey(
        keep ? packKey : firstAvailablePackKey(skus, nextColor, packKeys),
      );
    }
  }

  const isCatalog = layout === "catalog";
  const isDetail = layout === "detail" || layout === "dialog";
  const imageClass = isCatalog
    ? "relative size-24 shrink-0 overflow-hidden rounded-md bg-muted sm:size-28"
    : isDetail
      ? "relative aspect-square w-full overflow-hidden rounded-lg bg-muted sm:aspect-[4/5]"
      : "relative aspect-square w-full max-h-32 shrink-0 overflow-hidden bg-muted sm:max-h-40";

  const image = (
    <>
      {imageUrl ?
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="size-full object-cover"
          draggable={false}
          referrerPolicy="no-referrer"
        />
      : <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImageIcon className={isDetail ? "size-8" : "size-5"} aria-hidden />
        </div>
      }
      {badge ?
        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-background/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground shadow-sm backdrop-blur">
          {badge}
        </span>
      : null}
      {extraGalleryCount > 0 ?
        <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-background/90 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-foreground shadow-sm backdrop-blur">
          +{extraGalleryCount}
        </span>
      : null}
      <span className="pointer-events-none absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded bg-background/90 px-1.5 py-0.5 text-[9px] font-semibold text-foreground shadow-sm backdrop-blur">
        {retailerName}
      </span>
    </>
  );

  const imageBlock =
    imageUrl && onImageDoubleClick && !onCardDoubleClick ?
      <button
        type="button"
        className={cn(
          imageClass,
          "block cursor-zoom-in p-0 text-left ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        title="Double-click to enlarge"
        aria-label={`View photos for ${title}`}
        onDoubleClick={(event) => {
          event.preventDefault();
          onImageDoubleClick();
        }}
      >
        {image}
      </button>
    : <div className={imageClass}>{image}</div>;

  const showPicker =
    layout !== "card" &&
    skus.length > 0 &&
    (axes.colors.length > 0 || axes.sizes.length > 0 || axes.packs.length > 0);

  const picker = showPicker && (
      <div
        className={cn("space-y-2.5", isCatalog && "space-y-1.5")}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {axes.colors.length > 0 ?
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-foreground">
              Color:{" "}
              <span className="font-semibold">
                {selectedColor?.label ?? "Select"}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {visibleColors.map((color) => {
                const inStock = Boolean(
                  findSpotlightVariantSku(
                    skus,
                    color.key,
                    sizeKeys.length > 0 ? sizeKey : null,
                    packKeys.length > 0 ? packKey : null,
                  ),
                );
                const selected = colorKey === color.key;
                const swatchPrice = colorSwatchPrice(
                  skus,
                  color.key,
                  sizeKeys.length > 0 ? sizeKey : null,
                  packKeys.length > 0 ? packKey : null,
                );
                return (
                  <button
                    key={color.key}
                    type="button"
                    onClick={() => selectColor(color.key)}
                    className={cn(
                      "space-y-0.5 text-center",
                      isCatalog ? "w-9" : "w-11",
                    )}
                    aria-pressed={selected}
                    aria-label={`${color.label}${inStock ? "" : " (unavailable)"}`}
                  >
                    <span
                      className={cn(
                        "relative mx-auto flex overflow-hidden rounded-full border bg-muted",
                        isCatalog ? "size-7" : "size-9",
                        selected
                          ? "border-2 border-foreground ring-2 ring-foreground/20"
                          : "border-border",
                        !inStock && "opacity-70",
                      )}
                    >
                      {color.imageUrl ?
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={color.imageUrl}
                          alt=""
                          className="size-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      : <span className="size-full bg-muted" />}
                      {!inStock ? <DiagonalUnavailable className="rounded-full" /> : null}
                    </span>
                    {swatchPrice != null ?
                      <span
                        className={cn(
                          "block text-[9px] tabular-nums leading-none",
                          inStock
                            ? "text-foreground"
                            : "text-muted-foreground line-through",
                        )}
                      >
                        {formatUsd(swatchPrice)}
                      </span>
                    : null}
                  </button>
                );
              })}
            </div>
            {axes.colors.length > COLOR_PREVIEW_LIMIT ?
              <button
                type="button"
                className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => setShowAllColors((open) => !open)}
              >
                {showAllColors
                  ? "Show fewer"
                  : `View all ${axes.colors.length}`}
              </button>
            : null}
          </div>
        : null}

        {axes.sizes.length > 0 ?
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-foreground">
              Size:{" "}
              <span className="font-semibold">
                {selectedSize?.label ?? "Select"}
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {axes.sizes.map((size) => {
                const inStock = Boolean(
                  findSpotlightVariantSku(
                    skus,
                    colorKeys.length > 0 ? colorKey : null,
                    size.key,
                    null,
                  ),
                );
                const selected = sizeKey === size.key;
                return (
                  <button
                    key={size.key}
                    type="button"
                    onClick={() => setSizeKey(size.key)}
                    aria-pressed={selected}
                    aria-label={`${size.label}${inStock ? "" : " (unavailable)"}`}
                    className={cn(
                      "relative rounded-md border px-2 py-1 text-[11px] font-medium",
                      selected
                        ? "border-2 border-foreground bg-background text-foreground"
                        : "border-border bg-background text-foreground",
                      !inStock && "text-muted-foreground",
                    )}
                  >
                    {size.label}
                    {!inStock ? <DiagonalUnavailable className="rounded-md" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        : null}

        {axes.packs.length > 0 ?
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-foreground">
              Pack:{" "}
              <span className="font-semibold">
                {selectedPack?.label ?? "Select"}
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {axes.packs.map((pack) => {
                const inStock = Boolean(
                  findSpotlightVariantSku(
                    skus,
                    colorKeys.length > 0 ? colorKey : null,
                    null,
                    pack.key,
                  ),
                );
                const selected = packKey === pack.key;
                return (
                  <button
                    key={pack.key}
                    type="button"
                    onClick={() => setPackKey(pack.key)}
                    aria-pressed={selected}
                    aria-label={`${pack.label}${inStock ? "" : " (unavailable)"}`}
                    className={cn(
                      "relative rounded-md border px-2 py-1 text-[11px] font-medium",
                      selected
                        ? "border-2 border-foreground bg-background text-foreground"
                        : "border-border bg-background text-foreground",
                      !inStock && "text-muted-foreground",
                    )}
                  >
                    {pack.label}
                    {!inStock ? <DiagonalUnavailable className="rounded-md" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        : null}
      </div>
    );

  const actions = (
    <div
      className={cn("grid grid-cols-2 gap-1.5", isDetail && "max-w-sm gap-2")}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <Button
        variant="outline"
        size="sm"
        className={cn("min-w-0 px-2 text-[11px]", isDetail ? "h-9 text-sm" : "h-7")}
        nativeButton={false}
        render={
          <a href={storeUrl} target="_blank" rel="noopener noreferrer" />
        }
      >
        <ExternalLink className="size-3 shrink-0" aria-hidden />
        <span className="truncate">View</span>
      </Button>
      <Button
        size="sm"
        className={cn("min-w-0 px-2 text-[11px]", isDetail ? "h-9 text-sm" : "h-7")}
        disabled={!available}
        nativeButton={available ? false : true}
        render={available ? <Link href={addHref} /> : undefined}
      >
        <Plus className="size-3 shrink-0" aria-hidden />
        <span className="truncate">Request</span>
      </Button>
    </div>
  );

  const copy = (
    <div className="space-y-1">
      <h3
        className={cn(
          "font-semibold leading-snug text-foreground",
          isDetail
            ? "text-base sm:text-lg"
            : isCatalog
              ? "line-clamp-2 text-sm"
              : "line-clamp-2 text-xs",
        )}
      >
        {title}
      </h3>
      {priceUsdCents != null && priceUsdCents > 0 ?
        <p
          className={cn(
            "font-bold text-primary",
            isDetail ? "text-lg" : isCatalog ? "text-base" : "text-sm",
          )}
        >
          {formatUsd(priceUsdCents)}
        </p>
      : null}
      {!picker && !onCardDoubleClick && fallbackAttributes ?
        <p className="line-clamp-1 text-[10px] text-muted-foreground">
          {fallbackAttributes}
        </p>
      : null}
      {onCardDoubleClick ?
        <p className="text-[10px] text-muted-foreground">
          Double-click to choose color and size
        </p>
      : null}
      {picker && !available ?
        <p className="text-[10px] text-muted-foreground">
          That color and size combination is unavailable.
        </p>
      : null}
    </div>
  );

  if (layout === "catalog") {
    return (
      <article className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex gap-3 p-2.5 sm:p-3">
          {imageBlock}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {copy}
            {picker}
            <div className="mt-auto">{actions}</div>
          </div>
        </div>
      </article>
    );
  }

  if (isDetail) {
    const body = (
      <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:gap-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        {imageBlock}
        <div className="flex min-w-0 flex-col gap-3">
          {copy}
          {picker}
          <div className="mt-auto pt-1">{actions}</div>
        </div>
      </div>
    );

    if (layout === "dialog") {
      return body;
    }

    return (
      <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="p-3 sm:p-5">{body}</div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-xs shadow-sm transition-shadow hover:shadow-md",
        onCardDoubleClick && "cursor-pointer",
      )}
      title={
        onCardDoubleClick ? "Double-click to choose color and size" : undefined
      }
      onDoubleClick={
        onCardDoubleClick
          ? (event) => {
              event.preventDefault();
              onCardDoubleClick();
            }
          : undefined
      }
    >
      {imageBlock}
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        {copy}
        <div className="mt-auto">{actions}</div>
      </div>
    </article>
  );
}
