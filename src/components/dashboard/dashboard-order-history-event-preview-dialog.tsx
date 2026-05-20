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
import { ItemRequestLineSnapshotPreviewPanel } from "@/components/orders/item-request-line-snapshot-preview-panel";
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import { dashboardOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { displaySiteName } from "@/lib/site-name";
import { cn } from "@/lib/utils";

export type OrderHistoryTimelinePreview =
  | {
      kind: "snapshot";
      snapshot: ItemRequestLineSnapshot;
      prevSnapshot: ItemRequestLineSnapshot | null;
    }
  | { kind: "checkout_fallback"; row: DashboardPaidOrderLineRow }
  | { kind: "current"; row: DashboardPaidOrderLineRow };

function CheckoutFallbackPreviewPanel({ row }: { row: DashboardPaidOrderLineRow }) {
  const request = row.request;
  return (
    <div className="space-y-4 text-sm">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Checkout was recorded before a detailed snapshot row existed. These fields
        reflect your paid order line at checkout time.
      </p>
      <dl className="grid gap-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Checked out
          </dt>
          <dd>
            <time dateTime={row.order.createdAt}>
              {new Date(row.order.createdAt).toLocaleString()}
            </time>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Line total
          </dt>
          <dd className="font-medium tabular-nums">{formatUsd(row.orderItem.price)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Product
          </dt>
          <dd className="font-medium">{request.productName?.trim() || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Site
          </dt>
          <dd>{displaySiteName(request.siteName, request.productUrl)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Qty
          </dt>
          <dd className="tabular-nums">{row.orderItem.quantity}</dd>
        </div>
      </dl>
    </div>
  );
}

function CurrentStatusPreviewPanel({ row }: { row: DashboardPaidOrderLineRow }) {
  const fulfillment = effectiveOrderItemFulfillmentStatus(row.orderItem, row.order);
  const oi = row.orderItem;
  const trackingUrl = oi.companyPurchaseTrackingUrl?.trim();
  const company = oi.companyPurchaseRetailerTrackingCompany?.trim();
  const number = oi.companyPurchaseRetailerTrackingNumber?.trim();

  return (
    <div className="space-y-4 text-sm">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Live fulfillment fields saved on this order line (not a frozen snapshot row).
      </p>
      <dl className="grid gap-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fulfillment status
          </dt>
          <dd className="font-medium text-foreground">
            {dashboardOrderLineStatusLabel(fulfillment, {
              pendingRefundRequest: row.pendingRefundRequest != null,
              pendingProductReturnRequest: row.pendingProductReturnRequest != null,
              fulfilledProductReturnRequest: row.fulfilledProductReturnRequest,
              refundedCents: row.refundedCents,
              linePriceCents: row.orderItem.price,
            })}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Line total
          </dt>
          <dd className="tabular-nums font-medium">{formatUsd(oi.price)}</dd>
        </div>
        {row.refundedCents > 0 ?
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Refunded to date
            </dt>
            <dd className="tabular-nums font-medium">{formatUsd(row.refundedCents)}</dd>
          </div>
        : null}
        {trackingUrl || company || number ?
          <>
            {trackingUrl ?
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tracking URL
                </dt>
                <dd>
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Open tracking
                  </a>
                </dd>
              </div>
            : null}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Carrier / retailer
              </dt>
              <dd>{company || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tracking number
              </dt>
              <dd className="font-mono">{number || "—"}</dd>
            </div>
          </>
        : null}
        {row.pendingRefundRequest ?
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Refund request
            </dt>
            <dd>Awaiting staff approval</dd>
          </div>
        : null}
        {row.pendingProductReturnRequest ?
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Return request
            </dt>
            <dd>Submitted — awaiting staff</dd>
          </div>
        : null}
      </dl>
    </div>
  );
}

export function DashboardOrderHistoryEventPreviewDialog({
  eventLabel,
  eventHeadline,
  preview,
}: {
  eventLabel: string;
  eventHeadline: string;
  preview: OrderHistoryTimelinePreview;
}) {
  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "shrink-0",
        )}
      >
        Preview
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{eventHeadline}</DialogTitle>
          <DialogDescription>{eventLabel}</DialogDescription>
        </DialogHeader>

        {preview.kind === "snapshot" ?
          <ItemRequestLineSnapshotPreviewPanel
            row={preview.snapshot}
            prevRow={preview.prevSnapshot}
          />
        : preview.kind === "checkout_fallback" ?
          <CheckoutFallbackPreviewPanel row={preview.row} />
        : <CurrentStatusPreviewPanel row={preview.row} />}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
