"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ImageIcon, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { AdminSpotlightCategoryAddForm } from "@/components/admin/admin-spotlight-category-add-form";
import { AdminSpotlightProductEditDialog } from "@/components/admin/admin-spotlight-product-edit-dialog";

import {
  adminCreateSpotlightCategoryAction,
  adminDeleteSpotlightCategoryAction,
  adminDeleteSpotlightProductAction,
  adminRefreshSpotlightProductImageAction,
  adminSetSpotlightCategoryPublishedAction,
  adminSetSpotlightProductPublishedAction,
} from "@/actions/admin-spotlight-products";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, inputFieldClassName, nativeSelectFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminSpotlightProductRow } from "@/data/spotlight-category-products";
import {
  SPOTLIGHT_CATEGORY_ICON_LABELS,
  SPOTLIGHT_CATEGORY_ICON_NAMES,
  spotlightCategoryIcon,
  type SpotlightCategoryIconName,
  type SpotlightCategoryRecord,
  type SpotlightCategorySlug,
} from "@/lib/spotlight-categories";
import { formatUsd } from "@/lib/admin-markup";
import { displaySiteName, hostnameFromProductUrl } from "@/lib/site-name";
import { cn } from "@/lib/utils";

type AdminSpotlightProductsManagerProps = {
  initialProducts: AdminSpotlightProductRow[];
  categories: SpotlightCategoryRecord[];
};

function SpotlightCategoryPanel({
  category,
  products,
  canDelete,
  pending,
  onStatusMessage,
  onRefresh,
  runMutation,
  onEditProduct,
}: {
  category: SpotlightCategoryRecord;
  products: AdminSpotlightProductRow[];
  canDelete: boolean;
  pending: boolean;
  onStatusMessage: (message: string | null) => void;
  onRefresh: () => void;
  runMutation: (fn: () => Promise<void>) => void;
  onEditProduct: (product: AdminSpotlightProductRow) => void;
}) {
  const Icon = spotlightCategoryIcon(category.iconName);
  const categoryPublished = category.isActive;
  const [removeTarget, setRemoveTarget] = useState<AdminSpotlightProductRow | null>(
    null,
  );
  const [deleteCategoryOpen, setDeleteCategoryOpen] = useState(false);

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
    <Card className="min-w-0">
      <CardHeader className="border-b border-border/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3">
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
                {" · "}
                {products.filter((p) => p.isActive).length} published
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <StatusBadge kind={categoryPublished ? "fullyReceived" : "draft"}>
              {categoryPublished ? "Category published" : "Category unpublished"}
            </StatusBadge>
            <Button
              type="button"
              size="sm"
              variant={categoryPublished ? "outline" : "default"}
              disabled={pending}
              onClick={() => {
                onStatusMessage(null);
                runMutation(async () => {
                  const res = await adminSetSpotlightCategoryPublishedAction({
                    categorySlug: category.slug,
                    published: !categoryPublished,
                  });
                  if (res.ok) {
                    toast.success(res.message);
                    onRefresh();
                  } else {
                    toast.error(res.message);
                    onStatusMessage(res.message);
                  }
                });
              }}
            >
              {categoryPublished ? "Unpublish category" : "Publish category"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={pending || !canDelete}
              title={
                canDelete
                  ? "Delete this category"
                  : "Keep at least one spotlight category"
              }
              onClick={() => setDeleteCategoryOpen(true)}
            >
              Delete category
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-6 pt-6">
        <AdminSpotlightCategoryAddForm
          categorySlug={category.slug}
          pending={pending}
          onRefresh={onRefresh}
          runMutation={runMutation}
        />

        {products.length === 0 ?
          <p className="text-sm text-muted-foreground">
            No products yet. Use Add product to category with SerpApi, then Publish
            a row (and the category) so shoppers see it on Home.
          </p>
        : (
          <div className="min-w-0 space-y-2">
            <p className="text-sm text-muted-foreground">
              Double-click a record to edit. Use Publish on a row to show that
              product to shoppers.
            </p>
            <div className="min-w-0 overflow-x-auto rounded-lg border border-border">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col />
                  <col className="w-[5.75rem]" />
                  <col className="w-[7.25rem]" />
                  <col className="w-[13.75rem]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border bg-muted/80 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Publish</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((product) => {
                    const title =
                      product.label?.trim() ||
                      displaySiteName(null, product.productUrl);
                    const retailer = hostnameFromProductUrl(product.productUrl);
                    const sizeColor = [
                      product.productSize?.trim(),
                      product.productColor?.trim(),
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    const meta = [
                      retailer,
                      sizeColor,
                      product.variants.length > 0
                        ? `${product.variants.length} variant${
                            product.variants.length === 1 ? "" : "s"
                          }`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <tr
                        key={product.id}
                        title="Double-click to edit"
                        className="cursor-pointer bg-card hover:bg-muted/40"
                        onDoubleClick={() => onEditProduct(product)}
                      >
                        <td className="px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="relative size-9 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted">
                              {product.imageUrl ?
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={product.imageUrl}
                                  alt=""
                                  className="size-full object-cover"
                                />
                              : <div className="flex size-full items-center justify-center text-muted-foreground">
                                  <ImageIcon className="size-3.5" aria-hidden />
                                </div>}
                            </div>
                            <div className="min-w-0">
                              <p
                                className="truncate font-medium text-foreground"
                                title={title}
                              >
                                {title}
                              </p>
                              {meta ?
                                <p className="truncate text-xs text-muted-foreground">
                                  {meta}
                                </p>
                              : null}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-foreground">
                          {product.priceUsdCents != null && product.priceUsdCents > 0
                            ? formatUsd(product.priceUsdCents)
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            kind={product.isActive ? "fullyReceived" : "draft"}
                          >
                            {product.isActive ? "Published" : "Unpublished"}
                          </StatusBadge>
                        </td>
                        <td
                          className="whitespace-nowrap px-3 py-2"
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-nowrap items-center justify-end gap-0.5">
                            <Button
                              type="button"
                              size="sm"
                              className="min-w-[5.75rem]"
                              variant={product.isActive ? "outline" : "default"}
                              disabled={pending}
                              onClick={() => {
                                runMutation(async () => {
                                  const res =
                                    await adminSetSpotlightProductPublishedAction({
                                      id: product.id,
                                      published: !product.isActive,
                                    });
                                  if (res.ok) {
                                    toast.success(res.message);
                                    onRefresh();
                                  } else {
                                    toast.error(res.message);
                                    onStatusMessage(res.message);
                                  }
                                });
                              }}
                            >
                              {product.isActive ? "Unpublish" : "Publish"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={pending}
                              title="Edit"
                              aria-label={`Edit ${title}`}
                              onClick={() => onEditProduct(product)}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={pending}
                              title="Refresh image"
                              aria-label={`Refresh image for ${title}`}
                              onClick={() => {
                                runMutation(async () => {
                                  const res =
                                    await adminRefreshSpotlightProductImageAction({
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
                              <RefreshCw />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive"
                              disabled={pending}
                              title="Remove"
                              aria-label={`Remove ${title}`}
                              onClick={() => setRemoveTarget(product)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={deleteCategoryOpen} onOpenChange={setDeleteCategoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {category.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the category from Spotlight and Home
              {products.length > 0
                ? `, and permanently deletes ${products.length} product${
                    products.length === 1 ? "" : "s"
                  } in this group, including variants`
                : ""}
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={<Button type="button" variant="outline" disabled={pending} />}
            >
              Keep category
            </AlertDialogCancel>
            <AlertDialogAction
              render={
                <Button type="button" variant="destructive" disabled={pending} />
              }
              onClick={() => {
                setDeleteCategoryOpen(false);
                onStatusMessage(null);
                runMutation(async () => {
                  const res = await adminDeleteSpotlightCategoryAction({
                    categorySlug: category.slug,
                  });
                  if (res.ok) {
                    toast.success(res.message);
                    onRefresh();
                  } else {
                    toast.error(res.message);
                    onStatusMessage(res.message);
                  }
                });
              }}
            >
              {pending ? "Deleting…" : "Delete category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
  categories,
}: AdminSpotlightProductsManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeSlug, setActiveSlug] = useState<SpotlightCategorySlug>(
    categories[0]?.slug ?? "",
  );
  const [editProduct, setEditProduct] = useState<AdminSpotlightProductRow | null>(
    null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTag, setNewTag] = useState("New");
  const [newIconName, setNewIconName] =
    useState<SpotlightCategoryIconName>("package");

  const editRow =
    initialProducts.find((p) => p.id === editProduct?.id) ?? editProduct;

  useEffect(() => {
    if (categories.some((c) => c.slug === activeSlug)) return;
    setActiveSlug(categories[0]?.slug ?? "");
  }, [categories, activeSlug]);

  const byCategory = useMemo(() => {
    const map = new Map<SpotlightCategorySlug, AdminSpotlightProductRow[]>();
    for (const cat of categories) {
      map.set(cat.slug, []);
    }
    for (const row of initialProducts) {
      const list = map.get(row.categorySlug) ?? [];
      list.push(row);
      map.set(row.categorySlug, list);
    }
    return map;
  }, [categories, initialProducts]);

  const activeCategory =
    categories.find((c) => c.slug === activeSlug) ?? categories[0] ?? null;
  const activeProducts = activeCategory
    ? (byCategory.get(activeCategory.slug) ?? [])
    : [];

  const resetCreateForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewTag("New");
    setNewIconName("package");
  };

  const tabLinkClass = (selected: boolean) =>
    cn(
      "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
      selected
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    );

  const runMutation = (fn: () => Promise<void>) => {
    startTransition(async () => {
      await fn();
    });
  };

  return (
    <div className="space-y-4">
      {statusMessage ?
        <p
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            statusMessage.toLowerCase().includes("could not") ||
              statusMessage.toLowerCase().includes("required")
              ? "border-destructive/40 bg-destructive/10 text-foreground"
              : "border-border bg-muted text-muted-foreground",
          )}
          role="status"
        >
          {statusMessage}
        </p>
      : null}

      <div className="flex items-end gap-2 border-b border-border">
        <div
          role="tablist"
          aria-label="Spotlight categories"
          className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 pb-px"
        >
          {categories.map((category) => {
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
        <Button
          type="button"
          size="sm"
          className="mb-1.5 shrink-0"
          disabled={pending}
          onClick={() => setCreateOpen(true)}
        >
          <Plus data-icon="inline-start" />
          New category
        </Button>
      </div>

      {activeCategory ?
        <div
          role="tabpanel"
          id={`spotlight-panel-${activeCategory.slug}`}
          aria-labelledby={`spotlight-tab-${activeCategory.slug}`}
        >
          <SpotlightCategoryPanel
            key={activeCategory.slug}
            category={activeCategory}
            products={activeProducts}
            canDelete={categories.length > 1}
            pending={pending}
            onStatusMessage={setStatusMessage}
            onRefresh={() => router.refresh()}
            onEditProduct={setEditProduct}
            runMutation={runMutation}
          />
        </div>
      : (
        <p className="rounded-lg border border-border bg-muted px-4 py-6 text-sm text-muted-foreground">
          No spotlight categories yet. Create one to start adding products.
        </p>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New spotlight category</DialogTitle>
            <DialogDescription>
              Categories appear as Home carousel slides once you publish them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="spotlight-new-category-title">Name</Label>
              <Input
                id="spotlight-new-category-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Outdoor & sports"
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spotlight-new-category-description">
                Description
              </Label>
              <textarea
                id="spotlight-new-category-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Short copy shown on the Home carousel slide."
                maxLength={240}
                rows={3}
                className={cn(inputFieldClassName, "min-h-20 py-2 text-sm")}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="spotlight-new-category-tag">Tag</Label>
                <Input
                  id="spotlight-new-category-tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="New"
                  maxLength={32}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spotlight-new-category-icon">Icon</Label>
                <select
                  id="spotlight-new-category-icon"
                  value={newIconName}
                  onChange={(e) =>
                    setNewIconName(e.target.value as SpotlightCategoryIconName)
                  }
                  className={nativeSelectFieldClassName}
                >
                  {SPOTLIGHT_CATEGORY_ICON_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {SPOTLIGHT_CATEGORY_ICON_LABELS[name]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setCreateOpen(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                setStatusMessage(null);
                runMutation(async () => {
                  const res = await adminCreateSpotlightCategoryAction({
                    title: newTitle,
                    description: newDescription,
                    tag: newTag,
                    iconName: newIconName,
                  });
                  if (res.ok) {
                    toast.success(res.message);
                    if (res.categorySlug) setActiveSlug(res.categorySlug);
                    setCreateOpen(false);
                    resetCreateForm();
                    router.refresh();
                  } else {
                    toast.error(res.message);
                    setStatusMessage(res.message);
                  }
                });
              }}
            >
              {pending ? "Creating…" : "Create category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminSpotlightProductEditDialog
        product={editRow}
        open={editProduct != null}
        onOpenChange={(open) => {
          if (!open) setEditProduct(null);
        }}
        pending={pending}
        onStatusMessage={setStatusMessage}
        onRefresh={() => router.refresh()}
        runMutation={runMutation}
      />
    </div>
  );
}

