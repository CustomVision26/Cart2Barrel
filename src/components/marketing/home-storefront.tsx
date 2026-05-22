"use client";

import Link from "next/link";
import { Package, Sparkles, Truck } from "lucide-react";

import { HomeSpotlightCarousel } from "@/components/marketing/home-spotlight-carousel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { PublicSpotlightProduct } from "@/data/spotlight-category-products";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
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
  const primaryHref = isSignedIn ? "/dashboard" : "/signup";
  const primaryLabel = isSignedIn ? "Open dashboard" : "Start shopping";
  const secondaryHref = isSignedIn
    ? DASHBOARD_ADD_ITEM_ROUTES.productsActive
    : "/how-it-works";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-10 md:py-14">
      <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-amber-500" aria-hidden />
            Shop US stores · Delivered to Jamaica
          </div>
          <div className="space-y-3">
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
              Your cart,{" "}
              <span className="text-primary">curated for the barrel</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Browse-style storefront experience: request items, approve quotes, and
              pay at checkout—we purchase and consolidate for delivery to your island
              address.
            </p>
          </div>
          <div className="flex max-w-md flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Input
                readOnly
                aria-label="Search preview (coming soon)"
                placeholder="Search brands & categories…"
                className="h-10 bg-background pr-3 shadow-sm"
              />
            </div>
            <Button
              className="h-10 shrink-0 sm:px-5"
              nativeButton={false}
              render={<Link href={secondaryHref} />}
            >
              Explore
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button nativeButton={false} render={<Link href={primaryHref} />}>
              {primaryLabel}
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/how-it-works" />}
            >
              How it works
            </Button>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Truck className="size-4 text-foreground/80" aria-hidden />
              Hub consolidation
            </span>
            <span className="inline-flex items-center gap-2">
              <Package className="size-4 text-foreground/80" aria-hidden />
              Barrel-ready packing
            </span>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm ring-1 ring-foreground/5">
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 size-36 rounded-full bg-violet-500/10 blur-2xl" />
          <div className="relative space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Today on Cart2Barrel
            </p>
            <p className="font-heading text-2xl font-semibold text-foreground">
              Deals rotate as we onboard catalogs
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Featured tiles below mirror a typical e-commerce carousel—swipe or use
              arrows to preview categories we support through quotes and cart.
            </p>
            <Separator className="my-2" />
            <ul className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
              <li className="rounded-lg bg-muted/50 px-3 py-2 ring-1 ring-border/60">
                Secure checkout with agreed estimates
              </li>
              <li className="rounded-lg bg-muted/50 px-3 py-2 ring-1 ring-border/60">
                Jamaican shipping label saved in your profile
              </li>
            </ul>
          </div>
        </div>
      </section>

      <HomeSpotlightCarousel
        isSignedIn={isSignedIn}
        productsByCategory={productsByCategory}
      />
    </main>
  );
}
