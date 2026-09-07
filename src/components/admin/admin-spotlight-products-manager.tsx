"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  AdminNestedFindOrganizePanel,
  type AdminNestedFindOrganizePageSize,
} from "@/components/admin/admin-nested-find-organize-panel";
import { AdminSpotlightCategoryAddForm } from "@/components/admin/admin-spotlight-category-add-form";
import { AdminSpotlightProductEditDialog } from "@/components/admin/admin-spotlight-product-edit-dialog";
import { SortableThCompact } from "@/components/sortable-th";

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
import { Field, FieldContent } from "@/components/ui/field";
import { FieldLabelWithHelp } from "@/components/ui/field-label-with-help";
import { Input, inputFieldClassName, nativeSelectFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compareLocale, compareNum, nextSortState, type SortDir } from "@/lib/table-sort";
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
import { spotlightRetailerDriftSummary } from "@/lib/spotlight/spotlight-retailer-live-check";
import { cn } from "@/lib/utils";

type AdminSpotlightProductsManagerProps = {
  initialProducts: AdminSpotlightProductRow[];
  categories: SpotlightCategoryRecord[];
};

function hasRetailerDrift(product: AdminSpotlightProductRow): boolean {
  return Boolean(product.retailerDriftFields && product.retailerDriftFields.length > 0);
}

type SpotlightProductSortKey =
  | "newest"
  | "product"
  | "retailer"
  | "price"
  | "status";

type SpotlightStatusFilter = "all" | "published" | "unpublished" | "drift";

function spotlightProductTitle(product: AdminSpotlightProductRow): string {
  return product.label?.trim() || displaySiteName(null, product.productUrl);
}

function spotlightProductRetailer(product: AdminSpotlightProductRow): string {
  return hostnameFromProductUrl(product.productUrl) ?? "";
}

function spotlightProductSearchHaystack(product: AdminSpotlightProductRow): string {
  const sizeColor = [
    product.productSize?.trim(),
    product.productColor?.trim(),
  ]
    .filter(Boolean)
    .join(" ");
  return [
    spotlightProductTitle(product),
    spotlightProductRetailer(product),
    product.productUrl,
    sizeColor,
    product.isActive ? "published" : "unpublished",
    hasRetailerDrift(product) ? "check retailer drift" : "",
    product.id,
    product.variants.length > 0
      ? `${product.variants.length} variant${product.variants.length === 1 ? "" : "s"}`
      : "",
  ]
    .join(" ")
    .toLowerCase();
}

function compareSpotlightProducts(
  a: AdminSpotlightProductRow,
  b: AdminSpotlightProductRow,
  sortKey: SpotlightProductSortKey,
  sortDir: SortDir,
): number {
  switch (sortKey) {
    case "product":
      return compareLocale(
        spotlightProductTitle(a),
        spotlightProductTitle(b),
        sortDir,
      );
    case "retailer":
      return compareLocale(
        spotlightProductRetailer(a),
        spotlightProductRetailer(b),
        sortDir,
      );
    case "price":
      return compareNum(
        a.priceUsdCents ?? 0,
        b.priceUsdCents ?? 0,
        sortDir,
      );
    case "status": {
      const rank = (product: AdminSpotlightProductRow) => {
        if (hasRetailerDrift(product)) return 2;
        return product.isActive ? 1 : 0;
      };
      const byStatus = compareNum(rank(a), rank(b), sortDir);
      if (byStatus !== 0) return byStatus;
      return compareLocale(
        spotlightProductTitle(a),
        spotlightProductTitle(b),
        "asc",
      );
    }
    case "newest":
    default:
      return compareNum(
        new Date(a.createdAt).getTime(),
        new Date(b.createdAt).getTime(),
        sortDir,
      );
  }
}

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
  const [findOrganizeVisible, setFindOrganizeVisible] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] =
    useState<AdminNestedFindOrganizePageSize>(25);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SpotlightProductSortKey>("newest");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] =
    useState<SpotlightStatusFilter>("all");
  const [retailerFilter, setRetailerFilter] = useState("all");

  const retailerOptions = useMemo(() => {
    const names = new Set<string>();
    for (const product of products) {
      const retailer = spotlightProductRetailer(product);
      if (retailer) names.add(retailer);
    }
    return [...names].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [products]);

  useEffect(() => {
    if (retailerFilter !== "all" && !retailerOptions.includes(retailerFilter)) {
      setRetailerFilter("all");
    }
  }, [retailerFilter, retailerOptions]);

  const filteredSorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = products.filter((product) => {
      if (statusFilter === "published" && !product.isActive) return false;
      if (statusFilter === "unpublished" && product.isActive) return false;
      if (statusFilter === "drift" && !hasRetailerDrift(product)) return false;
      if (
        retailerFilter !== "all" &&
        spotlightProductRetailer(product) !== retailerFilter
      ) {
        return false;
      }
      if (query && !spotlightProductSearchHaystack(product).includes(query)) {
        return false;
      }
      return true;
    });
    return [...rows].sort((a, b) =>
      compareSpotlightProducts(a, b, sortKey, sortDir),
    );
  }, [products, search, statusFilter, retailerFilter, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, sortKey, sortDir, statusFilter, retailerFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const sliceStart = (pageSafe - 1) * pageSize;
  const pageSlice = filteredSorted.slice(sliceStart, sliceStart + pageSize);
  const showFrom = filteredSorted.length === 0 ? 0 : sliceStart + 1;
  const showTo = Math.min(sliceStart + pageSize, filteredSorted.length);

  const cycleSort = (key: SpotlightProductSortKey) => {
    const next = nextSortState(sortKey, sortDir, key);
    setSortKey(next.key);
    setSortDir(next.dir);
  };

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
          <div className="min-w-0 space-y-3">
            <p className="text-sm text-muted-foreground">
              Double-click a record to edit. Use Publish on a row to show that
              product to shoppers. Click column headers to sort, including by
              retailer.
            </p>
            <AdminNestedFindOrganizePanel
              switchId={`spotlight-${category.slug}-find`}
              searchInputId={`spotlight-${category.slug}-search`}
              pageSizeSelectId={`spotlight-${category.slug}-page-size`}
              visible={findOrganizeVisible}
              onVisibleChange={setFindOrganizeVisible}
              search={search}
              onSearchChange={setSearch}
              searchLabel="Search products"
              searchPlaceholder="Product, retailer, URL, status…"
              searchDescription="Filters this category only. Column headers below sort the filtered list, including retailer."
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              pageSizeLabel="Rows per page"
              showFrom={showFrom}
              showTo={showTo}
              totalCount={filteredSorted.length}
              totalLoaded={products.length}
              totalLoadedLabel="in this category"
              itemLabel="product"
              emptyMessage={
                statusFilter !== "all" || retailerFilter !== "all"
                  ? "No products match the current search or filters."
                  : "No products in this category."
              }
              noMatchMessage="No products match the current search or filters."
              className="mb-0"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field className="gap-1.5">
                <FieldLabelWithHelp
                  htmlFor={`spotlight-${category.slug}-status`}
                  label="Status"
                  help="Show all products, only published or unpublished rows, or listings that need a retailer check."
                  helpLabel="About Status"
                />
                <FieldContent>
                  <select
                    id={`spotlight-${category.slug}-status`}
                    className={nativeSelectFieldClassName}
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as SpotlightStatusFilter)
                    }
                  >
                    <option value="all">All statuses</option>
                    <option value="published">Published</option>
                    <option value="unpublished">Unpublished</option>
                    <option value="drift">Check retailer</option>
                  </select>
                </FieldContent>
              </Field>
              <Field className="gap-1.5">
                <FieldLabelWithHelp
                  htmlFor={`spotlight-${category.slug}-retailer`}
                  label="Retailer"
                  help="Limit the table to one store hostname, or keep All retailers and sort the Retailer column instead."
                  helpLabel="About Retailer"
                />
                <FieldContent>
                  <select
                    id={`spotlight-${category.slug}-retailer`}
                    className={nativeSelectFieldClassName}
                    value={retailerFilter}
                    onChange={(e) => setRetailerFilter(e.target.value)}
                  >
                    <option value="all">All retailers</option>
                    {retailerOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </FieldContent>
              </Field>
            </div>
            <div className="min-w-0 overflow-x-auto rounded-lg border border-border">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col />
                  <col className="w-[8.5rem]" />
                  <col className="w-[5.75rem]" />
                  <col className="w-[7.25rem]" />
                  <col className="w-[13.75rem]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border bg-muted/80 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <SortableThCompact
                      label="Product"
                      columnId={`spotlight-${category.slug}-product`}
                      active={sortKey === "product"}
                      dir={sortDir}
                      onSort={() => cycleSort("product")}
                    />
                    <SortableThCompact
                      label="Retailer"
                      columnId={`spotlight-${category.slug}-retailer`}
                      active={sortKey === "retailer"}
                      dir={sortDir}
                      onSort={() => cycleSort("retailer")}
                    />
                    <SortableThCompact
                      label="Price"
                      columnId={`spotlight-${category.slug}-price`}
                      active={sortKey === "price"}
                      dir={sortDir}
                      onSort={() => cycleSort("price")}
                      numeric
                    />
                    <SortableThCompact
                      label="Status"
                      columnId={`spotlight-${category.slug}-status`}
                      active={sortKey === "status"}
                      dir={sortDir}
                      onSort={() => cycleSort("status")}
                    />
                    <th className="px-3 py-2 text-right font-medium">Publish</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageSlice.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-8 text-center text-sm text-muted-foreground"
                      >
                        No products match the current search or filters.
                      </td>
                    </tr>
                  ) : null}
                  {pageSlice.map((product) => {
                    const title = spotlightProductTitle(product);
                    const retailer = spotlightProductRetailer(product);
                    const extraOptionLabels = [
                      ...new Set(
                        product.variants
                          .map(
                            (variant) =>
                              variant.packLabel?.trim() ||
                              variant.productSize?.trim() ||
                              "",
                          )
                          .filter(
                            (label) =>
                              Boolean(label) &&
                              label !== product.productSize?.trim(),
                          ),
                      ),
                    ];
                    const sizeColor = [
                      product.productSize?.trim(),
                      product.productColor?.trim(),
                      ...extraOptionLabels,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    const meta = [
                      sizeColor,
                      product.variants.length > 0
                        ? `${product.variants.length} variant${
                            product.variants.length === 1 ? "" : "s"
                          }`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    const drift = hasRetailerDrift(product);
                    const driftTitle =
                      spotlightRetailerDriftSummary(product.retailerDriftFields) ??
                      product.retailerCheckError;
                    return (
                      <tr
                        key={product.id}
                        title={
                          driftTitle ?
                            `${driftTitle} Double-click to edit.`
                          : "Double-click to edit"
                        }
                        className={cn(
                          "cursor-pointer bg-card hover:bg-muted/40",
                          drift &&
                            "bg-amber-500/15 ring-1 ring-inset ring-amber-500/40 hover:bg-amber-500/25",
                        )}
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
                              {drift ?
                                <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                                  <TriangleAlert className="size-3 shrink-0" aria-hidden />
                                  Check retailer listing
                                </p>
                              : null}
                              {meta ?
                                <p className="truncate text-xs text-muted-foreground">
                                  {meta}
                                </p>
                              : null}
                            </div>
                          </div>
                        </td>
                        <td
                          className="truncate px-3 py-2 text-xs text-muted-foreground"
                          title={retailer || undefined}
                        >
                          {retailer || "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-foreground">
                          {product.priceUsdCents != null && product.priceUsdCents > 0
                            ? formatUsd(product.priceUsdCents)
                            : "—"}
                          {drift &&
                          product.retailerDriftFields?.includes("price") &&
                          product.retailerLivePriceUsdCents != null &&
                          product.retailerLivePriceUsdCents > 0 ?
                            <span className="mt-0.5 block text-[11px] font-medium text-amber-800 dark:text-amber-200">
                              Live {formatUsd(product.retailerLivePriceUsdCents)}
                            </span>
                          : null}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge
                              kind={product.isActive ? "fullyReceived" : "draft"}
                            >
                              {product.isActive ? "Published" : "Unpublished"}
                            </StatusBadge>
                            {drift ?
                              <StatusBadge
                                kind="spotlightRetailerDrift"
                                title={driftTitle ?? undefined}
                              >
                                Check retailer
                              </StatusBadge>
                            : null}
                          </div>
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
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pageSafe <= 1}
                onClick={() => setPage(Math.max(1, pageSafe - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                Page {pageSafe} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pageSafe >= totalPages}
                onClick={() =>
                  setPage(Math.min(totalPages, pageSafe + 1))
                }
                aria-label="Next page"
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
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
    for (const list of map.values()) {
      list.sort((a, b) => {
        const tb = Date.parse(b.createdAt);
        const ta = Date.parse(a.createdAt);
        if (tb !== ta) return tb - ta;
        return b.id.localeCompare(a.id);
      });
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

