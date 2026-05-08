"use client";

import Link from "next/link";
import {
  Headphones,
  Heart,
  Home,
  Package,
  Shirt,
  Sparkles,
  Truck,
} from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type PromoSlide = {
  title: string;
  description: string;
  tag: string;
  priceHint: string;
  gradient: string;
  icon: typeof Package;
};

const PROMO_SLIDES: PromoSlide[] = [
  {
    title: "Electronics & tech",
    description: "Laptops, audio, and smart home—request a quote, we handle the buy.",
    tag: "Popular",
    priceHint: "Estimates from $89",
    gradient:
      "from-sky-500/25 via-violet-500/15 to-background dark:from-sky-400/20 dark:via-violet-500/10",
    icon: Headphones,
  },
  {
    title: "Fashion & footwear",
    description: "Seasonal drops and everyday staples consolidated for barrel shipping.",
    tag: "New season",
    priceHint: "Bundle & save",
    gradient:
      "from-rose-500/25 via-amber-500/10 to-background dark:from-rose-400/15 dark:via-amber-500/10",
    icon: Shirt,
  },
  {
    title: "Home & kitchen",
    description: "Small appliances, cookware, and décor shipped to our hub for packing.",
    tag: "Editor's pick",
    priceHint: "Deals weekly",
    gradient:
      "from-emerald-500/20 via-teal-500/10 to-background dark:from-emerald-400/15",
    icon: Home,
  },
  {
    title: "Beauty & wellness",
    description: "Top brands with vetted listings—checkout when your cart is ready.",
    tag: "Self-care",
    priceHint: "From $12 items",
    gradient:
      "from-fuchsia-500/20 via-pink-500/10 to-background dark:from-fuchsia-400/15",
    icon: Heart,
  },
  {
    title: "Barrel-ready bundles",
    description: "Mix categories in one shipment; we consolidate and label for Jamaica.",
    tag: "Best value",
    priceHint: "One hub, one address",
    gradient:
      "from-orange-500/25 via-amber-500/15 to-background dark:from-orange-400/15",
    icon: Package,
  },
];

type HomeStorefrontProps = {
  isSignedIn: boolean;
};

export function HomeStorefront({ isSignedIn }: HomeStorefrontProps) {
  const primaryHref = isSignedIn ? "/dashboard" : "/signup";
  const primaryLabel = isSignedIn ? "Open dashboard" : "Start shopping";
  const secondaryHref = isSignedIn ? "/dashboard/items/new" : "/how-it-works";

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

      <section className="space-y-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              Featured &amp; spotlight
            </h2>
            <p className="text-sm text-muted-foreground">
              Horizontal carousel—promotional blocks for categories and campaigns.
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

        <Carousel
          opts={{ align: "start", loop: true }}
          className="w-full"
        >
          <div className="relative">
            <CarouselContent className="-ml-3 md:-ml-4">
              {PROMO_SLIDES.map((slide) => {
                const Icon = slide.icon;
                return (
                  <CarouselItem
                    key={slide.title}
                    className="basis-[88%] pl-3 sm:basis-[70%] md:basis-[48%] md:pl-4 lg:basis-[34%]"
                  >
                    <Card className="h-full overflow-hidden border-border/80 shadow-sm transition-shadow hover:shadow-md">
                      <div
                        className={cn(
                          "relative flex h-36 items-end justify-between bg-gradient-to-br p-4 md:h-40",
                          slide.gradient
                        )}
                      >
                        <div className="rounded-md bg-background/80 px-2 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
                          {slide.tag}
                        </div>
                        <Icon
                          className="size-14 text-foreground/25 md:size-16"
                          aria-hidden
                        />
                      </div>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{slide.title}</CardTitle>
                        <CardDescription>{slide.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm font-medium text-foreground">
                          {slide.priceHint}
                        </p>
                      </CardContent>
                      <CardFooter className="border-t border-border/60 bg-muted/30">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          nativeButton={false}
                          render={<Link href={isSignedIn ? "/dashboard/items/new" : "/signup"} />}
                        >
                          {isSignedIn ? "Request an item" : "Get started"}
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
      </section>
    </main>
  );
}
