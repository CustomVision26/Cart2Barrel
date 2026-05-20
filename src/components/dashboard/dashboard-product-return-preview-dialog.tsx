"use client";

import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProductReturnRequestDetails } from "@/components/dashboard/product-return-request-details";
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import { formatUsd } from "@/lib/admin-markup";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { cn } from "@/lib/utils";

function StaffReturnSection({ row }: { row: DashboardPaidOrderLineRow }) {
  const oi = row.orderItem;
  const url = oi.companyPurchaseTrackingUrl?.trim();
  const company = oi.companyPurchaseRetailerTrackingCompany?.trim();
  const number = oi.companyPurchaseRetailerTrackingNumber?.trim();
  const receipts = oi.companyPurchaseReceiptImageUrls ?? [];

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Return handled by Cart2Barrel staff
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Staff returned this product and coordinated shipping with the carrier.
      </p>
      <dl className="grid gap-2">
        {url ?
          <div>
            <dt className="text-xs text-muted-foreground">Tracking URL</dt>
            <dd>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Open tracking
              </a>
            </dd>
          </div>
        : null}
        <div>
          <dt className="text-xs text-muted-foreground">Carrier / retailer</dt>
          <dd className="text-foreground">{company || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Tracking number</dt>
          <dd className="font-mono text-foreground">{number || "—"}</dd>
        </div>
      </dl>
      {receipts.length > 0 ?
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Return receipt images</p>
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
    </div>
  );
}

export function DashboardProductReturnPreviewDialog({
  row,
}: {
  row: DashboardPaidOrderLineRow;
}) {
  const fulfillment = effectiveOrderItemFulfillmentStatus(row.orderItem, row.order);
  const pending = row.pendingProductReturnRequest;
  const fulfilled = row.fulfilledProductReturnRequest;
  const returnRequest = pending ?? fulfilled;

  if (
    !returnRequest &&
    fulfillment !== "product_return_awaiting_delivery"
  ) {
    return null;
  }

  const productName = row.request.productName?.trim() || "Item";

  return (
    <Dialog>
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
        <DialogHeader>
          <DialogTitle>Return request</DialogTitle>
          <DialogDescription>
            {productName} · line {formatUsd(row.orderItem.price)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {returnRequest ?
            <ProductReturnRequestDetails
              request={returnRequest}
              fulfilledAt={fulfilled?.fulfilledAt}
            />
          : null}
          {fulfillment === "product_return_awaiting_delivery" ?
            <StaffReturnSection row={row} />
          : pending ?
            <p className="text-sm text-muted-foreground">
              Staff are arranging the physical return and carrier shipment. Tracking will
              appear here when it is saved.
            </p>
          : null}
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
