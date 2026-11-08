"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import {
  countCategoryOffers,
  SpotlightCategoryOffersPanel,
} from "@/components/marketing/spotlight-category-offers-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PublicSpotlightProduct } from "@/data/spotlight-category-products";
import { MARKETING_CATEGORY_ART } from "@/lib/marketing-category-art";
import {
  SPOTLIGHT_RETAILER_PRICE_NOTICE,
  spotlightCategoryIcon,
  type SpotlightCategoryDefinition,
  type SpotlightCategorySlug,
} from "@/lib/spotlight-categories";
import { cn } from "@/lib/utils";

type SpotlightAllCategoriesCatalogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: SpotlightCategoryDefinition[];
  productsByCategory: Partial<
    Record<SpotlightCategorySlug, PublicSpotlightProduct[]>
  >;
  publishedSlugs: SpotlightCategorySlug[];
  isSignedIn: boolean;
};

function CategoryMenuButton({
  category,
  productCount,
  offerCount,
  selected,
  onSelect,
}: {
  category: SpotlightCategoryDefinition;
  productCount: number;
  offerCount: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = spotlightCategoryIcon(category.iconName);
  const art = MARKETING_CATEGORY_ART[category.slug];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-secondary shadow-sm"
          : "border-transparent bg-card hover:border-border hover:bg-accent",
      )}
    >
      {art ? (
        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          <Image
            src={art.src}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
          />
        </span>
      ) : (
      <div
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
          category.gradient,
        )}
      >
        <Icon className="size-5 text-foreground/70" aria-hidden />
      </div>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          {category.title}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {productCount > 0
            ? `${offerCount} offer${offerCount === 1 ? "" : "s"}`
            : "Coming soon"}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
          selected
            ? "bg-primary/20 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        {category.tag}
      </span>
    </button>
  );
}

export function SpotlightAllCategoriesCatalogDialog({
  open,
  onOpenChange,
  categories,
  productsByCategory,
  publishedSlugs,
  isSignedIn,
}: SpotlightAllCategoriesCatalogDialogProps) {
  const visibleCategories = useMemo(
    () =>
      categories.filter((category) => publishedSlugs.includes(category.slug)),
    [categories, publishedSlugs],
  );
  const [activeSlug, setActiveSlug] = useState<SpotlightCategorySlug>(
    categories[0]?.slug ?? "",
  );

  useEffect(() => {
    if (!open) return;
    setActiveSlug(visibleCategories[0]?.slug ?? categories[0]?.slug ?? "");
  }, [open, visibleCategories, categories]);

  const activeCategory = useMemo(
    () =>
      visibleCategories.find((c) => c.slug === activeSlug) ??
      visibleCategories[0] ??
      null,
    [activeSlug, visibleCategories],
  );

  const activeProducts = activeCategory
    ? (productsByCategory[activeCategory.slug] ?? [])
    : [];

  const countsBySlug = useMemo(() => {
    const map = new Map<SpotlightCategorySlug, { products: number; offers: number }>();
    for (const cat of visibleCategories) {
      const products = productsByCategory[cat.slug] ?? [];
      map.set(cat.slug, {
        products: products.length,
        offers: countCategoryOffers(products),
      });
    }
    return map;
  }, [productsByCategory, visibleCategories]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "amani-storefront fixed top-[50%] left-[50%] flex h-[min(96dvh,960px)] w-[min(98vw,1280px)] max-w-none translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 text-foreground shadow-xl",
          "sm:max-w-none",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border bg-card px-5 py-4 sm:px-6">
          <DialogTitle className="font-heading text-xl text-foreground sm:text-2xl">
            Spotlight catalog
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            <span className="block">
              Choose a category, then pick color and size for each product—view on
              the store or start a request.
            </span>
            <span className="mt-1.5 block text-xs leading-relaxed sm:text-sm">
              {SPOTLIGHT_RETAILER_PRICE_NOTICE}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="shrink-0 border-b border-border bg-muted/60 lg:w-80 lg:border-b-0 lg:border-r">
            <p className="hidden px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:block">
              Categories
            </p>
            <nav
              aria-label="Spotlight categories"
              className="flex gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-y-auto lg:px-3 lg:pb-4 lg:pt-2"
            >
              {visibleCategories.map((category) => {
                const counts = countsBySlug.get(category.slug)!;
                return (
                  <CategoryMenuButton
                    key={category.slug}
                    category={category}
                    productCount={counts.products}
                    offerCount={counts.offers}
                    selected={activeSlug === category.slug}
                    onSelect={() => setActiveSlug(category.slug)}
                  />
                );
              })}
            </nav>
          </aside>

          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            {activeCategory ?
            <>
            {(() => {
              const art = MARKETING_CATEGORY_ART[activeCategory.slug];
              return (
            <div className="relative shrink-0 overflow-hidden border-b border-border">
              {art ? (
                <div className="relative h-36 bg-muted sm:h-44">
                  <Image
                    src={art.src}
                    alt={art.alt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 70vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 px-5 py-4 sm:px-6">
                    <p className="text-xs font-medium uppercase tracking-wide text-white/80">
                      {activeCategory.tag}
                    </p>
                    <h2 className="mt-1 font-heading text-lg font-semibold text-white sm:text-xl">
                      {activeCategory.title}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm text-white/90">
                      {activeCategory.description}
                    </p>
                    <p className="mt-2 text-xs font-medium text-white/80">
                      {activeCategory.priceHint}
                      {activeProducts.length > 0
                        ? ` · ${countsBySlug.get(activeCategory.slug)?.offers ?? 0} offers available`
                        : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "shrink-0 bg-gradient-to-br px-5 py-4 sm:px-6",
                    activeCategory.gradient,
                  )}
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {activeCategory.tag}
                  </p>
                  <h2 className="mt-1 font-heading text-lg font-semibold text-foreground sm:text-xl">
                    {activeCategory.title}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {activeCategory.description}
                  </p>
                  <p className="mt-2 text-xs font-medium text-foreground/80">
                    {activeCategory.priceHint}
                    {activeProducts.length > 0
                      ? ` · ${countsBySlug.get(activeCategory.slug)?.offers ?? 0} offers available`
                      : ""}
                  </p>
                </div>
              )}
            </div>
              );
            })()}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <SpotlightCategoryOffersPanel
                category={activeCategory}
                products={activeProducts}
                isSignedIn={isSignedIn}
              />
            </div>
            </>
            : <p className="p-6 text-sm text-muted-foreground">No published categories.</p>}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
