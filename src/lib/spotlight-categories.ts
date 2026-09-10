import {
  Gift,
  Headphones,
  Heart,
  Home,
  Laptop,
  Package,
  Shirt,
  ShoppingBag,
  Sparkles,
  Watch,
  type LucideIcon,
} from "lucide-react";

export const spotlightCategorySlugValueSchema = [
  "electronics-tech",
  "fashion-footwear",
  "home-kitchen",
  "beauty-wellness",
  "barrel-ready-bundles",
] as const;

/** Slug stored on products and category rows. Custom categories use the same shape. */
export type SpotlightCategorySlug = string;

/** Shown on spotlight browse surfaces before customers request an estimate. */
export const SPOTLIGHT_RETAILER_PRICE_NOTICE =
  "Retailer prices can change. View the official product page, and update the product description if needed, before requesting an estimate.";

export const SPOTLIGHT_CATEGORY_ICON_NAMES = [
  "headphones",
  "shirt",
  "home",
  "heart",
  "package",
  "sparkles",
  "gift",
  "shopping-bag",
  "laptop",
  "watch",
] as const;

export type SpotlightCategoryIconName =
  (typeof SPOTLIGHT_CATEGORY_ICON_NAMES)[number];

export const SPOTLIGHT_CATEGORY_ICONS: Record<
  SpotlightCategoryIconName,
  LucideIcon
> = {
  headphones: Headphones,
  shirt: Shirt,
  home: Home,
  heart: Heart,
  package: Package,
  sparkles: Sparkles,
  gift: Gift,
  "shopping-bag": ShoppingBag,
  laptop: Laptop,
  watch: Watch,
};

export const SPOTLIGHT_CATEGORY_ICON_LABELS: Record<
  SpotlightCategoryIconName,
  string
> = {
  headphones: "Headphones",
  shirt: "Shirt",
  home: "Home",
  heart: "Heart",
  package: "Package",
  sparkles: "Sparkles",
  gift: "Gift",
  "shopping-bag": "Shopping bag",
  laptop: "Laptop",
  watch: "Watch",
};

export const SPOTLIGHT_CATEGORY_GRADIENTS = [
  "from-sky-500/25 via-violet-500/15 to-background dark:from-sky-400/20 dark:via-violet-500/10",
  "from-rose-500/25 via-amber-500/10 to-background dark:from-rose-400/15 dark:via-amber-500/10",
  "from-emerald-500/20 via-teal-500/10 to-background dark:from-emerald-400/15",
  "from-fuchsia-500/20 via-pink-500/10 to-background dark:from-fuchsia-400/15",
  "from-orange-500/25 via-amber-500/15 to-background dark:from-orange-400/15",
  "from-indigo-500/25 via-cyan-500/10 to-background dark:from-indigo-400/15",
] as const;

export type SpotlightCategoryDefinition = {
  slug: SpotlightCategorySlug;
  title: string;
  description: string;
  tag: string;
  priceHint: string;
  gradient: string;
  iconName: SpotlightCategoryIconName;
};

export type SpotlightCategoryRecord = SpotlightCategoryDefinition & {
  isActive: boolean;
  sortIndex: number;
};

export const DEFAULT_SPOTLIGHT_CATEGORIES: readonly SpotlightCategoryDefinition[] =
  [
    {
      slug: "electronics-tech",
      title: "Electronics & tech",
      description:
        "Laptops, audio, and smart home—request a quote, we handle the buy.",
      tag: "Popular",
      priceHint: "Estimates from $89",
      gradient: SPOTLIGHT_CATEGORY_GRADIENTS[0],
      iconName: "headphones",
    },
    {
      slug: "fashion-footwear",
      title: "Fashion & footwear",
      description:
        "Seasonal drops and everyday staples consolidated for barrel shipping.",
      tag: "New season",
      priceHint: "Bundle & save",
      gradient: SPOTLIGHT_CATEGORY_GRADIENTS[1],
      iconName: "shirt",
    },
    {
      slug: "home-kitchen",
      title: "Home & kitchen",
      description:
        "Small appliances, cookware, and décor shipped to our hub for packing.",
      tag: "Editor's pick",
      priceHint: "Deals weekly",
      gradient: SPOTLIGHT_CATEGORY_GRADIENTS[2],
      iconName: "home",
    },
    {
      slug: "beauty-wellness",
      title: "Beauty & wellness",
      description:
        "Top brands with vetted listings—checkout when your cart is ready.",
      tag: "Self-care",
      priceHint: "From $12 items",
      gradient: SPOTLIGHT_CATEGORY_GRADIENTS[3],
      iconName: "heart",
    },
    {
      slug: "barrel-ready-bundles",
      title: "Barrel-ready bundles",
      description:
        "Mix categories in one shipment; we consolidate and label for Jamaica.",
      tag: "Best value",
      priceHint: "One hub, one address",
      gradient: SPOTLIGHT_CATEGORY_GRADIENTS[4],
      iconName: "package",
    },
  ];

/** Seeded storefront categories. Prefer DB-backed lists from `src/data/spotlight-categories.ts`. */
export const SPOTLIGHT_CATEGORIES = DEFAULT_SPOTLIGHT_CATEGORIES;

const defaultSlugSet = new Set<string>(spotlightCategorySlugValueSchema);

export function isSpotlightCategoryIconName(
  value: string,
): value is SpotlightCategoryIconName {
  return (SPOTLIGHT_CATEGORY_ICON_NAMES as readonly string[]).includes(value);
}

export function spotlightCategoryIcon(name: string): LucideIcon {
  if (isSpotlightCategoryIconName(name)) {
    return SPOTLIGHT_CATEGORY_ICONS[name];
  }
  return Package;
}

export function isSpotlightCategorySlug(value: string): value is SpotlightCategorySlug {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim());
}

export function isDefaultSpotlightCategorySlug(value: string): boolean {
  return defaultSlugSet.has(value);
}

export function spotlightCategoryBySlug(
  slug: SpotlightCategorySlug,
): SpotlightCategoryDefinition {
  const found = DEFAULT_SPOTLIGHT_CATEGORIES.find((c) => c.slug === slug);
  if (!found) {
    throw new Error(`Unknown spotlight category slug: ${slug}`);
  }
  return found;
}

export function slugifySpotlightCategoryTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "category";
}

export function nextSpotlightCategoryGradient(index: number): string {
  return SPOTLIGHT_CATEGORY_GRADIENTS[index % SPOTLIGHT_CATEGORY_GRADIENTS.length]!;
}

export function nextSpotlightCategoryIconName(
  index: number,
): SpotlightCategoryIconName {
  return SPOTLIGHT_CATEGORY_ICON_NAMES[
    index % SPOTLIGHT_CATEGORY_ICON_NAMES.length
  ]!;
}
