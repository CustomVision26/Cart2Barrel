"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import {
  SpotlightCategoryCarouselNext,
  SpotlightCategoryCarouselPrevious,
} from "@/components/marketing/spotlight-carousel-nav";
import { SpotlightAllCategoriesCatalogDialog } from "@/components/marketing/spotlight-all-categories-catalog-dialog";
import { SpotlightCategoryProductsDialog } from "@/components/marketing/spotlight-category-products-dialog";
import { SpotlightProductOffersCarousel } from "@/components/marketing/spotlight-product-offers-carousel";
import { buildOffersForProduct } from "@/components/marketing/spotlight-category-offers-panel";
import type { PublicSpotlightProduct } from "@/data/spotlight-category-products";
import {
  SPOTLIGHT_CATEGORIES,
  type SpotlightCategoryDefinition,
  type SpotlightCategorySlug,
} from "@/lib/spotlight-categories";
import { cn } from "@/lib/utils";

type HomeSpotlightCarouselProps = {
  isSignedIn: boolean;
  productsByCategory: Partial<
    Record<SpotlightCategorySlug, PublicSpotlightProduct[]>
  >;
};

function categorySlideOffers(
  products: PublicSpotlightProduct[],
  isSignedIn: boolean,
) {
  return products.flatMap((product) => {
    const offers = buildOffersForProduct(product, isSignedIn);
    return offers.length > 0 ? [offers[0]] : [];
  });
}

export function HomeSpotlightCarousel({
  isSignedIn,
  productsByCategory,
}: HomeSpotlightCarouselProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [activeCategory, setActiveCategory] =
    useState<SpotlightCategoryDefinition | null>(null);

  const openCategory = useCallback((category: SpotlightCategoryDefinition) => {
    setActiveCategory(category);
    setDialogOpen(true);
  }, []);

  const activeProducts =
    activeCategory ? (productsByCategory[activeCategory.slug] ?? []) : [];

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Featured &amp; spotlight
          </h2>
          <p className="text-sm text-muted-foreground">
            Swipe categories, then browse products in each slide—or open the full
            catalog.
          </p>
        </div>
        <Button
          variant="ghost"
          size="default"
          className="text-base text-muted-foreground hover:text-foreground"
          onClick={() => setCatalogOpen(true)}
        >
          View all categories
        </Button>
      </div>

      <Carousel opts={{ align: "start", loop: true }} className="w-full">
        <div className="relative px-2 sm:px-4">
          <CarouselContent className="-ml-3 md:-ml-4">
            {SPOTLIGHT_CATEGORIES.map((slide) => {
              const Icon = slide.icon;
              const products = productsByCategory[slide.slug] ?? [];
              const slideOffers = categorySlideOffers(products, isSignedIn);

              return (
                <CarouselItem
                  key={slide.slug}
                  className="basis-[92%] pl-3 sm:basis-[78%] md:basis-[62%] md:pl-4 lg:basis-[48%] xl:basis-[40%]"
                >
                  <Card className="flex h-full flex-col overflow-hidden border-border/80 shadow-sm">
                    <div
                      className={cn(
                        "relative flex shrink-0 items-start justify-between bg-gradient-to-br p-4",
                        slide.gradient,
                      )}
                    >
                      <div className="space-y-1">
                        <div className="rounded-md bg-card px-2 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
                          {slide.tag}
                        </div>
                        <CardTitle className="text-lg text-foreground">
                          {slide.title}
                        </CardTitle>
                      </div>
                      <Icon
                        className="size-12 shrink-0 text-foreground/20 sm:size-14"
                        aria-hidden
                      />
                    </div>

                    <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-4">
                      <CardDescription className="line-clamp-2">
                        {slide.description}
                      </CardDescription>
                      {slideOffers.length > 0 ?
                        <SpotlightProductOffersCarousel
                          offers={slideOffers}
                          loop={slideOffers.length > 1}
                          showControls={slideOffers.length > 1}
                        />
                      : <p className="rounded-lg border border-dashed border-border bg-muted px-3 py-6 text-center text-xs text-muted-foreground">
                          Curated products coming soon for this category.
                        </p>
                      }
                    </CardContent>

                    <CardFooter className="shrink-0 border-t border-border/60 bg-muted px-4 py-4">
                      <Button
                        variant="secondary"
                        size="lg"
                        className="h-11 w-full text-base"
                        onClick={() => openCategory(slide)}
                      >
                        View all in {slide.title}
                      </Button>
                    </CardFooter>
                  </Card>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <SpotlightCategoryCarouselPrevious />
          <SpotlightCategoryCarouselNext />
        </div>
      </Carousel>

      <SpotlightCategoryProductsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={activeCategory}
        products={activeProducts}
        isSignedIn={isSignedIn}
      />

      <SpotlightAllCategoriesCatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        productsByCategory={productsByCategory}
        isSignedIn={isSignedIn}
      />
    </section>
  );
}
