"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ImageIcon, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";

import { AdminSpotlightProductEditDialog } from "@/components/admin/admin-spotlight-product-edit-dialog";
import { AdminSpotlightProductVariantsPanel } from "@/components/admin/admin-spotlight-product-variants-panel";

import {
  adminCreateSpotlightProductAction,
  adminDeleteSpotlightProductAction,
  adminRefreshSpotlightProductImageAction,
} from "@/actions/admin-spotlight-products";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            onStatusMessage(null);
            runMutation(async () => {
              const res = await adminCreateSpotlightProductAction({
                categorySlug: category.slug,
                productUrl: String(fd.get("productUrl") ?? ""),
                label: String(fd.get("label") ?? "") || undefined,
                priceUsd: String(fd.get("priceUsd") ?? "") || undefined,
                productSize: String(fd.get("productSize") ?? "") || undefined,
                productColor: String(fd.get("productColor") ?? "") || undefined,
              });
              onStatusMessage(res.message ?? (res.ok ? "Saved." : "Failed."));
              if (res.ok) {
                form.reset();
                onRefresh();
              }
            });
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`url-${category.slug}`}>Product URL (https)</Label>
            <Input
              id={`url-${category.slug}`}
              name="productUrl"
              required
              type="url"
              placeholder="https://retailer.com/product/…"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`label-${category.slug}`}>
              Label <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={`label-${category.slug}`}
              name="label"
              placeholder="e.g. 128GB USB flash drive"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`price-${category.slug}`}>
              Product cost (USD){" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={`price-${category.slug}`}
              name="priceUsd"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 12.99"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`size-${category.slug}`}>
              Size <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={`size-${category.slug}`}
              name="productSize"
              placeholder="e.g. 128GB, Large"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`color-${category.slug}`}>
              Color <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id={`color-${category.slug}`}
              name="productColor"
              placeholder="e.g. Black, Navy"
              disabled={pending}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ?
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Adding…
                </>
              : "Add product to category"}
            </Button>
          </div>
        </form>

        {products.length === 0 ?
          <p className="text-sm text-muted-foreground">
            No products yet. Add HTTPS product links above—they appear as image
            previews on the home carousel when fetch succeeds.
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
                      onStatusMessage(null);
                      runMutation(async () => {
                        const res = await adminRefreshSpotlightProductImageAction({
                          id: product.id,
                        });
                        onStatusMessage(
                          res.message ?? (res.ok ? "Updated." : "Failed."),
                        );
                        if (res.ok) onRefresh();
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
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Remove this product from the spotlight category?",
                        )
                      ) {
                        return;
                      }
                      onStatusMessage(null);
                      runMutation(async () => {
                        const res = await adminDeleteSpotlightProductAction({
                          id: product.id,
                        });
                        onStatusMessage(
                          res.message ?? (res.ok ? "Removed." : "Failed."),
                        );
                        if (res.ok) onRefresh();
                      });
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Remove
                  </Button>
                </div>
                </div>
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
