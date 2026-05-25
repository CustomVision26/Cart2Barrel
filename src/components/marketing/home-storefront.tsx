"use client";

import { Sparkles } from "lucide-react";

import { HomeSpotlightCarousel } from "@/components/marketing/home-spotlight-carousel";
import type { PublicSpotlightProduct } from "@/data/spotlight-category-products";
import type { SpotlightCategorySlug } from "@/lib/spotlight-categories";

type HomeStorefrontProps = {
  isSignedIn: boolean;
  productsByCategory: Partial<
    Record<SpotlightCategorySlug, PublicSpotlightProduct[]>
  >;
};

export function HomeStorefront({
  isSignedIn,
  productsByCategory,
}: HomeStorefrontProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-10 md:py-14">
      <section className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-amber-500" aria-hidden />
          Shop & Ship From US stores · Delivered to Caribbean and The World
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/40 shadow-sm ring-1 ring-foreground/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/homepage-img-cart2barrel.png"
            alt="Cart2Barrel — shop US stores and ship consolidated orders to the Caribbean and the world"
            className="block h-auto w-full"
            loading="eager"
            fetchPriority="high"
          />
        </div>
      </section>

      <HomeSpotlightCarousel
        isSignedIn={isSignedIn}
        productsByCategory={productsByCategory}
      />
    </main>
  );
}
