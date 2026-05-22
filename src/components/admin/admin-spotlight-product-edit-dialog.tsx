"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, Pencil } from "lucide-react";

import {
  adminUpdateSpotlightProductAction,
  adminUploadSpotlightProductImageAction,
} from "@/actions/admin-spotlight-products";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminSpotlightProductRow } from "@/data/spotlight-category-products";
import { formatUsd } from "@/lib/admin-markup";
import { displaySiteName } from "@/lib/site-name";
import { revokeBlobPreviewUrl } from "@/lib/staged-product-image";

function centsToUsdInput(cents: number | null): string {
  if (cents == null || cents <= 0) return "";
  return (cents / 100).toFixed(2);
}

type AdminSpotlightProductEditDialogProps = {
  product: AdminSpotlightProductRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onStatusMessage: (message: string | null) => void;
  onRefresh: () => void;
  runMutation: (fn: () => Promise<void>) => void;
};

export function AdminSpotlightProductEditDialog({
  product,
  open,
  onOpenChange,
  pending,
  onStatusMessage,
  onRefresh,
  runMutation,
}: AdminSpotlightProductEditDialogProps) {
  const [priceUsd, setPriceUsd] = useState("");
  const [productSize, setProductSize] = useState("");
  const [productColor, setProductColor] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showImageUpload = product != null && !product.imageUrl;

  useEffect(() => {
    if (!open || !product) return;
    setPriceUsd(centsToUsdInput(product.priceUsdCents));
    setProductSize(product.productSize?.trim() ?? "");
    setProductColor(product.productColor?.trim() ?? "");
    setImageFile(null);
    setImagePreview(null);
    setDialogError(null);
  }, [open, product]);

  useEffect(() => {
    return () => {
      revokeBlobPreviewUrl(imagePreview);
    };
  }, [imagePreview]);

  const handleImageChange = (file: File | null) => {
    revokeBlobPreviewUrl(imagePreview);
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview(null);
    }
  };

  const handleSave = () => {
    if (!product) return;
    setDialogError(null);
    onStatusMessage(null);

    runMutation(async () => {
      const updateRes = await adminUpdateSpotlightProductAction({
        id: product.id,
        priceUsd,
        productSize,
        productColor,
      });
      if (!updateRes.ok) {
        setDialogError(updateRes.message);
        onStatusMessage(updateRes.message);
        return;
      }

      if (showImageUpload && imageFile) {
        const fd = new FormData();
        fd.set("productId", product.id);
        fd.set("file", imageFile);
        const uploadRes = await adminUploadSpotlightProductImageAction(fd);
        if (!uploadRes.ok) {
          setDialogError(uploadRes.message);
          onStatusMessage(
            `${updateRes.message ?? "Price saved."} ${uploadRes.message}`,
          );
          onRefresh();
          return;
        }
      }

      onStatusMessage(
        showImageUpload && imageFile ?
          "Product updated with image."
        : (updateRes.message ?? "Product updated."),
      );
      onOpenChange(false);
      onRefresh();
    });
  };

  const title =
    product ?
      product.label?.trim() || displaySiteName(null, product.productUrl)
    : "Edit product";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-4 overflow-hidden sm:max-w-lg">
        <DialogHeader className="min-w-0 pr-8">
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4 shrink-0" aria-hidden />
            Edit product
          </DialogTitle>
          <DialogDescription className="text-pretty break-words leading-snug">
            {title}
          </DialogDescription>
        </DialogHeader>

        {product ?
          <div className="min-w-0 space-y-4 overflow-hidden">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="spotlight-edit-price">Product cost (USD)</Label>
              <Input
                id="spotlight-edit-price"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 12.99"
                value={priceUsd}
                onChange={(e) => setPriceUsd(e.target.value)}
                disabled={pending}
                className="w-full min-w-0"
              />
              <p className="text-pretty text-xs leading-relaxed break-words text-muted-foreground">
                {product.priceUsdCents != null && product.priceUsdCents > 0 ?
                  `Current: ${formatUsd(product.priceUsdCents)}. Leave blank to clear.`
                : "Optional display price for this curated listing."}
              </p>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="spotlight-edit-size">Size</Label>
                <Input
                  id="spotlight-edit-size"
                  placeholder="e.g. 128GB, Large"
                  value={productSize}
                  onChange={(e) => setProductSize(e.target.value)}
                  disabled={pending}
                  className="w-full min-w-0"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="spotlight-edit-color">Color</Label>
                <Input
                  id="spotlight-edit-color"
                  placeholder="e.g. Black, Navy"
                  value={productColor}
                  onChange={(e) => setProductColor(e.target.value)}
                  disabled={pending}
                  className="w-full min-w-0"
                />
              </div>
            </div>
            <p className="text-pretty text-xs leading-relaxed break-words text-muted-foreground">
              Leave size or color blank to clear. Shoppers see these on the category
              product browser when set.
            </p>

            {showImageUpload ?
              <div className="min-w-0 space-y-2">
                <Label htmlFor="spotlight-edit-image">Product image</Label>
                <p className="text-pretty text-xs leading-relaxed break-words text-muted-foreground">
                  No preview image yet. Upload one for the home carousel and category
                  browser.
                </p>
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted/50">
                    {imagePreview ?
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imagePreview}
                        alt=""
                        className="size-full object-cover"
                      />
                    : <div className="flex size-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="size-6" aria-hidden />
                      </div>
                    }
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      id="spotlight-edit-image"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="w-full max-w-full min-w-0 text-sm file:mr-2 file:max-w-[50%] file:truncate file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-sm"
                      disabled={pending}
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        handleImageChange(f);
                      }}
                    />
                    {imageFile ?
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto self-start px-0 text-xs"
                        disabled={pending}
                        onClick={() => {
                          handleImageChange(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        Clear selected image
                      </Button>
                    : null}
                  </div>
                </div>
              </div>
            : <p className="text-pretty text-xs leading-relaxed break-words text-muted-foreground">
                Preview image is set. Use{" "}
                <span className="font-medium text-foreground">Refresh image</span> on
                the list to re-fetch from the product URL.
              </p>
            }

            {dialogError ?
              <p
                className="text-pretty text-sm leading-relaxed break-words text-destructive"
                role="alert"
              >
                {dialogError}
              </p>
            : null}
          </div>
        : null}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!product || pending}
            onClick={handleSave}
          >
            {pending ?
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving…
              </>
            : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
