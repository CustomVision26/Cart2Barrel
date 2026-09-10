"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Store,
} from "lucide-react";
import { toast } from "sonner";

import {
  adminResolveSpotlightProductAction,
  adminSaveSpotlightProductOfferAction,
  adminSaveSpotlightVariantOfferAction,
  adminSaveSpotlightVariantOffersAction,
  type AdminResolveSpotlightProductResult,
} from "@/actions/admin-spotlight-product-resolve";
import {
  AdminNestedFindOrganizePanel,
  type AdminNestedFindOrganizePageSize,
} from "@/components/admin/admin-nested-find-organize-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsd } from "@/lib/admin-markup";
import { appTableVariantRowCurrent } from "@/lib/app-table-surfaces";
import type { SpotlightCategorySlug } from "@/lib/spotlight-categories";
import { usableRetailerProductImageUrl } from "@/lib/product-variants/variant-images";
import { cn } from "@/lib/utils";

type ResolvedState = Extract<AdminResolveSpotlightProductResult, { ok: true }>;
type SpotlightLookupVariant = ResolvedState["variants"][number];
type SpotlightLookupTab = "variants" | "compare";

function lookupTabClass(selected: boolean) {
  return cn(
    "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    selected
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );
}

function variantLookupHaystack(row: SpotlightLookupVariant): string {
  return [
    row.label,
    row.size ?? "",
    row.color ?? "",
    row.packLabel ?? "",
    row.priceUsdCents != null ? centsToUsdField(row.priceUsdCents) : "",
    row.isCurrent ? "current" : "",
  ]
    .join(" ")
    .toLowerCase();
}

type AdminSpotlightCategoryAddFormProps = {
  categorySlug: SpotlightCategorySlug;
  pending: boolean;
  onRefresh: () => void;
  runMutation: (fn: () => Promise<void>) => void;
};

function centsToUsdField(cents: number | null): string {
  if (cents == null || cents <= 0) return "";
  return (cents / 100).toFixed(2);
}

function OfferThumb({
  src,
  fallback = null,
}: {
  src: string | null;
  fallback?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const url =
    (!failed ? usableRetailerProductImageUrl(src) : null) ??
    usableRetailerProductImageUrl(fallback);

  useEffect(() => {
    setFailed(false);
  }, [src, fallback]);

  if (!url) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded border border-border bg-muted text-muted-foreground">
        <ImageIcon className="size-4" aria-hidden />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="size-10 shrink-0 rounded border border-border object-cover"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function variantSavePayload(
  variant: SpotlightLookupVariant,
  listingImageUrl: string | null,
) {
  return {
    label: variant.label,
    priceUsd: centsToUsdField(variant.priceUsdCents),
    productSize: variant.size ?? undefined,
    productColor: variant.color ?? undefined,
    packLabel: variant.packLabel ?? undefined,
    productUrl: variant.productUrl ?? undefined,
    imageUrl:
      usableRetailerProductImageUrl(variant.imageUrl) ??
      usableRetailerProductImageUrl(listingImageUrl) ??
      undefined,
  };
}

type SpotlightListingFields = {
  productUrl: string;
  productName: string;
  priceUsd: string;
  productSize: string;
  productColor: string;
  imageUrl: string | null;
};

function listingFieldsFromVariant(
  variant: SpotlightLookupVariant,
  fallbackUrl: string,
  fallbackName: string,
  listingImageUrl: string | null,
): SpotlightListingFields {
  return {
    productUrl: variant.productUrl?.trim() || fallbackUrl,
    productName:
      variant.productTitle?.trim() || fallbackName.trim() || variant.label,
    priceUsd: centsToUsdField(variant.priceUsdCents),
    productSize: variant.size?.trim() || variant.packLabel?.trim() || "",
    productColor: variant.color?.trim() || "",
    imageUrl:
      usableRetailerProductImageUrl(variant.imageUrl) ??
      usableRetailerProductImageUrl(listingImageUrl),
  };
}

export function AdminSpotlightCategoryAddForm({
  categorySlug,
  pending,
  onRefresh,
  runMutation,
}: AdminSpotlightCategoryAddFormProps) {
  const [lookupPending, startLookup] = useTransition();
  const [resolved, setResolved] = useState<ResolvedState | null>(null);
  const [lookupTab, setLookupTab] = useState<SpotlightLookupTab>("variants");
  const [appliedVariantId, setAppliedVariantId] = useState<string | null>(null);

  const [productUrl, setProductUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [productSize, setProductSize] = useState("");
  const [productColor, setProductColor] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [savedParentId, setSavedParentId] = useState<string | null>(null);
  const [savedVariantIds, setSavedVariantIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [savedRetailerIds, setSavedRetailerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [variantFindVisible, setVariantFindVisible] = useState(true);
  const [variantSearch, setVariantSearch] = useState("");
  const [variantPageSize, setVariantPageSize] =
    useState<AdminNestedFindOrganizePageSize>(10);
  const [variantPage, setVariantPage] = useState(1);

  const busy = pending || lookupPending;
  const unsavedVariants =
    resolved?.variants.filter((row) => !savedVariantIds.has(row.id)) ?? [];

  const filteredVariants = useMemo(() => {
    const rows = resolved?.variants ?? [];
    const query = variantSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => variantLookupHaystack(row).includes(query));
  }, [resolved?.variants, variantSearch]);

  useEffect(() => {
    setVariantPage(1);
  }, [variantSearch, variantPageSize, resolved?.variants]);

  const variantTotalPages = Math.max(
    1,
    Math.ceil(filteredVariants.length / variantPageSize),
  );
  const variantPageSafe = Math.min(Math.max(1, variantPage), variantTotalPages);
  const variantSliceStart = (variantPageSafe - 1) * variantPageSize;
  const variantPageSlice = filteredVariants.slice(
    variantSliceStart,
    variantSliceStart + variantPageSize,
  );
  const variantShowFrom =
    filteredVariants.length === 0 ? 0 : variantSliceStart + 1;
  const variantShowTo = Math.min(
    variantSliceStart + variantPageSize,
    filteredVariants.length,
  );

  const resetForm = () => {
    setProductUrl("");
    setProductName("");
    setPriceUsd("");
    setProductSize("");
    setProductColor("");
    setImageUrl(null);
    setResolved(null);
    setAppliedVariantId(null);
    setSavedParentId(null);
    setSavedVariantIds(new Set());
    setSavedRetailerIds(new Set());
    setLookupTab("variants");
    setVariantSearch("");
    setVariantPage(1);
    toast.message("Form cleared — ready for a new product.");
  };

  const handleLookup = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("Enter a product URL first.");
      return;
    }
    startLookup(async () => {
      const res = await adminResolveSpotlightProductAction({
        productUrl: trimmed,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setResolved(res);
      setProductUrl(res.primary.productUrl);
      setProductName(res.primary.productName);
      setPriceUsd(res.primary.priceUsd);
      setProductSize(res.primary.productSize);
      setProductColor(res.primary.productColor);
      setImageUrl(res.primary.imageUrl);
      setAppliedVariantId(
        res.variants.find((row) => row.isCurrent)?.id ?? null,
      );
      setSavedParentId(null);
      setSavedVariantIds(new Set());
      setSavedRetailerIds(new Set());
      setLookupTab("variants");
      setVariantSearch("");
      setVariantPage(1);
      const parts = [
        `Loaded from SerpApi (${res.variantRetailer}).`,
        res.variants.length > 0
          ? `${res.variants.length} variant${res.variants.length === 1 ? "" : "s"}.`
          : "No store variants returned.",
        res.compareOffers.length > 0
          ? `${res.compareOffers.length} retailer offer${res.compareOffers.length === 1 ? "" : "s"}.`
          : null,
        res.compareMessage ? `Compare: ${res.compareMessage}` : null,
      ].filter(Boolean);
      const compareLimited = /429|rate limit/i.test(res.compareMessage ?? "");
      if (compareLimited) {
        toast.warning(parts.join(" "));
      } else {
        toast.success(parts.join(" "));
      }
    });
  };

  const applyListingToForm = (
    listing: SpotlightListingFields,
    variantId: string | null,
  ) => {
    setProductUrl(listing.productUrl);
    setProductName(listing.productName);
    setPriceUsd(listing.priceUsd);
    setProductSize(listing.productSize);
    setProductColor(listing.productColor);
    setImageUrl(listing.imageUrl);
    if (variantId) setAppliedVariantId(variantId);
  };

  const applyVariant = (variant: SpotlightLookupVariant) => {
    applyListingToForm(
      listingFieldsFromVariant(
        variant,
        productUrl,
        productName || resolved?.primary.productName || "",
        imageUrl ?? resolved?.primary.imageUrl ?? null,
      ),
      variant.id,
    );
    toast.success("Form filled from this variant.", {
      id: "spotlight-variant-applied",
    });
  };

  const persistPrimary = async (
    listing?: SpotlightListingFields,
  ): Promise<string | null> => {
    if (savedParentId) return savedParentId;
    const fields = listing ?? {
      productUrl: productUrl.trim(),
      productName: productName.trim(),
      priceUsd: priceUsd.trim(),
      productSize: productSize.trim(),
      productColor: productColor.trim(),
      imageUrl,
    };
    if (!fields.productUrl) {
      toast.error("Product URL is required.");
      return null;
    }
    const res = await adminSaveSpotlightProductOfferAction({
      categorySlug,
      productUrl: fields.productUrl,
      label: fields.productName || undefined,
      priceUsd: fields.priceUsd || undefined,
      productSize: fields.productSize || undefined,
      productColor: fields.productColor || undefined,
      imageUrl: fields.imageUrl?.trim() || undefined,
    });
    if (!res.ok) {
      toast.error(res.message);
      return null;
    }
    setSavedParentId(res.parentProductId);
    return res.parentProductId;
  };

  const savePrimary = () => {
    if (savedParentId) {
      toast.message("This product is already saved. Use Reset to add another.");
      return;
    }
    runMutation(async () => {
      const parentId = await persistPrimary();
      if (!parentId) return;
      toast.success("Product added to category.");
      onRefresh();
    });
  };

  const saveVariant = (variant: SpotlightLookupVariant) => {
    runMutation(async () => {
      const creatingListing = savedParentId == null;
      const listing = listingFieldsFromVariant(
        variant,
        productUrl.trim(),
        productName.trim() || resolved?.primary.productName || "",
        imageUrl ?? resolved?.primary.imageUrl ?? null,
      );
      const parentId = await persistPrimary(
        creatingListing ? listing : undefined,
      );
      if (!parentId) return;
      const res = await adminSaveSpotlightVariantOfferAction({
        parentProductId: parentId,
        ...variantSavePayload(variant, imageUrl ?? resolved?.primary.imageUrl ?? null),
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      if (creatingListing) {
        applyListingToForm(listing, variant.id);
      }
      setSavedVariantIds((prev) => new Set(prev).add(variant.id));
      toast.success(
        creatingListing
          ? `${variant.label} saved as the spotlight listing.`
          : (res.message ?? "Variant saved."),
      );
      onRefresh();
    });
  };

  const saveAllVariants = () => {
    if (!resolved || unsavedVariants.length === 0) {
      toast.error("No unsaved variants to save.");
      return;
    }
    runMutation(async () => {
      const parentId = await persistPrimary();
      if (!parentId) return;
      const res = await adminSaveSpotlightVariantOffersAction({
        parentProductId: parentId,
        variants: unsavedVariants.map((row) => ({
          id: row.id,
          ...variantSavePayload(row, imageUrl ?? resolved.primary.imageUrl),
        })),
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setSavedVariantIds((prev) => {
        const next = new Set(prev);
        for (const row of unsavedVariants) next.add(row.id);
        return next;
      });
      toast.success(res.message ?? "Variants saved.");
      onRefresh();
    });
  };

  const saveRetailerOffer = (offer: ResolvedState["compareOffers"][number]) => {
    runMutation(async () => {
      const res = await adminSaveSpotlightProductOfferAction({
        categorySlug,
        productUrl: offer.productUrl,
        label: offer.title,
        priceUsd: centsToUsdField(offer.priceUsdCents),
        imageUrl: offer.imageUrl ?? undefined,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setSavedRetailerIds((prev) => new Set(prev).add(offer.id));
      toast.success(`${offer.retailer}: saved as spotlight product.`);
      onRefresh();
    });
  };

  return (
    <div className="space-y-4">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          savePrimary();
        }}
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`url-${categorySlug}`}>Product URL (https)</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id={`url-${categorySlug}`}
              name="productUrl"
              required
              type="url"
              placeholder="https://retailer.com/product/…"
              disabled={busy}
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              disabled={busy || !productUrl.trim()}
              onClick={() => handleLookup(productUrl)}
            >
              {lookupPending ?
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Running SerpApi…
                </>
              : <>
                  <Sparkles className="size-4" aria-hidden />
                  Run SerpApi lookup
                </>
              }
            </Button>
          </div>
        </div>

        {resolved ?
          <div className="sm:col-span-2">
            <div className="rounded-lg border border-border">
              <div className="flex flex-wrap items-end justify-between gap-2 px-2 pt-1">
                <div
                  role="tablist"
                  aria-label="SerpApi lookup results"
                  className="flex min-w-0 flex-1 flex-wrap gap-1"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={lookupTab === "variants"}
                    className={lookupTabClass(lookupTab === "variants")}
                    onClick={() => setLookupTab("variants")}
                  >
                    Store variants (SerpApi)
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {resolved.variants.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={lookupTab === "compare"}
                    className={lookupTabClass(lookupTab === "compare")}
                    onClick={() => setLookupTab("compare")}
                  >
                    <Store className="size-3.5 shrink-0" aria-hidden />
                    Retailer comparison (SerpApi + AI verify)
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {resolved.compareOffers.length}
                    </span>
                  </button>
                </div>
                {lookupTab === "variants" && resolved.variants.length > 0 ?
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mb-1.5 mr-1"
                    disabled={busy || unsavedVariants.length === 0}
                    onClick={saveAllVariants}
                  >
                    {unsavedVariants.length === 0 ?
                      "All variants saved"
                    : `Save all variants (${unsavedVariants.length})`}
                  </Button>
                : null}
              </div>

              {lookupTab === "variants" ?
                resolved.variants.length > 0 ?
                  <div className="border-t border-border">
                    <AdminNestedFindOrganizePanel
                      switchId={`spotlight-lookup-${categorySlug}-variant-find`}
                      searchInputId={`spotlight-lookup-${categorySlug}-variant-search`}
                      pageSizeSelectId={`spotlight-lookup-${categorySlug}-variant-page-size`}
                      visible={variantFindVisible}
                      onVisibleChange={setVariantFindVisible}
                      search={variantSearch}
                      onSearchChange={setVariantSearch}
                      searchLabel="Search variants"
                      searchPlaceholder="Size, color, name, price…"
                      searchDescription="Filters this SerpApi variant list only. Save all variants still saves every unsaved SKU."
                      pageSize={variantPageSize}
                      onPageSizeChange={setVariantPageSize}
                      pageSizeLabel="Rows per page"
                      pageSizeDescription="Paginates the store variants shown in this table."
                      showFrom={variantShowFrom}
                      showTo={variantShowTo}
                      totalCount={filteredVariants.length}
                      totalLoaded={resolved.variants.length}
                      totalLoadedLabel="from SerpApi"
                      itemLabel="variant"
                      emptyMessage="No store variants."
                      noMatchMessage="No variants match the current search."
                      className="m-3 mb-0"
                    />
                    <div className="overflow-x-auto border-t border-border">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-muted text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Image</th>
                          <th className="px-3 py-2 font-medium">Variant</th>
                          <th className="px-3 py-2 font-medium">Price</th>
                          <th className="w-24 px-3 py-2 font-medium">Apply</th>
                          <th className="w-24 px-3 py-2 font-medium">Save</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {variantPageSlice.length === 0 ?
                          <tr>
                            <td
                              colSpan={5}
                              className="px-3 py-8 text-center text-sm text-muted-foreground"
                            >
                              No variants match the current search.
                            </td>
                          </tr>
                        : variantPageSlice.map((row) => {
                          const saved = savedVariantIds.has(row.id);
                          const applied = appliedVariantId === row.id;
                          return (
                            <tr
                              key={row.id}
                              className={cn(
                                "hover:bg-muted",
                                applied && appTableVariantRowCurrent,
                              )}
                            >
                              <td className="px-3 py-2">
                                <OfferThumb
                                  src={row.imageUrl}
                                  fallback={
                                    imageUrl ?? resolved.primary.imageUrl
                                  }
                                />
                              </td>
                              <td className="px-3 py-2">
                                <p className="font-medium text-foreground">
                                  {row.label}
                                  {row.isCurrent ?
                                    <span className="ml-1 text-xs text-primary">
                                      (current)
                                    </span>
                                  : null}
                                  {applied ?
                                    <span className="ml-1 text-xs text-primary">
                                      (applied)
                                    </span>
                                  : null}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {[row.color, row.size, row.packLabel]
                                    .filter(Boolean)
                                    .join(" · ") || "—"}
                                </p>
                                {resolved.variantMethod ?
                                  <p className="text-[10px] text-muted-foreground">
                                    {resolved.variantMethod}
                                  </p>
                                : null}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2">
                                {row.priceUsdCents != null &&
                                row.priceUsdCents > 0
                                  ? formatUsd(row.priceUsdCents)
                                  : "—"}
                              </td>
                              <td className="px-3 py-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={applied ? "secondary" : "outline"}
                                  disabled={busy}
                                  onClick={() => applyVariant(row)}
                                >
                                  {applied ? "Applied" : "Apply"}
                                </Button>
                              </td>
                              <td className="px-3 py-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={saved ? "secondary" : "default"}
                                  disabled={busy || saved}
                                  onClick={() => saveVariant(row)}
                                >
                                  {saved ? "Saved" : "Save"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                    <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={variantPageSafe <= 1}
                        onClick={() =>
                          setVariantPage(Math.max(1, variantPageSafe - 1))
                        }
                        aria-label="Previous variants page"
                      >
                        <ChevronLeft className="size-4" />
                        Previous
                      </Button>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        Page {variantPageSafe} of {variantTotalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={variantPageSafe >= variantTotalPages}
                        onClick={() =>
                          setVariantPage(
                            Math.min(variantTotalPages, variantPageSafe + 1),
                          )
                        }
                        aria-label="Next variants page"
                      >
                        Next
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                : <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                    SerpApi did not return store variants for this URL. Paste a
                    full product page: Amazon /dp/ plus a 10-character ASIN,
                    Walmart /ip/ plus the numeric item ID, Target /p/…/-/A-…, or
                    eBay /itm/—not a truncated, search, or brand store page. You
                    can still fill the fields below and add the product.
                  </p>
              : resolved.compareOffers.length > 0 ?
                <div className="overflow-x-auto border-t border-border">
                  {resolved.compareSearchQuery ?
                    <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
                      Search: “{resolved.compareSearchQuery}”
                    </p>
                  : null}
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-muted text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Retailer</th>
                        <th className="px-3 py-2 font-medium">Title</th>
                        <th className="px-3 py-2 font-medium">Price</th>
                        <th className="px-3 py-2 font-medium">Image</th>
                        <th className="w-36 px-3 py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {resolved.compareOffers.map((offer) => {
                        const saved = savedRetailerIds.has(offer.id);
                        return (
                          <tr key={offer.id} className="hover:bg-muted">
                            <td className="px-3 py-2">
                              <p className="font-medium">{offer.retailer}</p>
                              {offer.isOriginal ?
                                <span className="text-xs text-primary">Original</span>
                              : offer.aiVerified && offer.matchConfidence != null ?
                                <span className="text-xs text-muted-foreground">
                                  Verified {Math.round(offer.matchConfidence * 100)}%
                                </span>
                              : (
                                <span className="text-xs text-amber-700 dark:text-amber-300">
                                  Across the web
                                </span>
                              )}
                            </td>
                            <td className="max-w-[200px] px-3 py-2">
                              <p className="line-clamp-2 text-foreground">{offer.title}</p>
                              <a
                                href={offer.productUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                Link
                              </a>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2">
                              {offer.priceUsdCents != null && offer.priceUsdCents > 0
                                ? formatUsd(offer.priceUsdCents)
                                : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <OfferThumb src={offer.imageUrl} />
                            </td>
                            <td className="px-3 py-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={saved ? "secondary" : "default"}
                                disabled={busy || saved}
                                onClick={() => saveRetailerOffer(offer)}
                              >
                                {saved ? "Saved" : "Save to spotlight"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              : <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                  {resolved.compareMessage ??
                    "No verified retailer offers for this product."}
                </p>}
            </div>
          </div>
        : null}

        {imageUrl ?
          <div className="flex items-start gap-3 sm:col-span-2">
            <OfferThumb src={imageUrl} />
            <p className="text-xs text-muted-foreground">
              Preview image from SerpApi — included when you save to spotlight.
            </p>
          </div>
        : null}

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`name-${categorySlug}`}>Product name</Label>
          <Input
            id={`name-${categorySlug}`}
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Filled from SerpApi after lookup"
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`price-${categorySlug}`}>Product cost (USD)</Label>
          <Input
            id={`price-${categorySlug}`}
            type="text"
            inputMode="decimal"
            value={priceUsd}
            onChange={(e) => setPriceUsd(e.target.value)}
            placeholder="e.g. 12.99"
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`size-${categorySlug}`}>Size</Label>
          <Input
            id={`size-${categorySlug}`}
            value={productSize}
            onChange={(e) => setProductSize(e.target.value)}
            placeholder="e.g. 128GB, Large"
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`color-${categorySlug}`}>Color</Label>
          <Input
            id={`color-${categorySlug}`}
            value={productColor}
            onChange={(e) => setProductColor(e.target.value)}
            placeholder="e.g. Black, Navy"
            disabled={busy}
          />
        </div>

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy || !productUrl.trim()}>
            {pending && !lookupPending ?
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving…
              </>
            : <>
                <Plus className="size-4" aria-hidden />
                Add product to category
              </>
            }
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={resetForm}
          >
            <RotateCcw className="size-4" aria-hidden />
            Reset
          </Button>
        </div>
        {savedParentId ?
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Product saved. Save on another variant adds it as an extra SKU.
            Apply a row, then Add product to category, only when starting a new
            listing.
          </p>
        : resolved ?
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Save on a variant uses that SKU as the table listing. Apply fills
            the form; Add product to category saves the form. Switch to
            Retailer comparison to save other-store offers.
          </p>
        : null}
      </form>
    </div>
  );
}
