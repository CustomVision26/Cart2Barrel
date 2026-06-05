"use client";

import { useState } from "react";
import { EyeIcon } from "lucide-react";

import { ReceivedPhotosViewer } from "@/components/orders/received-photos-viewer";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { isOutsidePurchaseRequest, outsidePurchaseReferenceDisplay } from "@/lib/outside-purchase";
import { parseOutsidePurchaseReceivedCondition } from "@/lib/outside-purchase-display";
import { displaySiteName } from "@/lib/site-name";
import { cn } from "@/lib/utils";
import {
  isWarehouseMissingReason,
  warehouseMissingReasonLabel,
  warehouseReceiveConditionLabel,
} from "@/lib/warehouse-receive-condition";

/**
 * Admin queue preview: product details plus, for outside purchases, the intake
 * received-condition photo (slideshow when >1) and receipt.
 */
export function AdminItemRequestPreviewDialog({
  request,
}: {
  request: ItemRequest;
}) {
  const [open, setOpen] = useState(false);

  const productName = request.productName?.trim() || "This product";
  const isOutside = isOutsidePurchaseRequest(request);
  const reference = outsidePurchaseReferenceDisplay(request);
  const conditionImageUrl = request.outsidePurchaseConditionImageUrl?.trim();
  const receiptImageUrl = request.outsidePurchaseReceiptImageUrl?.trim();
  const condition = parseOutsidePurchaseReceivedCondition(
    request.outsidePurchaseReceivedCondition,
  );
  const missingReason =
    isWarehouseMissingReason(request.outsidePurchaseMissingReason) ?
      request.outsidePurchaseMissingReason
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "whitespace-nowrap")}
      >
        <EyeIcon className="size-4" aria-hidden />
        Preview
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,44rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1 border-b border-border px-6 py-4">
          <DialogTitle>Product preview</DialogTitle>
          <DialogDescription>
            Snapshot of this request line{isOutside ? " and the intake photos staff captured." : "."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <section className="flex gap-3 rounded-lg border border-border bg-muted p-3">
            <ProductRequestThumbnail
              variant="dialog"
              imageUrl={request.productImageUrl}
              productLabel={productName}
            />
            <dl className="min-w-0 flex-1 space-y-1 text-sm">
              <div>
                <dt className="sr-only">Product name</dt>
                <dd className="font-medium text-foreground">{productName}</dd>
              </div>
              {reference ? (
                <div className="flex gap-1.5">
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="font-mono text-xs text-primary">{reference}</dd>
                </div>
              ) : null}
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">Site</dt>
                <dd className="text-foreground">
                  {displaySiteName(request.siteName, request.productUrl)}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>Qty {request.quantity}</span>
                {request.productSize?.trim() ? (
                  <span>Size {request.productSize.trim()}</span>
                ) : null}
                {request.productColor?.trim() ? (
                  <span>Color {request.productColor.trim()}</span>
                ) : null}
              </div>
              {isOutside && condition ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <dt className="text-muted-foreground">Received</dt>
                  <dd className="text-foreground">
                    {warehouseReceiveConditionLabel(condition)}
                    {missingReason ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {warehouseMissingReasonLabel(missingReason)}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          {isOutside ? (
            <section className="flex flex-wrap items-center gap-4">
              {conditionImageUrl ? (
                <ReceivedPhotosViewer
                  photos={[{ url: conditionImageUrl, label: "Received condition" }]}
                  triggerLabel="Received condition photo"
                />
              ) : (
                <span className="text-sm text-muted-foreground">
                  No received condition photo.
                </span>
              )}
              {receiptImageUrl ? (
                <a
                  href={receiptImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  View receipt
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">No receipt.</span>
              )}
            </section>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border bg-secondary px-6 py-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
