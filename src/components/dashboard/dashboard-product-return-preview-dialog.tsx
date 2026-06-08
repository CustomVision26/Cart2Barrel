"use client";

import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelProductReturnRequestAction } from "@/actions/cancel-product-return-request";
import { ProductReturnRequestDetails } from "@/components/dashboard/product-return-request-details";
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
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import { formatUsd } from "@/lib/admin-markup";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { dashboardOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { resolveProductReturnDesiredOutcomeContext } from "@/lib/product-return-desired-outcome";
import { cn } from "@/lib/utils";

function StaffReturnSection({ row }: { row: DashboardPaidOrderLineRow }) {
  const oi = row.orderItem;
  const url = oi.companyPurchaseTrackingUrl?.trim();
  const company = oi.companyPurchaseRetailerTrackingCompany?.trim();
  const number = oi.companyPurchaseRetailerTrackingNumber?.trim();
  const receipts = oi.companyPurchaseReceiptImageUrls ?? [];
  const staffCustomerNote = row.fulfilledProductReturnRequest?.customerNotes?.trim();

  return (
    <section className="space-y-4 rounded-xl border border-border/80 bg-muted/40 p-4 text-sm">
      <h3 className="text-sm font-semibold text-foreground">Return shipment details</h3>
      {staffCustomerNote ?
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {staffCustomerNote}
        </p>
      : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Our team returned this product and coordinated shipping with the carrier.
        </p>
      )}
      <dl className="grid gap-4 sm:grid-cols-2">
        {url ?
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Tracking URL
            </dt>
            <dd className="mt-1">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Open carrier tracking
              </a>
            </dd>
          </div>
        : null}
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Carrier / retailer
          </dt>
          <dd className="mt-1 text-foreground">{company || "Not available"}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Tracking number
          </dt>
          <dd className="mt-1 font-mono text-sm text-foreground">
            {number || "Not available"}
          </dd>
        </div>
      </dl>
      {receipts.length > 0 ?
        <div className="space-y-2 border-t border-border/60 pt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Return receipt images
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {receipts.map((src) => (
              <li key={src}>
                <a href={src} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt="Return receipt"
                    className="max-h-40 w-full rounded-md border border-border object-contain"
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      : null}
    </section>
  );
}

export function DashboardProductReturnPreviewDialog({
  row,
}: {
  row: DashboardPaidOrderLineRow;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cancelling, startCancel] = useTransition();
  const fulfillment = effectiveOrderItemFulfillmentStatus(row.orderItem, row.order);
  const pending = row.pendingProductReturnRequest;
  const fulfilled = row.fulfilledProductReturnRequest;
  const returnRequest = pending ?? fulfilled;
  const canCancelReturn = Boolean(pending);
  const outcomeContext = resolveProductReturnDesiredOutcomeContext({
    fulfillmentStatus: fulfillment,
    warehouseReceivedCondition: row.orderItem.warehouseReceivedCondition,
  });

  if (
    !returnRequest &&
    fulfillment !== "product_return_awaiting_delivery"
  ) {
    return null;
  }

  const productName = row.request.productName?.trim() || "Item";
  const restoredStatusLabel = dashboardOrderLineStatusLabel(fulfillment, {
    warehouseReceivedCondition: row.orderItem.warehouseReceivedCondition,
  });

  const onConfirmCancel = () => {
    startCancel(async () => {
      const res = await cancelProductReturnRequestAction({
        orderItemId: row.orderItem.id,
      });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "mt-2 w-full",
        )}
      >
        Preview request
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle>Return request summary</DialogTitle>
          <DialogDescription className="line-clamp-2 text-sm leading-relaxed">
            {productName} · {formatUsd(row.orderItem.price)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {returnRequest ?
            <ProductReturnRequestDetails
              request={returnRequest}
              fulfilledAt={fulfilled?.fulfilledAt}
              outcomeContext={outcomeContext}
            />
          : null}
          {fulfillment === "product_return_awaiting_delivery" ?
            <StaffReturnSection row={row} />
          : pending ?
            <p className="rounded-lg border border-border/70 bg-muted/30 px-3.5 py-3 text-sm leading-relaxed text-muted-foreground">
              Our team is arranging the physical return and carrier shipment. Return
              tracking will appear here once it has been recorded.
            </p>
          : null}
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          {canCancelReturn ?
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={cancelling}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  />
                }
              >
                Cancel return request
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel return request?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This withdraws your return request for{" "}
                    <span className="font-medium text-foreground">{productName}</span>.
                    The line reverts to its current status (
                    <span className="font-medium text-foreground">
                      {restoredStatusLabel}
                    </span>
                    ) and you can submit a new return request later if needed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    render={<Button type="button" variant="outline" disabled={cancelling} />}
                  >
                    Keep return request
                  </AlertDialogCancel>
                  <AlertDialogAction
                    render={
                      <Button type="button" variant="destructive" disabled={cancelling} />
                    }
                    onClick={onConfirmCancel}
                  >
                    {cancelling ?
                      <>
                        <Loader2Icon className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                        Cancelling…
                      </>
                    : "Cancel return request"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          : <span />}
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
