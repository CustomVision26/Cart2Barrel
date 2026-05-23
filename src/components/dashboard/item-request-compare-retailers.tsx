"use client";

import { useState } from "react";
import { ExternalLink, Loader2, ShoppingBag } from "lucide-react";

import type { RetailerPriceOffer } from "@/lib/retailer-price-compare";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatUsd } from "@/lib/admin-markup";
import { COMPARE_REQUIRES_PRODUCT_NAME_MESSAGE } from "@/lib/item-request-product-name-hint";
import { cn } from "@/lib/utils";

type ItemRequestCompareRetailersProps = {
  offers: RetailerPriceOffer[];
  searchQuery: string | null;
  fallbackImageUrl: string | null;
  compareMessage: string | null;
  isComparePending: boolean;
  isSubmitPending: boolean;
  onCompare: () => void;
  onSubmitOffer: (offer: RetailerPriceOffer) => void;
  canCompare: boolean;
  needsManualProductName?: boolean;
};

function matchLabel(offer: RetailerPriceOffer): string {
  if (offer.isOriginal) return "Your link";
  if (offer.aiVerified && offer.matchConfidence != null) {
    return `Verified ${Math.round(offer.matchConfidence * 100)}%`;
  }
  return "Across the web";
}

export function ItemRequestCompareRetailers({
  offers,
  searchQuery,
  fallbackImageUrl,
  compareMessage,
  isComparePending,
  isSubmitPending,
  onCompare,
  onSubmitOffer,
  canCompare,
  needsManualProductName = false,
}: ItemRequestCompareRetailersProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const previewOffer =
    previewUrl ? offers.find((o) => o.productUrl === previewUrl) : null;

  return (
    <Card className="overflow-hidden border-border/80 shadow-none">
      <CardHeader className="space-y-1 border-b border-border bg-muted/30 px-6 py-5">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <ShoppingBag className="size-4 text-muted-foreground" aria-hidden />
          Retailer price comparison
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Search Google Shopping via SerpApi for offers across the web (same as
          browser shopping extensions). Verified rows are AI-checked for the same
          SKU; others are shown for price discovery—confirm on the retailer site
          before submitting.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!canCompare || isComparePending || isSubmitPending}
            onClick={onCompare}
          >
            {isComparePending ?
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Comparing…
              </>
            : "Compare retailer prices"}
          </Button>
          {searchQuery ?
            <span className="text-xs text-muted-foreground">
              Search: <span className="font-medium text-foreground">{searchQuery}</span>
            </span>
          : null}
        </div>

        {compareMessage ?
          <p
            role="status"
            className={cn(
              "text-pretty text-sm leading-relaxed break-words",
              compareMessage.toLowerCase().includes("could not") ||
                compareMessage.toLowerCase().includes("not configured")
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {compareMessage}
          </p>
        : needsManualProductName && !canCompare ?
          <p
            role="status"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-pretty text-sm leading-relaxed text-amber-950 dark:text-amber-100"
          >
            {COMPARE_REQUIRES_PRODUCT_NAME_MESSAGE}
          </p>
        : null}

        {offers.length > 0 ?
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Retailer</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">Match</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {offers.map((offer) => {
                    const img =
                      offer.imageUrl?.trim() || fallbackImageUrl?.trim() || null;
                    const isPreviewing = previewUrl === offer.productUrl;
                    return (
                      <tr
                        key={offer.id}
                        className={cn(
                          "bg-background",
                          isPreviewing && "bg-primary/5",
                        )}
                      >
                        <td className="px-3 py-3 align-top">
                          <div className="flex min-w-0 items-start gap-2">
                            {img ?
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={img}
                                alt=""
                                className="size-10 shrink-0 rounded object-cover ring-1 ring-border"
                              />
                            : <div className="size-10 shrink-0 rounded bg-muted" />}
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">
                                {offer.retailer}
                                {offer.isOriginal ?
                                  <span className="ml-1.5 text-xs font-normal text-primary">
                                    (your link)
                                  </span>
                                : null}
                              </p>
                              <p className="line-clamp-2 text-xs text-muted-foreground">
                                {offer.title}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top tabular-nums font-medium">
                          {offer.priceUsdCents != null ?
                            formatUsd(offer.priceUsdCents)
                          : "—"}
                        </td>
                        <td className="px-3 py-3 align-top text-muted-foreground">
                          <span
                            className={cn(
                              offer.aiVerified || offer.isOriginal ?
                                "text-foreground"
                              : "text-amber-700 dark:text-amber-300",
                            )}
                          >
                            {matchLabel(offer)}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isSubmitPending}
                              onClick={() => setPreviewUrl(offer.productUrl)}
                            >
                              Preview
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              nativeButton={false}
                              render={
                                <a
                                  href={offer.productUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              }
                            >
                              <ExternalLink className="size-3.5" aria-hidden />
                              Open
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={isSubmitPending}
                              onClick={() => onSubmitOffer(offer)}
                            >
                              {isSubmitPending ?
                                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                              : null}
                              Submit for review
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {previewOffer ?
              <p className="text-sm text-muted-foreground">
                Selected{" "}
                <span className="font-medium text-foreground">
                  {previewOffer.retailer}
                </span>
                — use Open beside that row to view the listing on the retailer site.
              </p>
            : null}
          </div>
        : <p className="text-sm text-muted-foreground">
            Run a comparison to see offers across the web from Google Shopping.
          </p>
        }
      </CardContent>
    </Card>
  );
}
