"use client";

import { ExternalLink, Layers, Loader2 } from "lucide-react";

import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { normalizeRetailerImageUrl } from "@/lib/product-variants/variant-images";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatUsd } from "@/lib/admin-markup";
import {
  dashItemsTableCardHeader,
  dashItemsTableHead,
  dashItemsTableScroll,
  dashItemsVariantRowCurrent,
} from "@/lib/app-table-surfaces";
import { cn } from "@/lib/utils";

type ItemRequestProductVariantsProps = {
  variants: ProductVariantOffer[];
  /** SerpApi listing hero image when variant rows share one photo. */
  listingImageUrl?: string | null;
  retailer: string | null;
  method: string | null;
  variantsMessage: string | null;
  isVariantsPending: boolean;
  isApplyVariantPending: boolean;
  applyingVariantId: string | null;
  isSubmitPending: boolean;
  onLoadVariants: () => void;
  onApplyVariant: (variant: ProductVariantOffer) => void;
  onSubmitVariant: (variant: ProductVariantOffer) => void;
  canLoadVariants: boolean;
  loadVariantsDisabledTitle?: string;
  /** Hide the load button when variants are fetched from the product URL card. */
  hideLoadButton?: boolean;
  /** Render table + status only (no outer card) for embedding in the product URL panel. */
  embedded?: boolean;
};

function stockLabel(inStock: boolean | null): string {
  if (inStock === true) return "In stock";
  if (inStock === false) return "Out of stock";
  return "—";
}

function isVariantsInfoNotice(message: string): boolean {
  return (
    message.includes("were retrieved") ||
    message.includes("was retrieved") ||
    message.includes("Found")
  );
}

function variantsNoticeClassName(message: string): string {
  if (isVariantsInfoNotice(message)) {
    return "rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-pretty text-sm leading-relaxed text-amber-950 dark:text-amber-100";
  }
  return "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm leading-relaxed text-destructive";
}

export const VARIANT_APPLY_TOOLTIP =
  "Copy this variant's URL, price, size, color, and image into the request form.";

export const VARIANT_SUBMIT_TOOLTIP =
  "Submit a staff review request using this variant's details.";

export const VARIANT_OPEN_TOOLTIP =
  "Open this variant's product page on the retailer site in a new tab.";

function variantImageSrc(
  row: ProductVariantOffer,
  listingImageUrl: string | null | undefined,
): string | null {
  return (
    normalizeRetailerImageUrl(row.imageUrl) ??
    normalizeRetailerImageUrl(listingImageUrl)
  );
}

export function ItemRequestProductVariants({
  variants,
  listingImageUrl = null,
  retailer,
  method,
  variantsMessage,
  isVariantsPending,
  isApplyVariantPending,
  applyingVariantId,
  isSubmitPending,
  onLoadVariants,
  onApplyVariant,
  onSubmitVariant,
  canLoadVariants,
  loadVariantsDisabledTitle,
  hideLoadButton = false,
  embedded = false,
}: ItemRequestProductVariantsProps) {
  const body = (
    <>
        <div className="flex flex-wrap items-center gap-2">
          {!hideLoadButton ?
            <Button
              type="button"
              variant="secondary"
              className={cn(!canLoadVariants && "opacity-50")}
              disabled={!canLoadVariants || isVariantsPending || isSubmitPending}
              title={loadVariantsDisabledTitle}
              onClick={onLoadVariants}
            >
              {isVariantsPending ?
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Loading variants…
                </>
              : "Load store variants"}
            </Button>
          : null}
          {retailer ?
            <span className="text-sm text-muted-foreground">{retailer}</span>
          : null}
          {method ?
            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {method}
            </span>
          : null}
        </div>

        {variantsMessage ?
          <p
            role={isVariantsInfoNotice(variantsMessage) ? "note" : "status"}
            className={variantsNoticeClassName(variantsMessage)}
          >
            {variantsMessage}
          </p>
        : null}

        {variants.length > 0 ?
          <div className={cn("overflow-x-auto", dashItemsTableScroll)}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className={dashItemsTableHead}>
                <tr>
                  <th className="w-16 px-3 py-2 font-medium">Image</th>
                  <th className="px-3 py-2 font-medium">Variant</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Stock</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((row) => {
                  const imgSrc = variantImageSrc(row, listingImageUrl);
                  return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border/80 last:border-0",
                      row.isCurrent && dashItemsVariantRowCurrent,
                    )}
                  >
                    <td className="px-3 py-2.5 align-top">
                      <ProductRequestThumbnail
                        imageUrl={imgSrc}
                        productLabel={row.label}
                        variant="list"
                        className="size-14 max-w-14"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-foreground">
                        {row.label || row.productTitle || "Default"}
                        {row.isCurrent ?
                          <span className="ml-2 text-[10px] font-semibold uppercase text-primary">
                            Current
                          </span>
                        : null}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {[row.color, row.size, row.packLabel]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatUsd(row.priceUsdCents)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {stockLabel(row.inStock)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            isSubmitPending ||
                            isApplyVariantPending ||
                            isVariantsPending
                          }
                          title={VARIANT_APPLY_TOOLTIP}
                          onClick={() => onApplyVariant(row)}
                        >
                          {isApplyVariantPending &&
                          applyingVariantId === row.id ?
                            <>
                              <Loader2
                                className="size-3.5 animate-spin"
                                aria-hidden
                              />
                              Applying…
                            </>
                          : "Apply"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSubmitPending}
                          title={VARIANT_SUBMIT_TOOLTIP}
                          onClick={() => onSubmitVariant(row)}
                        >
                          Submit for review
                        </Button>
                        {row.productUrl ?
                          <a
                            href={row.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={VARIANT_OPEN_TOOLTIP}
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <ExternalLink className="size-3.5" aria-hidden />
                            Open
                          </a>
                        : null}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        : null}
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{body}</div>;
  }

  return (
    <Card className="overflow-hidden border-border/80 shadow-none">
      <CardHeader className={dashItemsTableCardHeader}>
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <Layers className="size-4 text-muted-foreground" aria-hidden />
          Store variants
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Sizes, colors, and pack options from the retailer (via SerpAPI when available).
          Apply copies variant details into the request form.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-5">{body}</CardContent>
    </Card>
  );
}
