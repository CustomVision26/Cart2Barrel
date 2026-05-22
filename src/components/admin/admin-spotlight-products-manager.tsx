"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ImageIcon, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminSpotlightCategoryAddForm } from "@/components/admin/admin-spotlight-category-add-form";
import { AdminSpotlightProductEditDialog } from "@/components/admin/admin-spotlight-product-edit-dialog";
import { AdminSpotlightProductVariantsPanel } from "@/components/admin/admin-spotlight-product-variants-panel";

import {
  adminDeleteSpotlightProductAction,
  adminRefreshSpotlightProductImageAction,
  adminSetSpotlightProductImageUrlAction,
  adminUploadSpotlightProductImageAction,
} from "@/actions/admin-spotlight-products";
import { AdminSpotlightPreviewImageField } from "@/components/admin/admin-spotlight-preview-image-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminSpotlightProductRow } from "@/data/spotlight-category-products";
import {
  SPOTLIGHT_CATEGORIES,
  type SpotlightCategoryDefinition,
  type SpotlightCategorySlug,
} from "@/lib/spotlight-categories";
import { formatUsd } from "@/lib/admin-markup";
import { displaySiteName, hostnameFromProductUrl } from "@/lib/site-name";
import { cn } from "@/lib/utils";

type AdminSpotlightProductsManagerProps = {
  initialProducts: AdminSpotlightProductRow[];
};

function SpotlightCategoryPanel({
  category,
  products,
  pending,
  onStatusMessage,
  onRefresh,
  runMutation,
  onEditProduct,
}: {
  category: SpotlightCategoryDefinition;
  products: AdminSpotlightProductRow[];
  pending: boolean;
  onStatusMessage: (message: string | null) => void;
  onRefresh: () => void;
  runMutation: (fn: () => Promise<void>) => void;
  onEditProduct: (product: AdminSpotlightProductRow) => void;
}) {
  const Icon = category.icon;
  const [removeTarget, setRemoveTarget] = useState<AdminSpotlightProductRow | null>(
    null,
  );

  const confirmRemove = () => {
    if (!removeTarget) return;
    const product = removeTarget;
    setRemoveTarget(null);
    onStatusMessage(null);
    runMutation(async () => {
      const res = await adminDeleteSpotlightProductAction({ id: product.id });
      if (res.ok) {
        toast.success(res.message ?? "Product removed from spotlight.");
        onRefresh();
      } else {
        toast.error(res.message);
        onStatusMessage(res.message);
      }
    });
  };

  return (
    <Card>
      <CardHeader className="border-b border-border/60">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
              category.gradient,
            )}
          >
            <Icon className="size-5 text-foreground/70" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">{category.title}</CardTitle>
            <CardDescription>{category.description}</CardDescription>
            <p className="text-xs text-muted-foreground">
              Slug: <code className="text-foreground/80">{category.slug}</code>
              {" · "}
              {products.length} product{products.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <AdminSpotlightCategoryAddForm
          categorySlug={category.slug}
          pending={pending}
          onRefresh={onRefresh}
          runMutation={runMutation}
        />

        {products.length === 0 ?
          <p className="text-sm text-muted-foreground">
            No products yet. Use Add product to category with SerpApi, then save
            rows to the spotlight carousel.
          </p>
        : <ul className="divide-y divide-border rounded-lg border border-border">
            {products.map((product) => (
              <li
                key={product.id}
                className="flex flex-col gap-3 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted/50">
                    {product.imageUrl ?
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    : <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="size-5" aria-hidden />
                      </div>
                    }
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {product.label?.trim() ||
                        displaySiteName(null, product.productUrl)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {hostnameFromProductUrl(product.productUrl)}
                      {product.priceUsdCents != null && product.priceUsdCents > 0 ?
                        <span className="ml-2 font-medium text-foreground">
                          · {formatUsd(product.priceUsdCents)}
                        </span>
                      : null}
                      {product.productSize?.trim() ?
                        <span className="ml-2">· {product.productSize.trim()}</span>
                      : null}
                      {product.productColor?.trim() ?
                        <span className="ml-2">· {product.productColor.trim()}</span>
                      : null}
                      {!product.isActive ?
                        <span className="ml-2 text-amber-600 dark:text-amber-400">
                          (inactive)
                        </span>
                      : null}
                    </p>
                    <a
                      href={product.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-xs text-primary underline-offset-4 hover:underline"
                    >
                      {product.productUrl}
                    </a>
                    {!product.imageUrl ?
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        No preview image — refresh, upload, or paste a URL below.
                      </p>
                    : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => onEditProduct(product)}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      runMutation(async () => {
                        const res = await adminRefreshSpotlightProductImageAction({
                          id: product.id,
                        });
                        if (res.ok) {
                          toast.success(res.message ?? "Image updated.");
                          onRefresh();
                        } else {
                          toast.error(res.message);
                        }
                      });
                    }}
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Refresh image
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={pending}
                    onClick={() => setRemoveTarget(product)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Remove
                  </Button>
                </div>
                </div>
                {!product.imageUrl ?
                  <AdminSpotlightPreviewImageField
                    label="Product image"
                    imageUrl={product.imageUrl}
                    pending={pending}
                    compact
                    entityIdField="productId"
                    entityId={product.id}
                    onRefresh={() =>
                      adminRefreshSpotlightProductImageAction({ id: product.id })
                    }
                    onUpload={adminUploadSpotlightProductImageAction}
                    onSetImageUrl={(url) =>
                      adminSetSpotlightProductImageUrlAction({
                        id: product.id,
                        imageUrl: url,
                      })
                    }
                    onSuccess={onRefresh}
                    runMutation={runMutation}
                  />
                : null}
                <AdminSpotlightProductVariantsPanel
                  product={product}
                  pending={pending}
                  onStatusMessage={onStatusMessage}
                  onRefresh={onRefresh}
                  runMutation={runMutation}
                />
              </li>
            ))}
          </ul>
        }
      </CardContent>

      <Dialog
        open={removeTarget != null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove spotlight product?</DialogTitle>
            <DialogDescription>
              {removeTarget ?
                <>
                  This removes{" "}
                  <span className="font-medium text-foreground">
                    {removeTarget.label?.trim() ||
                      displaySiteName(null, removeTarget.productUrl)}
                  </span>{" "}
                  from <span className="font-medium">{category.title}</span>.
                  Variants for this product are deleted too. This cannot be undone.
                </>
              : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setRemoveTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={confirmRemove}
            >
              {pending ? "Removing…" : "Remove product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function AdminSpotlightProductsManager({
  initialProducts,
}: AdminSpotlightProductsManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeSlug, setActiveSlug] = useState<SpotlightCategorySlug>(
    SPOTLIGHT_CATEGORIES[0].slug,
  );
  const [editProduct, setEditProduct] = useState<AdminSpotlightProductRow | null>(
    null,
  );

  const byCategory = useMemo(() => {
    const map = new Map<SpotlightCategorySlug, AdminSpotlightProductRow[]>();
    for (const cat of SPOTLIGHT_CATEGORIES) {
      map.set(cat.slug, []);
    }
    for (const row of initialProducts) {
      const list = map.get(row.categorySlug) ?? [];
      list.push(row);
      map.set(row.categorySlug, list);
    }
    return map;
  }, [initialProducts]);

  const activeCategory = SPOTLIGHT_CATEGORIES.find((c) => c.slug === activeSlug)!;
  const activeProducts = byCategory.get(activeSlug) ?? [];

  const tabLinkClass = (selected: boolean) =>
    cn(
      "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
      selected
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="space-y-4">
      {statusMessage ?
        <p
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            statusMessage.toLowerCase().includes("could not") ||
              statusMessage.toLowerCase().includes("required")
              ? "border-destructive/40 bg-destructive/10 text-foreground"
              : "border-border bg-muted/40 text-muted-foreground",
          )}
          role="status"
        >
          {statusMessage}
        </p>
      : null}

      <div
        role="tablist"
        aria-label="Spotlight categories"
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 pb-px"
      >
        {SPOTLIGHT_CATEGORIES.map((category) => {
          const count = byCategory.get(category.slug)?.length ?? 0;
          const selected = activeSlug === category.slug;
          return (
            <button
              key={category.slug}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`spotlight-panel-${category.slug}`}
              id={`spotlight-tab-${category.slug}`}
              className={tabLinkClass(selected)}
              onClick={() => setActiveSlug(category.slug)}
            >
              {category.title}
              <span
                className={cn(
                  "ml-2 inline-flex rounded px-1.5 py-0.5 align-middle text-[10px] font-semibold",
                  selected
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`spotlight-panel-${activeSlug}`}
        aria-labelledby={`spotlight-tab-${activeSlug}`}
      >
        <SpotlightCategoryPanel
          key={activeSlug}
          category={activeCategory}
          products={activeProducts}
          pending={pending}
          onStatusMessage={setStatusMessage}
          onRefresh={() => router.refresh()}
          onEditProduct={setEditProduct}
          runMutation={(fn) => {
            startTransition(async () => {
              await fn();
            });
          }}
        />
      </div>

      <AdminSpotlightProductEditDialog
        product={editProduct}
        open={editProduct != null}
        onOpenChange={(open) => {
          if (!open) setEditProduct(null);
        }}
        pending={pending}
        onStatusMessage={setStatusMessage}
        onRefresh={() => router.refresh()}
        runMutation={(fn) => {
          startTransition(async () => {
            await fn();
          });
        }}
      />
    </div>
  );
}
