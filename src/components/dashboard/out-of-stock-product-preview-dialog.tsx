"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EyeIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { withdrawCustomerProductRequestsAction } from "@/actions/withdraw-customer-product-requests";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ItemRequest } from "@/db/schema";
import { DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE } from "@/lib/dashboard-items-routes";
import { displaySiteName } from "@/lib/site-name";

type OutOfStockProductPreviewDialogProps = {
  request: ItemRequest;
};

type ImageLightboxState = {
  url: string;
  label: string;
};

export function OutOfStockProductPreviewDialog({
  request,
}: OutOfStockProductPreviewDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lightbox, setLightbox] = useState<ImageLightboxState | null>(null);
  const [removing, startRemove] = useTransition();

  const onRemove = () => {
    startRemove(async () => {
      const res = await withdrawCustomerProductRequestsAction({
        itemRequestIds: [request.id],
      });
      if (!res.ok) {
        toast.error(res.message ?? "Could not remove this product.");
        return;
      }
      toast.success(res.message ?? "Removed from your active products.");
      setOpen(false);
      router.refresh();
    });
  };

  const productName = request.productName?.trim() || "This product";
  const productImageUrl = request.productImageUrl?.trim() || null;
  const attachmentUrls = (request.outOfStockAttachmentImageUrls ?? [])
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setLightbox(null);
        }}
      >
        <DialogTrigger
          type="button"
          className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          <EyeIcon className="size-4" />
          Preview
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Out of stock</DialogTitle>
            <DialogDescription>
              Our team could not source {productName}. Remove it from your active
              product record, then submit a new request if you want us to try a
              different product or link.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 rounded-md border border-border bg-muted p-3">
            {productImageUrl ?
              <button
                type="button"
                onClick={() =>
                  setLightbox({
                    url: productImageUrl,
                    label: productName,
                  })
                }
                className="shrink-0 rounded-lg text-left outline-none ring-offset-background transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                title="Preview product image"
                aria-label={`Preview image of ${productName}`}
              >
                <ProductRequestThumbnail
                  variant="list"
                  imageUrl={productImageUrl}
                  productLabel={productName}
                />
              </button>
            : (
              <ProductRequestThumbnail
                variant="list"
                imageUrl={null}
                productLabel={productName}
              />
            )}
            <OutOfStockProductSummary
              request={request}
              productName={productName}
            />
          </div>
          {request.outOfStockStaffNote?.trim() ?
            <div className="rounded-md border border-border bg-secondary/40 px-3 py-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Note from Cart2Barrel
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {request.outOfStockStaffNote.trim()}
              </p>
            </div>
          : null}
          {attachmentUrls.length > 0 ?
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Attachment images
              </p>
              <ul className="flex flex-wrap gap-2">
                {attachmentUrls.map((url, index) => (
                  <li key={url}>
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          url,
                          label: `Staff attachment ${index + 1}`,
                        })
                      }
                      className="overflow-hidden rounded-md border border-border bg-background outline-none ring-offset-background transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                      title="Preview attachment"
                      aria-label={`Preview staff attachment ${index + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- staff-uploaded blob URLs */}
                      <img
                        src={url}
                        alt=""
                        className="size-20 object-cover"
                        loading="lazy"
                      />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Tap an image to preview it larger.
              </p>
            </div>
          : null}
          <p className="text-sm text-muted-foreground">
            After you remove this line, it moves to Product history. To request a
            different product, use{" "}
            <Link
              href={DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Request a new product
            </Link>
            .
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              variant="destructive"
              disabled={removing}
              className="w-full"
              onClick={onRemove}
            >
              {removing ?
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Removing…
                </>
              : "Remove from product record"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              nativeButton={false}
              render={<Link href={DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE} />}
            >
              Request a new product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={lightbox != null}
        onOpenChange={(next) => {
          if (!next) setLightbox(null);
        }}
      >
        <DialogContent className="gap-3 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Image preview</DialogTitle>
            <DialogDescription>{lightbox?.label ?? "Attached image"}</DialogDescription>
          </DialogHeader>
          {lightbox ?
            <div className="overflow-hidden rounded-lg border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- staff or retailer image URLs */}
              <img
                src={lightbox.url}
                alt={lightbox.label}
                className="mx-auto max-h-[min(70vh,32rem)] w-full object-contain"
              />
            </div>
          : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function OutOfStockProductSummary({
  request,
  productName,
}: {
  request: ItemRequest;
  productName: string;
}) {
  return (
    <div className="min-w-0 flex-1 space-y-1 text-sm">
      <p className="font-medium text-foreground line-clamp-2">{productName}</p>
      <p className="text-xs text-muted-foreground">
        {displaySiteName(request.siteName, request.productUrl)}
      </p>
      <a
        href={request.productUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-primary underline-offset-2 hover:underline"
      >
        View product URL
      </a>
    </div>
  );
}
