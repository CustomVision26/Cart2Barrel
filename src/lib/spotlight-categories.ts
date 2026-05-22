import {
  Headphones,
  Heart,
  Home,
  Package,
  Shirt,
  type LucideIcon,
} from "lucide-react";

export const spotlightCategorySlugSchema = [
  "electronics-tech",
  "fashion-footwear",
  "home-kitchen",
  "beauty-wellness",
  "barrel-ready-bundles",
] as const;

export type SpotlightCategorySlug = (typeof spotlightCategorySlugSchema)[number];

export type SpotlightCategoryDefinition = {
  slug: SpotlightCategorySlug;
  title: string;
  description: string;
  tag: string;
  priceHint: string;
  gradient: string;
  icon: LucideIcon;
};

export const SPOTLIGHT_CATEGORIES: readonly SpotlightCategoryDefinition[] = [
  {
    slug: "electronics-tech",
    title: "Electronics & tech",
    description:
      "Laptops, audio, and smart home—request a quote, we handle the buy.",
    tag: "Popular",
    priceHint: "Estimates from $89",
    gradient:
      "from-sky-500/25 via-violet-500/15 to-background dark:from-sky-400/20 dark:via-violet-500/10",
    icon: Headphones,
  },
  {
    slug: "fashion-footwear",
    title: "Fashion & footwear",
    description:
      "Seasonal drops and everyday staples consolidated for barrel shipping.",
    tag: "New season",
    priceHint: "Bundle & save",
    gradient:
      "from-rose-500/25 via-amber-500/10 to-background dark:from-rose-400/15 dark:via-amber-500/10",
    icon: Shirt,
  },
  {
    slug: "home-kitchen",
    title: "Home & kitchen",
    description:
      "Small appliances, cookware, and décor shipped to our hub for packing.",
    tag: "Editor's pick",
    priceHint: "Deals weekly",
    gradient: "from-emerald-500/20 via-teal-500/10 to-background dark:from-emerald-400/15",
    icon: Home,
  },
  {
    slug: "beauty-wellness",
    title: "Beauty & wellness",
    description:
      "Top brands with vetted listings—checkout when your cart is ready.",
    tag: "Self-care",
    priceHint: "From $12 items",
    gradient:
      "from-fuchsia-500/20 via-pink-500/10 to-background dark:from-fuchsia-400/15",
    icon: Heart,
  },
  {
    slug: "barrel-ready-bundles",
    title: "Barrel-ready bundles",
    description:
      "Mix categories in one shipment; we consolidate and label for Jamaica.",
    tag: "Best value",
    priceHint: "One hub, one address",
    gradient:
      "from-orange-500/25 via-amber-500/15 to-background dark:from-orange-400/15",
    icon: Package,
  },
] as const;

const slugSet = new Set<string>(spotlightCategorySlugSchema);

export function isSpotlightCategorySlug(value: string): value is SpotlightCategorySlug {
  return slugSet.has(value);
}

export function spotlightCategoryBySlug(
  slug: SpotlightCategorySlug,
): SpotlightCategoryDefinition {
  const found = SPOTLIGHT_CATEGORIES.find((c) => c.slug === slug);
  if (!found) {
    throw new Error(`Unknown spotlight category slug: ${slug}`);
  }
  return found;
}
