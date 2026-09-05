"use client";

import { Layers, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
import {
  dashItemsTableCardHeader,
  dashItemsTableHead,
  dashItemsTableScroll,
  dashItemsVariantRowCurrent,
} from "@/lib/app-table-surfaces";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type ItemRequestProductVariantsProps = {
  variants: ProductVariantOffer[];
  listingImageUrl?: string | null;
  retailer: string | null;
  method: string | null;
  variantsMessage: string | null;
  isVariantsPending: boolean;
  isApplyVariantPending: boolean;
  applyingVariantId: string | null;
  selectedVariantId?: string | null;
  isSubmitPending: boolean;
  onLoadVariants: () => void;
  onApplyVariant: (variant: ProductVariantOffer) => void;
  canLoadVariants: boolean;
  loadVariantsDisabledTitle?: string;
  hideLoadButton?: boolean;
  embedded?: boolean;
};

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
  "Select this variant to copy its name, URL, price, size, color, and photo into the request form.";

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
  selectedVariantId = null,
  isSubmitPending,
  onLoadVariants,
  onApplyVariant,
  canLoadVariants,
  loadVariantsDisabledTitle,
  hideLoadButton = false,
  embedded = false,
}: ItemRequestProductVariantsProps) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [variants]);

  const totalPages = Math.max(1, Math.ceil(variants.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return variants.slice(start, start + PAGE_SIZE);
  }, [variants, pageSafe]);
  const showFrom =
    variants.length === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE + 1;
  const showTo = Math.min(pageSafe * PAGE_SIZE, variants.length);
  const rowsLocked =
    isSubmitPending || isApplyVariantPending || isVariantsPending;
  const showLoadToolbar = !hideLoadButton;

  const body = (
    <>
      {showLoadToolbar ?
        <div className="flex flex-wrap items-center gap-2">
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
          {retailer ?
            <span className="text-sm text-muted-foreground">{retailer}</span>
          : null}
          {method ?
            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {method}
            </span>
          : null}
        </div>
      : null}

      {variantsMessage ?
        <p
          role={isVariantsInfoNotice(variantsMessage) ? "note" : "status"}
          className={variantsNoticeClassName(variantsMessage)}
        >
          {variantsMessage}
        </p>
      : null}

      {variants.length > 0 ?
        <div className="space-y-3">
          <div className={cn("overflow-x-auto", dashItemsTableScroll)}>
            <table className="w-full text-left text-sm">
              <thead className={dashItemsTableHead}>
                <tr>
                  <th className="w-16 px-3 py-2 font-medium">Image</th>
                  <th className="px-3 py-2 font-medium">Variant</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const imgSrc = variantImageSrc(row, listingImageUrl);
                  const selected =
                    selectedVariantId === row.id ||
                    (selectedVariantId == null && row.isCurrent);
                  const applying = applyingVariantId === row.id;
                  const subtitle =
                    [row.color, row.size, row.packLabel]
                      .filter(Boolean)
                      .join(" · ") || null;
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border/80 last:border-0",
                        selected && dashItemsVariantRowCurrent,
                        !rowsLocked && "cursor-pointer hover:bg-muted/70",
                        rowsLocked && "opacity-80",
                      )}
                      onClick={(event) => {
                        if (rowsLocked) return;
                        event.preventDefault();
                        onApplyVariant(row);
                      }}
                      onKeyDown={(event) => {
                        if (rowsLocked) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          onApplyVariant(row);
                        }
                      }}
                      tabIndex={rowsLocked ? -1 : 0}
                      aria-selected={selected}
                      aria-label={`Select ${row.label || row.productTitle || "variant"}`}
                      title={VARIANT_APPLY_TOOLTIP}
                    >
                      <td className="px-3 py-2.5 align-middle">
                        <ProductRequestThumbnail
                          imageUrl={imgSrc}
                          productLabel={row.label}
                          variant="list"
                          className="size-12 max-w-12 rounded-md border-border/60 bg-white sm:size-14 sm:max-w-14"
                        />
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <div className="font-medium text-foreground">
                          {row.label || row.productTitle || "Default"}
                          {applying ?
                            <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                              <Loader2 className="size-3 animate-spin" aria-hidden />
                              Loading
                            </span>
                          : null}
                        </div>
                        {subtitle ?
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {subtitle}
                          </div>
                        : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ?
            <div className="flex flex-col items-stretch gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {showFrom}-{showTo}
                </span>{" "}
                of{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {variants.length}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage(pageSafe - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage(pageSafe + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          : null}
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
          Select a row to fill Request details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-5">{body}</CardContent>
    </Card>
  );
}
