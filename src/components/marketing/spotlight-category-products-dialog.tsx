"use client";

import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PublicSpotlightProduct } from "@/data/spotlight-category-products";
import { formatUsd } from "@/lib/admin-markup";
import {
  aiAssistedRequestUrlWithSpotlightProduct,
  aiAssistedRequestUrlWithSpotlightVariant,
} from "@/lib/ai-assisted-request-url";
import type { SpotlightCategoryDefinition } from "@/lib/spotlight-categories";
import { displaySiteName } from "@/lib/site-name";

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

  const signupReturn =
    products[0] ?
      aiAssistedRequestUrlWithSpotlightProduct(products[0])
    : "/dashboard/items/requested-items/ai-assisted-request";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{category.title}</DialogTitle>
          <DialogDescription>
            {products.length > 0 ?
              "Open a listing on the retailer site, or start a request with the link prefilled."
            : "No curated products in this category yet. Check back soon or request any item from your dashboard."}
          </DialogDescription>
        </DialogHeader>

        {products.length === 0 ?
          <div className="flex flex-col gap-3 pt-2">
            <Button
              nativeButton={false}
              render={
                <Link href={isSignedIn ? "/dashboard" : "/signup"} />
              }
            >
              {isSignedIn ? "Go to dashboard" : "Get started"}
            </Button>
          </div>
        : <ul className="grid gap-4 pt-2">
            {products.map((product) => {
              const title =
                product.label?.trim() ||
                displaySiteName(null, product.productUrl);
              const parentAddHref =
                isSignedIn ?
                  aiAssistedRequestUrlWithSpotlightProduct(product)
                : `/signup?redirect_url=${encodeURIComponent(aiAssistedRequestUrlWithSpotlightProduct(product))}`;
              const variants = product.variants ?? [];

              return (
                <li
                  key={product.id}
                  className="space-y-2 rounded-xl border border-border bg-card p-2 shadow-sm"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col overflow-hidden rounded-lg border border-border/80">
                      <div className="relative aspect-[4/3] w-full bg-muted/40">
                        {product.imageUrl ?
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt=""
                            className="size-full object-cover"
                          />
                        : <div className="flex size-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
                            Preview unavailable
                          </div>
                        }
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        <p className="line-clamp-2 text-sm font-medium text-foreground">
                          {title}
                          {variants.length > 0 ?
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              (default)
                            </span>
                          : null}
                        </p>
                        {product.priceUsdCents != null &&
                        product.priceUsdCents > 0 ?
                          <p className="text-sm font-semibold text-primary">
                            {formatUsd(product.priceUsdCents)}
                          </p>
                        : null}
                        {product.productSize?.trim() ||
                        product.productColor?.trim() ?
                          <p className="text-xs text-muted-foreground">
                            {[
                              product.productSize?.trim(),
                              product.productColor?.trim(),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        : null}
                        <div className="mt-auto flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            nativeButton={false}
                            render={
                              <a
                                href={product.productUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            }
                          >
                            <ExternalLink className="size-3.5" aria-hidden />
                            View on store
                          </Button>
                          <Button
                            size="sm"
                            className="w-full"
                            nativeButton={false}
                            render={<Link href={parentAddHref} />}
                          >
                            <Plus className="size-3.5" aria-hidden />
                            Add request
                          </Button>
                        </div>
                      </div>
                    </div>

                    {variants.length > 0 ?
                      <ul className="flex max-h-[min(280px,50vh)] flex-col gap-2 overflow-y-auto pr-1">
                        {variants.map((variant) => {
                          const variantTitle =
                            variant.label?.trim() || "Variant";
                          const variantHref =
                            isSignedIn ?
                              aiAssistedRequestUrlWithSpotlightVariant(
                                product,
                                variant,
                              )
                            : `/signup?redirect_url=${encodeURIComponent(aiAssistedRequestUrlWithSpotlightVariant(product, variant))}`;

                          return (
                            <li
                              key={variant.id}
                              className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/20 p-2.5"
                            >
                              <p className="text-sm font-medium text-foreground">
                                {variantTitle}
                              </p>
                              {variant.priceUsdCents != null &&
                              variant.priceUsdCents > 0 ?
                                <p className="text-sm font-semibold text-primary">
                                  {formatUsd(variant.priceUsdCents)}
                                </p>
                              : null}
                              <p className="text-xs text-muted-foreground">
                                {[
                                  variant.productColor?.trim(),
                                  variant.productSize?.trim(),
                                  variant.packLabel?.trim(),
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </p>
                              <div className="flex flex-col gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  nativeButton={false}
                                  render={
                                    <a
                                      href={variant.productUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    />
                                  }
                                >
                                  <ExternalLink className="size-3.5" aria-hidden />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  className="w-full"
                                  nativeButton={false}
                                  render={<Link href={variantHref} />}
                                >
                                  <Plus className="size-3.5" aria-hidden />
                                  Add request
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    : null}
                  </div>
                </li>
              );
            })}
          </ul>
        }

        {products.length > 0 && !isSignedIn ?
          <p className="text-center text-xs text-muted-foreground">
            <Link
              href={`/login?redirect_url=${encodeURIComponent(signupReturn)}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>{" "}
            to add a request with your account.
          </p>
        : null}
      </DialogContent>
    </Dialog>
  );
}
