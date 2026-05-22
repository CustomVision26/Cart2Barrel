"use client";

import Link from "next/link";
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
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { SpotlightCategoryProductsDialog } from "@/components/marketing/spotlight-category-products-dialog";
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
  secondaryHref: string;
};

const PREVIEW_THUMB_MAX = 5;

export function HomeSpotlightCarousel({
  isSignedIn,
  productsByCategory,
  secondaryHref,
}: HomeSpotlightCarouselProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
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
            Horizontal carousel—double-click a category to browse curated product
            links.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          nativeButton={false}
          render={<Link href={secondaryHref} />}
        >
          View all categories
        </Button>
      </div>

      <Carousel opts={{ align: "start", loop: true }} className="w-full">
        <div className="relative">
          <CarouselContent className="-ml-3 md:-ml-4">
            {SPOTLIGHT_CATEGORIES.map((slide) => {
              const Icon = slide.icon;
              const products = productsByCategory[slide.slug] ?? [];
              const previews = products
                .filter((p) => p.imageUrl)
                .slice(0, PREVIEW_THUMB_MAX);

              return (
                <CarouselItem
                  key={slide.slug}
                  className="basis-[88%] pl-3 sm:basis-[70%] md:basis-[48%] md:pl-4 lg:basis-[34%]"
                >
                  <Card
                    className="h-full cursor-pointer overflow-hidden border-border/80 shadow-sm transition-shadow hover:shadow-md"
                    onDoubleClick={() => openCategory(slide)}
                    title="Double-click to view products in this category"
                  >
                    <div
                      className={cn(
                        "relative flex h-36 flex-col justify-between bg-gradient-to-br p-4 md:h-40",
                        slide.gradient,
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="rounded-md bg-background/80 px-2 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
                          {slide.tag}
                        </div>
                        <Icon
                          className="size-14 text-foreground/25 md:size-16"
                          aria-hidden
                        />
                      </div>
                      {previews.length > 0 ?
                        <div className="flex items-center gap-1.5">
                          {previews.map((product) => (
                            <div
                              key={product.id}
                              className="size-9 overflow-hidden rounded-md border border-background/60 bg-background/90 shadow-sm ring-1 ring-border/40"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={product.imageUrl!}
                                alt=""
                                className="size-full object-cover"
                              />
                            </div>
                          ))}
                          {products.length > previews.length ?
                            <span className="rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-foreground shadow-sm backdrop-blur">
                              +{products.length - previews.length}
                            </span>
                          : null}
                        </div>
                      : null}
                    </div>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{slide.title}</CardTitle>
                      <CardDescription>{slide.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm font-medium text-foreground">
                        {slide.priceHint}
                      </p>
                      {products.length > 0 ?
                        <p className="mt-1 text-xs text-muted-foreground">
                          {products.length} curated product
                          {products.length === 1 ? "" : "s"} · double-click to browse
                        </p>
                      : null}
                    </CardContent>
                    <CardFooter className="border-t border-border/60 bg-muted/30">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.preventDefault();
                          openCategory(slide);
                        }}
                      >
                        Browse products
                      </Button>
                    </CardFooter>
                  </Card>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <CarouselPrevious
            variant="outline"
            className="left-0 border-border bg-background/90 shadow-sm backdrop-blur sm:-left-1"
          />
          <CarouselNext
            variant="outline"
            className="right-0 border-border bg-background/90 shadow-sm backdrop-blur sm:-right-1"
          />
        </div>
      </Carousel>

      <SpotlightCategoryProductsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={activeCategory}
        products={activeProducts}
        isSignedIn={isSignedIn}
      />
    </section>
  );
}
