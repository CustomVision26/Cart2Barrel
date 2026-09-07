"use client";

import { ChevronDown, Menu } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PublicSpotlightProduct } from "@/data/spotlight-category-products";
import { retailerLabelFromProductUrl } from "@/lib/site-name";
import { cn } from "@/lib/utils";

export const SPOTLIGHT_RETAILER_ALL = "all";

export function uniqueSpotlightRetailers(
  products: PublicSpotlightProduct[],
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const product of products) {
    const name = retailerLabelFromProductUrl(product.productUrl);
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export function filterProductsByRetailer(
  products: PublicSpotlightProduct[],
  retailer: string,
): PublicSpotlightProduct[] {
  if (retailer === SPOTLIGHT_RETAILER_ALL) return products;
  return products.filter(
    (product) => retailerLabelFromProductUrl(product.productUrl) === retailer,
  );
}

type SpotlightCategoryRetailerMenuProps = {
  categorySlug: string;
  products: PublicSpotlightProduct[];
  selectedRetailer: string;
  onSelectRetailer: (retailer: string) => void;
};

export function SpotlightCategoryRetailerMenu({
  categorySlug,
  products,
  selectedRetailer,
  onSelectRetailer,
}: SpotlightCategoryRetailerMenuProps) {
  const [menuOpen, setMenuOpen] = useState(true);
  const retailers = useMemo(
    () => uniqueSpotlightRetailers(products),
    [products],
  );

  useEffect(() => {
    setMenuOpen(true);
  }, [categorySlug]);

  if (products.length === 0) return null;

  const tabs = [
    { id: SPOTLIGHT_RETAILER_ALL, label: "All" },
    ...retailers.map((name) => ({ id: name, label: name })),
  ];

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={menuOpen}
        aria-controls={`spotlight-retailer-tabs-${categorySlug}`}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Menu className="size-3.5" aria-hidden />
        Retailers
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform",
            menuOpen && "rotate-180",
          )}
          aria-hidden
        />
      </Button>
      {menuOpen ?
        <div
          id={`spotlight-retailer-tabs-${categorySlug}`}
          role="tablist"
          aria-label="Filter offers by retailer"
          className="flex flex-wrap gap-1 border-b border-border/80"
        >
          {tabs.map((tab) => {
            const selected = selectedRetailer === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  selected
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                onClick={() => onSelectRetailer(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      : null}
    </div>
  );
}
