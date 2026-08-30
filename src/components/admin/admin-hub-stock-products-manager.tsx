"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { XIcon } from "lucide-react";

import {
  adminCreateHubStockProductAction,
  adminDeleteHubStockProductAction,
  adminDeleteHubStockProductImageAction,
  adminSetHubStockProductPublishedAction,
  adminUpdateHubStockProductAction,
  adminUploadHubStockProductImagesAction,
} from "@/actions/admin-hub-stock-products";
import { AdminConfirmDialog } from "@/components/admin/admin-confirm-dialog";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageFileInput } from "@/components/ui/image-file-input";
import { Input, inputFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatUsd } from "@/lib/admin-markup";
import { HUB_STOCK_PRODUCT_IMAGES_MAX } from "@/lib/hub-stock";
import { validateProductImageFile } from "@/lib/staged-product-image";
import { cn } from "@/lib/utils";

export type AdminHubStockProductRow = {
  id: string;
  name: string;
  sizeLabel: string;
  colorLabel: string;
  description: string;
  priceUsdCents: number;
  stockQty: number;
  parcelWeightOz: number | null;
  parcelLengthIn: number | null;
  parcelWidthIn: number | null;
  parcelHeightIn: number | null;
  isActive: boolean;
  images: { id: string; imageUrl: string; sortIndex: number }[];
};

function centsToUsdInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function firstHubStockImage(
  product: AdminHubStockProductRow,
): { id: string; imageUrl: string; sortIndex: number } | null {
  const images = [...product.images].sort((a, b) => a.sortIndex - b.sortIndex);
  return images[0] ?? null;
}

function appendValidImageFiles(current: File[], fileList: FileList | null): File[] {
  const incoming = [...(fileList ?? [])];
  if (incoming.length === 0) return current;
  const next = [...current];
  for (const file of incoming) {
    const err = validateProductImageFile(file);
    if (err) {
      toast.error(err);
      continue;
    }
    if (next.length >= HUB_STOCK_PRODUCT_IMAGES_MAX) {
      toast.error(`At most ${HUB_STOCK_PRODUCT_IMAGES_MAX} images per product.`);
      break;
    }
    next.push(file);
  }
  return next;
}

export function AdminHubStockProductsManager({
  products,
}: {
  products: AdminHubStockProductRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewProduct, setPreviewProduct] = useState<AdminHubStockProductRow | null>(
    null,
  );
  const [editProduct, setEditProduct] = useState<AdminHubStockProductRow | null>(null);

  const previewImage = previewProduct ? firstHubStockImage(previewProduct) : null;
  const editRow =
    products.find((p) => p.id === editProduct?.id) ?? editProduct;

  return (
    <div className="space-y-6">
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Add in-hub product</CardTitle>
          <CardDescription>
            New products appear in the table as unpublished. Enter packed weight (ounces)
            and outer box size (inches) so Shippo can rate US delivery. Click Publish on
            a row to show the SKU on the home page for shoppers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddHubStockProductForm
            pending={pending}
            onSubmit={(payload, imageFiles, form, resetImages) => {
              startTransition(async () => {
                const result = await adminCreateHubStockProductAction(payload);
                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
                if (imageFiles.length > 0) {
                  const fd = new FormData();
                  fd.set("productId", result.id);
                  for (const file of imageFiles) {
                    fd.append("file", file);
                  }
                  const upload = await adminUploadHubStockProductImagesAction(fd);
                  if (!upload.ok) {
                    toast.error(
                      `Product saved, but images failed: ${upload.message}`,
                    );
                    resetImages();
                    form.reset();
                    router.refresh();
                    return;
                  }
                }
                toast.success("In-hub product added. Publish it to show shoppers.");
                resetImages();
                form.reset();
                router.refresh();
              });
            }}
          />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Catalog</h3>
        {products.length === 0 ?
          <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No in-hub products yet.
          </p>
        : (
          <FloatingHorizontalScroll className="rounded-lg border border-border">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Image 1</th>
                  <th className="px-3 py-2.5 font-medium">Product</th>
                  <th className="px-3 py-2.5 font-medium">Size</th>
                  <th className="px-3 py-2.5 font-medium">Color</th>
                  <th className="px-3 py-2.5 font-medium">Price</th>
                  <th className="px-3 py-2.5 font-medium">Package</th>
                  <th className="px-3 py-2.5 font-medium">Stock</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product) => {
                  const cover = firstHubStockImage(product);
                  return (
                    <tr
                      key={product.id}
                      className="cursor-pointer bg-card hover:bg-muted/40"
                      onDoubleClick={() => setPreviewProduct(product)}
                    >
                      <td className="px-3 py-2">
                        {cover ?
                          <div className="size-12 overflow-hidden rounded border border-border/60 bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={cover.imageUrl}
                              alt=""
                              className="size-full object-cover"
                            />
                          </div>
                        : (
                          <span className="text-xs text-muted-foreground">No photo</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-foreground">
                        {product.name}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {product.sizeLabel}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {product.colorLabel}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-foreground">
                        {formatUsd(product.priceUsdCents)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                        {product.parcelWeightOz &&
                        product.parcelLengthIn &&
                        product.parcelWidthIn &&
                        product.parcelHeightIn ?
                          `${product.parcelWeightOz} oz · ${product.parcelLengthIn}×${product.parcelWidthIn}×${product.parcelHeightIn} in`
                        : "Missing"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                        {product.stockQty}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge kind={product.isActive ? "fullyReceived" : "draft"}>
                          {product.isActive ? "Published" : "Unpublished"}
                        </StatusBadge>
                      </td>
                      <td
                        className="px-3 py-2.5"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant={product.isActive ? "outline" : "default"}
                            disabled={pending}
                            onClick={() => {
                              startTransition(async () => {
                                const result =
                                  await adminSetHubStockProductPublishedAction({
                                    id: product.id,
                                    published: !product.isActive,
                                  });
                                if (!result.ok) {
                                  toast.error(result.message);
                                  return;
                                }
                                toast.success(
                                  product.isActive ?
                                    "Unpublished. Shoppers will no longer see this SKU."
                                  : "Published. Shoppers can now see this product.",
                                );
                                router.refresh();
                              });
                            }}
                          >
                            {product.isActive ? "Unpublish" : "Publish"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => setEditProduct(product)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => setDeleteId(product.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </FloatingHorizontalScroll>
        )}
        <p className="text-xs text-muted-foreground">
          Double-click a row to view image 1.
        </p>
      </div>

      <Dialog
        open={previewProduct != null}
        onOpenChange={(open) => {
          if (!open) setPreviewProduct(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewProduct?.name ?? "Product photo"}</DialogTitle>
            <DialogDescription>
              {previewProduct ?
                `${previewProduct.sizeLabel} · ${previewProduct.colorLabel} · image 1`
              : "Image 1"}
            </DialogDescription>
          </DialogHeader>
          {previewImage ?
            <div className="overflow-hidden rounded-md border border-border/60 bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage.imageUrl}
                alt={previewProduct?.name ?? "Product photo"}
                className="max-h-[70vh] w-full object-contain"
              />
            </div>
          : (
            <p className="rounded-md border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
              No photos uploaded for this product yet.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editRow != null}
        onOpenChange={(open) => {
          if (!open) setEditProduct(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
            <DialogDescription>
              Update details and photos. Use Publish on the table to show this SKU to
              shoppers.
            </DialogDescription>
          </DialogHeader>
          {editRow ?
            <AdminHubStockProductEditor
              key={editRow.id}
              product={editRow}
              pending={pending}
              onSave={(payload) => {
                startTransition(async () => {
                  const result = await adminUpdateHubStockProductAction(payload);
                  if (!result.ok) {
                    toast.error(result.message);
                    return;
                  }
                  toast.success("Product updated.");
                  router.refresh();
                });
              }}
              onDelete={() => {
                setEditProduct(null);
                setDeleteId(editRow.id);
              }}
              onRefresh={() => router.refresh()}
            />
          : null}
        </DialogContent>
      </Dialog>

      <AdminConfirmDialog
        open={deleteId != null}
        title="Delete in-hub product?"
        description="Shoppers will no longer see this SKU. Cart lines for this product are removed."
        confirmLabel="Delete"
        pending={pending}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        onConfirm={() => {
          if (!deleteId) return;
          startTransition(async () => {
            const result = await adminDeleteHubStockProductAction({ id: deleteId });
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success("Product deleted.");
            setDeleteId(null);
            router.refresh();
          });
        }}
      />
    </div>
  );
}

function AddHubStockProductForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (
    payload: {
      name: string;
      sizeLabel: string;
      colorLabel: string;
      description: string;
      priceUsd: string;
      stockQty: number;
      parcelWeightOz: number;
      parcelLengthIn: number;
      parcelWidthIn: number;
      parcelHeightIn: number;
      isActive: boolean;
    },
    imageFiles: File[],
    form: HTMLFormElement,
    resetImages: () => void,
  ) => void;
}) {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = imageFiles.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [imageFiles]);

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        onSubmit(
          {
            name: String(data.get("name") ?? ""),
            sizeLabel: String(data.get("sizeLabel") ?? ""),
            colorLabel: String(data.get("colorLabel") ?? ""),
            description: String(data.get("description") ?? ""),
            priceUsd: String(data.get("priceUsd") ?? ""),
            stockQty: Number(data.get("stockQty") ?? 0),
            parcelWeightOz: Number(data.get("parcelWeightOz") ?? 0),
            parcelLengthIn: Number(data.get("parcelLengthIn") ?? 0),
            parcelWidthIn: Number(data.get("parcelWidthIn") ?? 0),
            parcelHeightIn: Number(data.get("parcelHeightIn") ?? 0),
            isActive: false,
          },
          imageFiles,
          form,
          () => setImageFiles([]),
        );
      }}
    >
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="hub-name">Product name</Label>
        <Input id="hub-name" name="name" required maxLength={200} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hub-size">Size</Label>
        <Input id="hub-size" name="sizeLabel" required maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hub-color">Color</Label>
        <Input id="hub-color" name="colorLabel" required maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hub-stock">Amount in stock</Label>
        <Input
          id="hub-stock"
          name="stockQty"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={1}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hub-price">Price (USD)</Label>
        <Input
          id="hub-price"
          name="priceUsd"
          inputMode="decimal"
          placeholder="12.99"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hub-weight">Weight (oz)</Label>
        <Input
          id="hub-weight"
          name="parcelWeightOz"
          type="number"
          min={0.1}
          step={0.1}
          required
          placeholder="16"
        />
        <p className="text-[11px] text-muted-foreground">16 oz = 1 lb. Used by Shippo.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:col-span-1">
        <div className="space-y-1.5">
          <Label htmlFor="hub-length">Length (in)</Label>
          <Input id="hub-length" name="parcelLengthIn" type="number" min={0.1} step={0.1} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hub-width">Width (in)</Label>
          <Input id="hub-width" name="parcelWidthIn" type="number" min={0.1} step={0.1} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hub-height">Height (in)</Label>
          <Input id="hub-height" name="parcelHeightIn" type="number" min={0.1} step={0.1} required />
        </div>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="hub-desc">Description</Label>
        <textarea
          id="hub-desc"
          name="description"
          rows={3}
          className={cn(inputFieldClassName, "min-h-20 py-2 text-sm")}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label>Images</Label>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, WebP, or GIF. Image 1 is the cover photo for shoppers.
        </p>
        {previews.length > 0 ?
          <div className="flex flex-wrap gap-2">
            {previews.map((src, index) => (
              <div
                key={`${src}-${index}`}
                className="relative size-20 overflow-hidden rounded border border-border/60 bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover" />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute right-0.5 top-0.5 h-6 min-w-0 px-1"
                  onClick={() => {
                    setImageFiles((files) => files.filter((_, i) => i !== index));
                  }}
                >
                  <XIcon className="size-3" aria-hidden />
                  <span className="sr-only">Remove image</span>
                </Button>
              </div>
            ))}
          </div>
        : null}
        <ImageFileInput
          id="hub-images"
          multiple
          selectedFileName={
            imageFiles.length === 0 ? null
            : imageFiles.length === 1 ? imageFiles[0]?.name
            : `${imageFiles.length} images selected`
          }
          onFiles={(list) => {
            setImageFiles((current) => appendValidImageFiles(current, list));
          }}
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add product"}
        </Button>
      </div>
    </form>
  );
}

function AdminHubStockProductEditor({
  product,
  pending,
  onSave,
  onDelete,
  onRefresh,
}: {
  product: AdminHubStockProductRow;
  pending: boolean;
  onSave: (payload: {
    id: string;
    name: string;
    sizeLabel: string;
    colorLabel: string;
    description: string;
    priceUsd: string;
    stockQty: number;
    parcelWeightOz: number;
    parcelLengthIn: number;
    parcelWidthIn: number;
    parcelHeightIn: number;
    isActive: boolean;
  }) => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [uploading, startUpload] = useTransition();
  const busy = pending || uploading;
  const images = [...product.images].sort((a, b) => a.sortIndex - b.sortIndex);
  const [fields, setFields] = useState({
    name: product.name,
    sizeLabel: product.sizeLabel,
    colorLabel: product.colorLabel,
    description: product.description,
    priceUsd: centsToUsdInput(product.priceUsdCents),
    stockQty: String(product.stockQty),
    parcelWeightOz:
      product.parcelWeightOz != null ? String(product.parcelWeightOz) : "",
    parcelLengthIn:
      product.parcelLengthIn != null ? String(product.parcelLengthIn) : "",
    parcelWidthIn:
      product.parcelWidthIn != null ? String(product.parcelWidthIn) : "",
    parcelHeightIn:
      product.parcelHeightIn != null ? String(product.parcelHeightIn) : "",
  });

  function setField(name: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Photos ({images.length})</Label>
        {images.length > 0 ?
          <div className="flex flex-wrap gap-2">
            {images.map((im) => (
              <div
                key={im.id}
                className="relative size-20 overflow-hidden rounded border border-border/60 bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.imageUrl} alt="" className="size-full object-cover" />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute right-0.5 top-0.5 h-6 min-w-0 px-1.5 text-[10px]"
                  disabled={busy}
                  onClick={() => {
                    startUpload(async () => {
                      const res = await adminDeleteHubStockProductImageAction({
                        imageId: im.id,
                      });
                      if (!res.ok) {
                        toast.error(res.message);
                        return;
                      }
                      toast.success("Image removed.");
                      onRefresh();
                    });
                  }}
                >
                  <XIcon className="size-3" aria-hidden />
                  <span className="sr-only">Remove image</span>
                </Button>
              </div>
            ))}
          </div>
        : (
          <p className="text-xs text-muted-foreground">No photos yet.</p>
        )}
        <ImageFileInput
          multiple
          selectedFileName={null}
          onFiles={(list) => {
            const files = appendValidImageFiles([], list);
            if (files.length === 0) return;
            if (images.length + files.length > HUB_STOCK_PRODUCT_IMAGES_MAX) {
              toast.error(`At most ${HUB_STOCK_PRODUCT_IMAGES_MAX} images per product.`);
              return;
            }
            startUpload(async () => {
              const fd = new FormData();
              fd.set("productId", product.id);
              for (const file of files) {
                fd.append("file", file);
              }
              const res = await adminUploadHubStockProductImagesAction(fd);
              if (!res.ok) {
                toast.error(res.message);
                return;
              }
              toast.success(
                res.uploaded === 1 ?
                  "1 image uploaded."
                : `${res.uploaded} images uploaded.`,
              );
              onRefresh();
            });
          }}
        />
      </div>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: product.id,
            name: fields.name,
            sizeLabel: fields.sizeLabel,
            colorLabel: fields.colorLabel,
            description: fields.description,
            priceUsd: fields.priceUsd,
            stockQty: Number(fields.stockQty ?? 0),
            parcelWeightOz: Number(fields.parcelWeightOz ?? 0),
            parcelLengthIn: Number(fields.parcelLengthIn ?? 0),
            parcelWidthIn: Number(fields.parcelWidthIn ?? 0),
            parcelHeightIn: Number(fields.parcelHeightIn ?? 0),
            isActive: product.isActive,
          });
        }}
      >
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Product name</Label>
          <Input
            name="name"
            value={fields.name}
            onChange={(e) => setField("name", e.target.value)}
            required
            maxLength={200}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Size</Label>
          <Input
            name="sizeLabel"
            value={fields.sizeLabel}
            onChange={(e) => setField("sizeLabel", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Color</Label>
          <Input
            name="colorLabel"
            value={fields.colorLabel}
            onChange={(e) => setField("colorLabel", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Amount in stock</Label>
          <Input
            name="stockQty"
            type="number"
            min={0}
            step={1}
            value={fields.stockQty}
            onChange={(e) => setField("stockQty", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Price (USD)</Label>
          <Input
            name="priceUsd"
            value={fields.priceUsd}
            onChange={(e) => setField("priceUsd", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Weight (oz)</Label>
          <Input
            name="parcelWeightOz"
            type="number"
            min={0.1}
            step={0.1}
            value={fields.parcelWeightOz}
            onChange={(e) => setField("parcelWeightOz", e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label>L (in)</Label>
            <Input
              name="parcelLengthIn"
              type="number"
              min={0.1}
              step={0.1}
              value={fields.parcelLengthIn}
              onChange={(e) => setField("parcelLengthIn", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>W (in)</Label>
            <Input
              name="parcelWidthIn"
              type="number"
              min={0.1}
              step={0.1}
              value={fields.parcelWidthIn}
              onChange={(e) => setField("parcelWidthIn", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>H (in)</Label>
            <Input
              name="parcelHeightIn"
              type="number"
              min={0.1}
              step={0.1}
              value={fields.parcelHeightIn}
              onChange={(e) => setField("parcelHeightIn", e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Description</Label>
          <textarea
            name="description"
            rows={3}
            value={fields.description}
            onChange={(e) => setField("description", e.target.value)}
            className={cn(inputFieldClassName, "min-h-20 py-2 text-sm")}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" size="sm" disabled={busy}>
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      </form>
    </div>
  );
}
