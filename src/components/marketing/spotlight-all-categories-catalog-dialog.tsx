"use client";

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
import {
  SPOTLIGHT_CATEGORIES,
  type SpotlightCategoryDefinition,
  type SpotlightCategorySlug,
} from "@/lib/spotlight-categories";
import { cn } from "@/lib/utils";

type SpotlightAllCategoriesCatalogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productsByCategory: Partial<
    Record<SpotlightCategorySlug, PublicSpotlightProduct[]>
  >;
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
  const Icon = category.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
        selected
          ? "border-primary/40 bg-primary/10 shadow-sm"
          : "border-transparent bg-transparent hover:border-border hover:bg-muted/50",
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br",
          category.gradient,
        )}
      >
        <Icon className="size-4 text-foreground/70" aria-hidden />
      </div>
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
  productsByCategory,
  isSignedIn,
}: SpotlightAllCategoriesCatalogDialogProps) {
  const [activeSlug, setActiveSlug] = useState<SpotlightCategorySlug>(
    SPOTLIGHT_CATEGORIES[0].slug,
  );

  useEffect(() => {
    if (!open) return;
    setActiveSlug(SPOTLIGHT_CATEGORIES[0].slug);
  }, [open]);

  const activeCategory = useMemo(
    () => SPOTLIGHT_CATEGORIES.find((c) => c.slug === activeSlug)!,
    [activeSlug],
  );

  const activeProducts = productsByCategory[activeSlug] ?? [];

  const countsBySlug = useMemo(() => {
    const map = new Map<SpotlightCategorySlug, { products: number; offers: number }>();
    for (const cat of SPOTLIGHT_CATEGORIES) {
      const products = productsByCategory[cat.slug] ?? [];
      map.set(cat.slug, {
        products: products.length,
        offers: countCategoryOffers(products, isSignedIn),
      });
    }
    return map;
  }, [productsByCategory, isSignedIn]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "fixed top-[50%] left-[50%] flex h-[min(96dvh,960px)] w-[min(98vw,1280px)] max-w-none translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden rounded-xl p-0",
          "sm:max-w-none",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 sm:px-6">
          <DialogTitle className="text-xl sm:text-2xl">Spotlight catalog</DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Choose a category, then swipe through every curated offer—view on the
            store or start a request.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="shrink-0 border-b border-border bg-muted/20 lg:w-72 lg:border-b-0 lg:border-r">
            <p className="hidden px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:block">
              Categories
            </p>
            <nav
              aria-label="Spotlight categories"
              className="flex gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-y-auto lg:px-3 lg:pb-4 lg:pt-2"
            >
              {SPOTLIGHT_CATEGORIES.map((category) => {
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
            <div
              className={cn(
                "shrink-0 border-b border-border/60 bg-gradient-to-br px-5 py-4 sm:px-6",
                activeCategory.gradient,
              )}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {activeCategory.tag}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-foreground sm:text-xl">
                {activeCategory.title}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {activeCategory.description}
              </p>
              <p className="mt-2 text-xs font-medium text-foreground/80">
                {activeCategory.priceHint}
                {activeProducts.length > 0
                  ? ` · ${countsBySlug.get(activeSlug)?.offers ?? 0} offers available`
                  : ""}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <SpotlightCategoryOffersPanel
                category={activeCategory}
                products={activeProducts}
                isSignedIn={isSignedIn}
              />
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
