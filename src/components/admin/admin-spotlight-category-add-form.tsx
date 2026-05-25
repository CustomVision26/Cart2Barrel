"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ImageIcon,
  Loader2,
  RotateCcw,
  Search,
  Store,
} from "lucide-react";
import { toast } from "sonner";

import {
  adminResolveSpotlightProductAction,
  adminSaveSpotlightProductOfferAction,
  adminSaveSpotlightVariantOfferAction,
  type AdminResolveSpotlightProductResult,
} from "@/actions/admin-spotlight-product-resolve";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsd } from "@/lib/admin-markup";
import type { SpotlightCategorySlug } from "@/lib/spotlight-categories";
import { cn } from "@/lib/utils";

type ResolvedState = Extract<AdminResolveSpotlightProductResult, { ok: true }>;

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

function OfferThumb({ src }: { src: string | null }) {
  if (!src?.trim()) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded border border-border bg-muted text-muted-foreground">
        <ImageIcon className="size-4" aria-hidden />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src.trim()}
      alt=""
      className="size-10 shrink-0 rounded border border-border object-cover"
    />
  );
}

export function AdminSpotlightCategoryAddForm({
  categorySlug,
  pending,
  onRefresh,
  runMutation,
}: AdminSpotlightCategoryAddFormProps) {
  const [lookupPending, startLookup] = useTransition();
  const [resolved, setResolved] = useState<ResolvedState | null>(null);
  const [variantsOpen, setVariantsOpen] = useState(true);
  const [compareOpen, setCompareOpen] = useState(true);

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

  const busy = pending || lookupPending;

  const resetForm = () => {
    setProductUrl("");
    setProductName("");
    setPriceUsd("");
    setProductSize("");
    setProductColor("");
    setImageUrl(null);
    setResolved(null);
    setSavedParentId(null);
    setSavedVariantIds(new Set());
    setSavedRetailerIds(new Set());
    setVariantsOpen(true);
    setCompareOpen(true);
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
      setSavedParentId(null);
      setSavedVariantIds(new Set());
      setSavedRetailerIds(new Set());
      setVariantsOpen(res.variants.length > 0);
      setCompareOpen(res.compareOffers.length > 0);
      const parts = [
        `Loaded from SerpApi (${res.variantRetailer}).`,
        res.variants.length > 0
          ? `${res.variants.length} variant${res.variants.length === 1 ? "" : "s"}.`
          : null,
        res.compareOffers.length > 0
          ? `${res.compareOffers.length} retailer offer${res.compareOffers.length === 1 ? "" : "s"}.`
          : null,
        res.compareMessage ? `Compare: ${res.compareMessage}` : null,
      ].filter(Boolean);
      toast.success(parts.join(" "));
    });
  };

  const savePrimary = () => {
    if (!productUrl.trim()) {
      toast.error("Product URL is required.");
      return;
    }
    runMutation(async () => {
      const res = await adminSaveSpotlightProductOfferAction({
        categorySlug,
        productUrl: productUrl.trim(),
        label: productName.trim() || undefined,
        priceUsd: priceUsd.trim() || undefined,
        productSize: productSize.trim() || undefined,
        productColor: productColor.trim() || undefined,
        imageUrl: imageUrl?.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setSavedParentId(res.parentProductId);
      toast.success(res.message);
      onRefresh();
    });
  };

  const saveVariant = (variant: ResolvedState["variants"][number]) => {
    if (!savedParentId) {
      toast.error("Save the primary product first, then save variants under it.");
      return;
    }
    runMutation(async () => {
      const res = await adminSaveSpotlightVariantOfferAction({
        parentProductId: savedParentId,
        label: variant.label,
        priceUsd: centsToUsdField(variant.priceUsdCents),
        productSize: variant.size ?? undefined,
        productColor: variant.color ?? undefined,
        packLabel: variant.packLabel ?? undefined,
        productUrl: variant.productUrl ?? undefined,
        imageUrl: variant.imageUrl ?? undefined,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setSavedVariantIds((prev) => new Set(prev).add(variant.id));
      toast.success(res.message ?? "Variant saved.");
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
      toast.success(
        `${offer.retailer}: saved as spotlight product.`,
      );
      onRefresh();
    });
  };

  return (
    <div className="space-y-4">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleLookup(productUrl);
        }}
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`url-${categorySlug}`}>Product URL (https)</Label>
          <Input
            id={`url-${categorySlug}`}
            name="productUrl"
            required
            type="url"
            placeholder="https://retailer.com/product/…"
            disabled={busy}
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
          />
        </div>

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
          <Button type="submit" disabled={busy}>
            {lookupPending ?
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading SerpApi…
              </>
            : <>
                <Search className="size-4" aria-hidden />
                Add product to category
              </>
            }
          </Button>
          {resolved ?
            <Button
              type="button"
              variant="secondary"
              disabled={busy || !productUrl.trim() || Boolean(savedParentId)}
              onClick={() => savePrimary()}
            >
              {savedParentId ? "Primary saved" : "Save primary to spotlight"}
            </Button>
          : null}
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
            Primary saved — variant rows can be saved under this product.
          </p>
        : resolved && resolved.variants.length > 0 ?
          <p className="text-xs text-amber-600 dark:text-amber-400 sm:col-span-2">
            Save the primary product before saving variant rows.
          </p>
        : null}
      </form>

      {resolved && resolved.variants.length > 0 ?
        <div className="rounded-lg border border-border">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
            onClick={() => setVariantsOpen((v) => !v)}
          >
            <ChevronDown
              className={cn("size-4 transition-transform", variantsOpen && "rotate-180")}
              aria-hidden
            />
            Store variants (SerpApi)
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {resolved.variants.length}
            </span>
            {resolved.variantMethod ?
              <span className="text-xs font-normal text-muted-foreground">
                · {resolved.variantMethod}
              </span>
            : null}
          </button>
          {variantsOpen ?
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Variant</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">Image</th>
                    <th className="px-3 py-2 font-medium w-28">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {resolved.variants.map((row) => {
                    const saved = savedVariantIds.has(row.id);
                    return (
                      <tr key={row.id} className="hover:bg-muted">
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground">
                            {row.label}
                            {row.isCurrent ?
                              <span className="ml-1 text-xs text-primary">(current)</span>
                            : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {[row.color, row.size, row.packLabel]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {row.priceUsdCents != null && row.priceUsdCents > 0
                            ? formatUsd(row.priceUsdCents)
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <OfferThumb src={row.imageUrl} />
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={saved ? "secondary" : "default"}
                            disabled={busy || saved || !savedParentId}
                            onClick={() => saveVariant(row)}
                          >
                            {saved ? "Saved" : "Save variant"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          : null}
        </div>
      : null}

      {resolved ?
        <div className="rounded-lg border border-border">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
            onClick={() => setCompareOpen((v) => !v)}
          >
            <ChevronDown
              className={cn("size-4 transition-transform", compareOpen && "rotate-180")}
              aria-hidden
            />
            <Store className="size-4 text-muted-foreground" aria-hidden />
            Retailer comparison (SerpApi + AI verify)
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {resolved.compareOffers.length}
            </span>
            {resolved.compareSearchQuery ?
              <span className="truncate text-xs font-normal text-muted-foreground">
                · “{resolved.compareSearchQuery}”
              </span>
            : null}
          </button>
          {compareOpen ?
            resolved.compareOffers.length > 0 ?
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Retailer</th>
                      <th className="px-3 py-2 font-medium">Title</th>
                      <th className="px-3 py-2 font-medium">Price</th>
                      <th className="px-3 py-2 font-medium">Image</th>
                      <th className="px-3 py-2 font-medium w-36">Action</th>
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
                          <td className="px-3 py-2 whitespace-nowrap">
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
              </p>
          : null}
        </div>
      : null}
    </div>
  );
}
