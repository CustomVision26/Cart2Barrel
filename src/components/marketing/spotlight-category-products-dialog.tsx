"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SpotlightCategoryOffersPanel } from "@/components/marketing/spotlight-category-offers-panel";
import type { PublicSpotlightProduct } from "@/data/spotlight-category-products";
import type { SpotlightCategoryDefinition } from "@/lib/spotlight-categories";
import { cn } from "@/lib/utils";

type SpotlightCategoryProductsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: SpotlightCategoryDefinition | null;
  products: PublicSpotlightProduct[];
  isSignedIn: boolean;
};

export function SpotlightCategoryProductsDialog({
  open,
  onOpenChange,
  category,
  products,
  isSignedIn,
}: SpotlightCategoryProductsDialogProps) {
  if (!category) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "flex max-h-[min(94vh,960px)] w-[min(98vw,72rem)] max-w-none flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-none",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border px-6 py-5 sm:px-8">
          <DialogTitle className="text-xl sm:text-2xl">{category.title}</DialogTitle>
          <DialogDescription className="text-pretty text-sm sm:text-base">
            {products.length > 0 ?
              "Swipe through curated products—view on the store or start a request from any slide."
            : "No curated products in this category yet. Check back soon or request any item from your dashboard."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8 sm:py-6">
          <SpotlightCategoryOffersPanel
            category={category}
            products={products}
            isSignedIn={isSignedIn}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
