"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitProductReturnRequestAction } from "@/actions/submit-product-return-request";
import { ProductReturnDesiredOutcomeOptions } from "@/components/dashboard/product-return-desired-outcome-options";
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
import { Label } from "@/components/ui/label";
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import { formatUsd } from "@/lib/admin-markup";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { dashboardShowsProductReturnButton } from "@/lib/order-line-product-return-eligibility";
import {
  productReturnDesiredOutcomeContextFromFulfillment,
  type ProductReturnDesiredOutcome,
} from "@/lib/product-return-desired-outcome";
import {
  isProductReturnBarrelStageFulfillment,
  productReturnBarrelStageConfirmMessage,
} from "@/lib/product-return-barrel-hold";
import { displaySiteName } from "@/lib/site-name";
import { cn } from "@/lib/utils";

function ProductReturnSummaryCard({ row }: { row: DashboardPaidOrderLineRow }) {
  const r = row.request;
  const productName = r.productName?.trim() || "Unnamed product";
  const site = displaySiteName(r.siteName, r.productUrl);
  const size = r.productSize?.trim();
  const color = r.productColor?.trim();
  const batchLabel =
    row.resolvedBatchNumber?.trim() ||
    (row.resolvedBatchSessionId?.trim() ?
      `Batch ${row.resolvedBatchSessionId.trim().slice(0, 8)}…`
    : null);

  const variantParts = [
    size ? `Size ${size}` : null,
    color ? `Color ${color}` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-lg border border-border bg-muted/60 p-3.5">
      <div className="flex gap-3">
        <ProductRequestThumbnail
          variant="list"
          imageUrl={r.productImageUrl}
          productLabel={productName}
          className="size-[4.25rem] shrink-0 rounded-md"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p
            className="line-clamp-2 text-sm font-medium leading-snug text-foreground"
            title={productName}
          >
            {productName}
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              <dt className="sr-only">Retailer</dt>
              <dd>{site}</dd>
            </div>
            <div>
              <dt className="sr-only">Quantity</dt>
              <dd className="tabular-nums">Qty {row.orderItem.quantity}</dd>
            </div>
            <div>
              <dt className="sr-only">Line total</dt>
              <dd className="tabular-nums font-medium text-foreground">
                {formatUsd(row.orderItem.price)}
              </dd>
            </div>
            {variantParts.length > 0 ?
              <div className="col-span-2 sm:col-span-3">
                <dt className="sr-only">Variant</dt>
                <dd>{variantParts.join(" · ")}</dd>
              </div>
            : null}
            {batchLabel ?
              <div className="col-span-2 sm:col-span-3">
                <dt className="sr-only">Batch</dt>
                <dd>Batch {batchLabel}</dd>
              </div>
            : null}
            <div className="col-span-2 sm:col-span-3">
              <dt className="sr-only">Order</dt>
              <dd>
                Order{" "}
                <span className="font-mono" title={row.order.id}>
                  {row.order.id.slice(0, 8)}…
                </span>
              </dd>
            </div>
          </dl>
          <Link
            href={r.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Open retailer listing
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DashboardProductReturnRequestDialog({
  row,
}: {
  row: DashboardPaidOrderLineRow;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [desiredOutcome, setDesiredOutcome] =
    useState<ProductReturnDesiredOutcome | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [confirmCharges, setConfirmCharges] = useState(false);
  const [barrelConfirmOpen, setBarrelConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const fulfillment = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order,
  );
  const isBarrelStage = isProductReturnBarrelStageFulfillment(fulfillment);
  const isMissingDelivery = fulfillment === "delivery_received_item_missing";
  const outcomeContext = productReturnDesiredOutcomeContextFromFulfillment(fulfillment);

  const canRequest = dashboardShowsProductReturnButton({
    request: row.request,
    orderItem: row.orderItem,
    order: row.order,
    refundedCents: row.refundedCents,
    pendingProductReturnRequest: row.pendingProductReturnRequest != null,
    pendingRefundRequest: row.pendingRefundRequest != null,
  });

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setDesiredOutcome(null);
      setReturnNote("");
      setConfirmCharges(false);
      setBarrelConfirmOpen(false);
    }
  }, []);

  const submitReturn = useCallback(() => {
    startTransition(async () => {
      if (!desiredOutcome) return;
      const res = await submitProductReturnRequestAction({
        orderItemId: row.orderItem.id,
        desiredOutcome,
        returnNote,
        acknowledgeChargesMayApply: true,
      });
      if (res.ok) {
        toast.success(res.message);
        setBarrelConfirmOpen(false);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }, [desiredOutcome, returnNote, row.orderItem.id, router]);

  const onSubmitClick = useCallback(() => {
    if (isBarrelStage) {
      setBarrelConfirmOpen(true);
      return;
    }
    submitReturn();
  }, [isBarrelStage, submitReturn]);

  if (!canRequest) return null;

  const noteReady = returnNote.trim().length >= 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: "secondary", size: "sm" }),
          "mt-2 w-full",
        )}
      >
        Request return
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle>
            {isMissingDelivery ? "Report missing delivery" : "Request product return"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {isMissingDelivery ?
              "Submit a report for this missing item. Our team will contact the retailer on your behalf."
            : "Submit a return request. Our team will coordinate the physical return and retailer transaction on your behalf."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <ProductReturnSummaryCard row={row} />

          <div className="space-y-2 rounded-lg border border-border/80 bg-muted/40 px-4 py-3.5">
            <p className="text-sm font-medium text-foreground">
              {isMissingDelivery ? "What happens next" : "Return process"}
            </p>
            {isMissingDelivery ?
              <ul className="list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-muted-foreground">
                <li>
                  Our team will contact the retailer about the missing delivery
                  and pursue the resolution you select below.
                </li>
                <li>
                  After submission, your request will be reviewed and this order
                  will be updated when the retailer responds or further action is
                  required.
                </li>
              </ul>
            : <ul className="list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-muted-foreground">
                <li>
                  Our team will handle the physical product, coordinate with the
                  carrier, and complete the return with the retailer.
                </li>
                <li>
                  After submission, your request will be reviewed and this order
                  will be updated when return tracking is confirmed.
                </li>
              </ul>
            }
          </div>

          <ProductReturnDesiredOutcomeOptions
            namePrefix={row.orderItem.id}
            value={desiredOutcome}
            onChange={setDesiredOutcome}
            disabled={pending}
            context={outcomeContext}
          />

          <div className="grid gap-2">
            <Label htmlFor={`return-note-${row.orderItem.id}`}>
              {isMissingDelivery ? "Delivery details" : "Reason for return"}
            </Label>
            <textarea
              id={`return-note-${row.orderItem.id}`}
              className="min-h-[6.5rem] w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground shadow-xs"
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder={
                isMissingDelivery ?
                  "Describe how the delivery was incomplete (for example, the package arrived without this item). Include any carrier or retailer details that may assist our team."
                : "Describe the issue (for example, incorrect size, damage, or a change of mind). Our team will use this information when arranging the return."
              }
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 20 characters · {returnNote.trim().length.toLocaleString()}
              /2,000
            </p>
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-muted/30 px-3 py-3 text-sm leading-relaxed text-muted-foreground">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
              checked={confirmCharges}
              onChange={(e) => setConfirmCharges(e.target.checked)}
            />
            <span>
              I understand that additional service, shipping, or price-difference
              charges may apply. Our team will confirm any extra charges before
              billing.
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 pt-4 sm:gap-0">
          <Button
            type="button"
            disabled={
              pending ||
              desiredOutcome == null ||
              !confirmCharges ||
              !noteReady
            }
            onClick={onSubmitClick}
          >
            {pending ? "Submitting…" : (
              isMissingDelivery ? "Submit request" : "Submit return request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={barrelConfirmOpen} onOpenChange={setBarrelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from container packing?</AlertDialogTitle>
            <AlertDialogDescription>
              {productReturnBarrelStageConfirmMessage({
                fulfillmentStatus: fulfillment,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                submitReturn();
              }}
            >
              {pending ? "Submitting…" : (
              isMissingDelivery ? "Submit request" : "Submit return request"
            )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
