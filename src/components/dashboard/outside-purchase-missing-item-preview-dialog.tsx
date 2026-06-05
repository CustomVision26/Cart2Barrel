"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  EyeIcon,
  PackageXIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { setOutsidePurchaseMissingResolutionAction } from "@/actions/set-outside-purchase-missing-resolution";
import { withdrawCustomerProductRequestsAction } from "@/actions/withdraw-customer-product-requests";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { outsidePurchaseReferenceDisplay } from "@/lib/outside-purchase";
import { displayProductSiteName } from "@/lib/site-name";
import { cn } from "@/lib/utils";
import {
  isWarehouseMissingReason,
  outsidePurchaseMissingReasonInstruction,
  warehouseMissingReasonLabel,
} from "@/lib/warehouse-receive-condition";

type OutsidePurchaseMissingItemPreviewDialogProps = {
  request: ItemRequest;
};

export function OutsidePurchaseMissingItemPreviewDialog({
  request,
}: OutsidePurchaseMissingItemPreviewDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [resolved, setResolved] = useState(
    Boolean(request.outsidePurchaseMissingResolvedAt),
  );

  const productName = request.productName?.trim() || "This product";
  const reference = outsidePurchaseReferenceDisplay(request);
  const site = displayProductSiteName(request);
  const conditionImageUrl = request.outsidePurchaseConditionImageUrl?.trim();
  const receiptImageUrl = request.outsidePurchaseReceiptImageUrl?.trim();
  const missingReason =
    isWarehouseMissingReason(request.outsidePurchaseMissingReason) ?
      request.outsidePurchaseMissingReason
    : null;
  const reasonLabel = warehouseMissingReasonLabel(missingReason);
  const instruction = outsidePurchaseMissingReasonInstruction(missingReason);

  const performRemove = () => {
    startTransition(async () => {
      const res = await withdrawCustomerProductRequestsAction({
        itemRequestIds: [request.id],
      });
      if (!res.ok) {
        toast.error(res.message ?? "Could not remove.");
        return;
      }
      toast.success(res.message ?? "Product removed.");
      setOpen(false);
      router.refresh();
    });
  };

  const performSetResolved = (nextResolved: boolean) => {
    startTransition(async () => {
      const res = await setOutsidePurchaseMissingResolutionAction({
        itemRequestId: request.id,
        resolved: nextResolved,
      });
      if (!res.ok) {
        toast.error(res.message ?? "Could not update.");
        return;
      }
      setResolved(nextResolved);
      toast.success(res.message ?? "Updated.");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
      >
        <EyeIcon className="size-4" aria-hidden />
        Preview
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,46rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1 border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            Missing item
            {resolved ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2Icon className="size-3" aria-hidden />
                Resolved
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            You bought {productName} yourself and shipped it to our hub, but it was
            recorded as missing at intake. Because outside purchases are not bought
            by us, there is nothing for us to refund — please follow the guidance
            below to chase your carrier or retailer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <PackageXIcon
              className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Marked Missing at warehouse intake
                {reasonLabel ? (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {reasonLabel}
                  </span>
                ) : null}
              </p>
              <p className="text-sm leading-snug text-muted-foreground">
                {instruction}
              </p>
            </div>
          </div>

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Product details
            </h3>
            <div className="flex gap-3 rounded-lg border border-border bg-muted p-3">
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
                  <dd className="text-foreground">{site}</dd>
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
              </dl>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <PreviewImageBlock
              label="Received photo"
              imageUrl={conditionImageUrl}
              productLabel="Received condition"
              emptyText="No received photo was uploaded."
            />
            <PreviewImageBlock
              label="Receipt"
              imageUrl={receiptImageUrl}
              productLabel="Proof of purchase"
              emptyText="No receipt was uploaded."
            />
          </section>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border bg-secondary px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                />
              }
            >
              <Trash2Icon className="size-4" aria-hidden />
              Remove product
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this product?</AlertDialogTitle>
                <AlertDialogDescription>
                  This moves {productName} to your Product history. You can reinstate
                  it from the History tab later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  render={<Button type="button" variant="outline" />}
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  render={<Button type="button" variant="destructive" />}
                  onClick={performRemove}
                >
                  Remove product
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex items-center gap-2">
            {resolved ? (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                    />
                  }
                >
                  <RotateCcwIcon className="size-4" aria-hidden />
                  Unresolved
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reopen this issue?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Mark this missing item as unresolved again. Use this if you
                      clicked Resolved by accident or the issue is not actually
                      settled.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      render={<Button type="button" variant="outline" />}
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      render={<Button type="button" />}
                      onClick={() => performSetResolved(false)}
                    >
                      Mark unresolved
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button type="button" size="sm" disabled={pending} />
                  }
                >
                  <CheckCircle2Icon className="size-4" aria-hidden />
                  Resolved
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark this issue resolved?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Confirm the missing item is sorted out (e.g. the package
                      arrived or your carrier/retailer claim is settled). The status
                      will change to &quot;Missing item : resolved&quot;. You can undo
                      this later with Unresolved.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      render={<Button type="button" variant="outline" />}
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      render={<Button type="button" />}
                      onClick={() => performSetResolved(true)}
                    >
                      Mark resolved
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewImageBlock({
  label,
  imageUrl,
  productLabel,
  emptyText,
}: {
  label: string;
  imageUrl: string | null | undefined;
  productLabel: string;
  emptyText: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      {imageUrl ? (
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group block overflow-hidden rounded-lg border border-border bg-muted"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- staff-uploaded blob URLs */}
          <img
            src={imageUrl}
            alt={`${label}: ${productLabel}`}
            className="aspect-video w-full object-cover transition-transform group-hover:scale-[1.02]"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <span className="block px-2 py-1.5 text-center text-xs font-medium text-primary underline-offset-2 group-hover:underline">
            View full size
          </span>
        </a>
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 px-3 text-center text-xs text-muted-foreground">
          {emptyText}
        </div>
      )}
    </div>
  );
}
