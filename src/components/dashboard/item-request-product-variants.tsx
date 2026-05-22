"use client";

import { ExternalLink, Layers, Loader2 } from "lucide-react";

import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

type ItemRequestProductVariantsProps = {
  variants: ProductVariantOffer[];
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
};

function stockLabel(inStock: boolean | null): string {
  if (inStock === true) return "In stock";
  if (inStock === false) return "Out of stock";
  return "—";
}

export function ItemRequestProductVariants({
  variants,
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
}: ItemRequestProductVariantsProps) {
  return (
    <Card className="overflow-hidden shadow-sm ring-1 ring-border/50">
      <CardHeader className="border-b border-border/80 bg-muted/15 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers className="size-5" aria-hidden />
          Store variants
        </CardTitle>
        <CardDescription>
          Loads sizes, colors, and pack options for this retailer from SerpApi
          (Walmart, Amazon, Google Shopping) and from the product page (Temu,
          Shein, and others). Apply copies the variant and reads the product
          title from the retailer page into the request form.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!canLoadVariants || isVariantsPending || isSubmitPending}
            onClick={onLoadVariants}
          >
            {isVariantsPending ?
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading variants…
              </>
            : "Load all store variants"}
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

        {variantsMessage ?
          <p
            role="status"
            className={cn(
              "text-sm",
              variantsMessage.includes("Found") ?
                "text-muted-foreground"
              : "text-destructive",
            )}
          >
            {variantsMessage}
          </p>
        : null}

        {variants.length > 0 ?
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Variant</th>
                  <th className="px-3 py-2 font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Stock</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border/80 last:border-0",
                      row.isCurrent && "bg-primary/5",
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-foreground">
                        {row.label}
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
                          onClick={() => onSubmitVariant(row)}
                        >
                          Submit request
                        </Button>
                        {row.productUrl ?
                          <a
                            href={row.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <ExternalLink className="size-3.5" aria-hidden />
                            Open
                          </a>
                        : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        : null}
      </CardContent>
    </Card>
  );
}
