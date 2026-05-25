"use client";

import { useState } from "react";
import { ChevronDown, Layers, Loader2, Plus, Trash2 } from "lucide-react";

import {
  adminCreateSpotlightVariantAction,
  adminDeleteSpotlightVariantAction,
  adminImportSpotlightVariantsAction,
  adminRefreshSpotlightVariantImageAction,
  adminSetSpotlightVariantImageUrlAction,
  adminUploadSpotlightVariantImageAction,
} from "@/actions/admin-spotlight-variants";
import { AdminSpotlightPreviewImageField } from "@/components/admin/admin-spotlight-preview-image-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminSpotlightProductRow } from "@/data/spotlight-category-products";
import type { AdminSpotlightVariantRow } from "@/data/spotlight-product-variants";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

type AdminSpotlightProductVariantsPanelProps = {
  product: AdminSpotlightProductRow;
  pending: boolean;
  onStatusMessage: (message: string | null) => void;
  onRefresh: () => void;
  runMutation: (fn: () => Promise<void>) => void;
};

function VariantRow({
  variant,
  pending,
  onStatusMessage,
  onRefresh,
  runMutation,
}: {
  variant: AdminSpotlightVariantRow;
  pending: boolean;
  onStatusMessage: (message: string | null) => void;
  onRefresh: () => void;
  runMutation: (fn: () => Promise<void>) => void;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-md border border-border/80 bg-muted px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-foreground">
          {variant.label?.trim() || "Variant"}
          {!variant.isActive ?
            <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
              (inactive)
            </span>
          : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {[
            variant.productColor,
            variant.productSize,
            variant.packLabel,
            variant.priceUsdCents != null && variant.priceUsdCents > 0
              ? formatUsd(variant.priceUsdCents)
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
        {variant.productUrl ?
          <a
            href={variant.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-xs text-primary hover:underline"
          >
            {variant.productUrl}
          </a>
        : null}
      </div>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="shrink-0"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Remove this variant?")) return;
          onStatusMessage(null);
          runMutation(async () => {
            const res = await adminDeleteSpotlightVariantAction({ id: variant.id });
            onStatusMessage(res.message ?? (res.ok ? "Removed." : "Failed."));
            if (res.ok) onRefresh();
          });
        }}
      >
        <Trash2 className="size-3.5" aria-hidden />
        Remove
      </Button>
      </div>
      <AdminSpotlightPreviewImageField
        label="Variant image"
        imageUrl={variant.imageUrl}
        pending={pending}
        compact
        entityIdField="variantId"
        entityId={variant.id}
        onRefresh={() => adminRefreshSpotlightVariantImageAction({ id: variant.id })}
        onUpload={adminUploadSpotlightVariantImageAction}
        onSetImageUrl={(url) =>
          adminSetSpotlightVariantImageUrlAction({ id: variant.id, imageUrl: url })
        }
        onSuccess={onRefresh}
        runMutation={runMutation}
      />
    </li>
  );
}

export function AdminSpotlightProductVariantsPanel({
  product,
  pending,
  onStatusMessage,
  onRefresh,
  runMutation,
}: AdminSpotlightProductVariantsPanelProps) {
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const variants = product.variants ?? [];

  return (
    <div className="w-full border-t border-border/60 pt-3">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left text-sm font-medium text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
        <Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        Variants
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {variants.length}
        </span>
      </button>

      {open ?
        <div className="mt-3 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => {
                onStatusMessage(null);
                runMutation(async () => {
                  const res = await adminImportSpotlightVariantsAction({
                    parentProductId: product.id,
                    replaceExisting: false,
                  });
                  onStatusMessage(res.message ?? (res.ok ? "Done." : "Failed."));
                  if (res.ok) onRefresh();
                });
              }}
            >
              {pending ?
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              : null}
              Import from URL (append)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (
                  variants.length > 0 &&
                  !window.confirm(
                    "Replace all existing variants with a fresh import from the product URL?",
                  )
                ) {
                  return;
                }
                onStatusMessage(null);
                runMutation(async () => {
                  const res = await adminImportSpotlightVariantsAction({
                    parentProductId: product.id,
                    replaceExisting: true,
                  });
                  onStatusMessage(res.message ?? (res.ok ? "Done." : "Failed."));
                  if (res.ok) onRefresh();
                });
              }}
            >
              Replace all from URL
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setShowAddForm((v) => !v)}
            >
              <Plus className="size-3.5" aria-hidden />
              Add manually
            </Button>
          </div>

          {showAddForm ?
            <form
              className="grid gap-3 rounded-lg border border-border/80 bg-muted p-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                onStatusMessage(null);
                runMutation(async () => {
                  const res = await adminCreateSpotlightVariantAction({
                    parentProductId: product.id,
                    label: String(fd.get("label") ?? "") || undefined,
                    priceUsd: String(fd.get("priceUsd") ?? "") || undefined,
                    productSize: String(fd.get("productSize") ?? "") || undefined,
                    productColor: String(fd.get("productColor") ?? "") || undefined,
                    packLabel: String(fd.get("packLabel") ?? "") || undefined,
                    productUrl: String(fd.get("productUrl") ?? "") || undefined,
                  });
                  onStatusMessage(res.message ?? (res.ok ? "Saved." : "Failed."));
                  if (res.ok) {
                    form.reset();
                    setShowAddForm(false);
                    onRefresh();
                  }
                });
              }}
            >
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor={`vlabel-${product.id}`}>Label</Label>
                <Input
                  id={`vlabel-${product.id}`}
                  name="label"
                  placeholder="e.g. Red · XL · 6 pack"
                  disabled={pending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`vprice-${product.id}`}>Cost (USD)</Label>
                <Input
                  id={`vprice-${product.id}`}
                  name="priceUsd"
                  placeholder="12.99"
                  disabled={pending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`vurl-${product.id}`}>Variant URL (optional)</Label>
                <Input
                  id={`vurl-${product.id}`}
                  name="productUrl"
                  type="url"
                  placeholder="https://…"
                  disabled={pending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`vsize-${product.id}`}>Size</Label>
                <Input id={`vsize-${product.id}`} name="productSize" disabled={pending} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`vcolor-${product.id}`}>Color</Label>
                <Input id={`vcolor-${product.id}`} name="productColor" disabled={pending} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor={`vpack-${product.id}`}>Pack / quantity label</Label>
                <Input
                  id={`vpack-${product.id}`}
                  name="packLabel"
                  placeholder="e.g. 6 pack"
                  disabled={pending}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" size="sm" disabled={pending}>
                  Save variant
                </Button>
              </div>
            </form>
          : null}

          {variants.length === 0 ?
            <p className="text-xs text-muted-foreground">
              No variants stored. Import from the parent product URL (SerpApi + page
              AI) or add rows manually.
            </p>
          : <ul className="space-y-2">
              {variants.map((variant) => (
                <VariantRow
                  key={variant.id}
                  variant={variant}
                  pending={pending}
                  onStatusMessage={onStatusMessage}
                  onRefresh={onRefresh}
                  runMutation={runMutation}
                />
              ))}
            </ul>
          }
        </div>
      : null}
    </div>
  );
}
