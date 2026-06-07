"use client";

import { ChevronDown } from "lucide-react";
import { Fragment, useState } from "react";

import { ProductHistoryTrackRecord } from "@/components/dashboard/product-history-track-record";
import { ReinstateProductButton } from "@/components/dashboard/reinstate-product-button";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import {
  BatchEstimateRecordDialogButton,
  SingleEstimateRecordsDialogButton,
} from "@/components/orders/product-estimate-record-buttons";
import { StatusBadge } from "@/components/ui/status-badge";
import type { OwnerBatchQuoteSessionBundle } from "@/data/batch-quote-sessions";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
import type {
  ItemQuote,
  ItemRequest,
  ItemRequestLineSnapshot,
  OutsidePurchaseReturnRequest,
} from "@/db/schema";
import { isBatchCheckoutBundle } from "@/lib/batch-checkout";
import {
  computeBatchLineShares,
  type BatchLineShare,
} from "@/lib/batch-line-share";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { resolveProductHistoryStatusDisplay } from "@/lib/product-history-status";
import { displaySiteName } from "@/lib/site-name";
import {
  dashItemsTableRowExpanded,
  dashItemsTableRowHover,
} from "@/lib/app-table-surfaces";
import { cn } from "@/lib/utils";

function latestActivityMs(
  request: ItemRequest,
  snapshots: ItemRequestLineSnapshot[],
  quotes: ItemQuote[],
): number {
  const times = [
    new Date(request.createdAt).getTime(),
    ...snapshots.map((s) => new Date(s.createdAt).getTime()),
    ...quotes.map((q) => new Date(q.createdAt).getTime()),
  ].filter(Number.isFinite);
  return Math.max(...times);
}

export function ProductHistoryTableRow({
  request,
  snapshots,
  quotes,
  quotesByRequestId = {},
  bundle,
  fulfillmentLabelOverride,
  returnRequest,
  orderContext,
}: {
  request: ItemRequest;
  snapshots: ItemRequestLineSnapshot[];
  quotes: ItemQuote[];
  quotesByRequestId?: Record<string, ItemQuote[]>;
  bundle?: OwnerBatchQuoteSessionBundle;
  fulfillmentLabelOverride?: string | null;
  returnRequest?: OutsidePurchaseReturnRequest | null;
  orderContext?: ItemRequestOrderContext | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const outsidePurchase = isOutsidePurchaseRequest(request);
  const latestEstimate = bundle?.latestEstimate ?? null;
  const batchShare: BatchLineShare | null =
    bundle && latestEstimate ?
      (computeBatchLineShares(
        latestEstimate,
        bundle.requests.map((r) => r.id),
        (id) => {
          const list = quotesByRequestId[id] ?? [];
          if (list.length === 0) return null;
          return (
            [...list].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )[0] ?? null
          );
        },
      ).get(request.id) ?? null)
    : null;
  const status = resolveProductHistoryStatusDisplay(request, snapshots, {
    returnRequest,
    fulfillmentLabelOverride,
    orderContext,
    audience: "customer",
  });
  const activityMs = latestActivityMs(request, snapshots, quotes);
  const productName = request.productName?.trim() || "Unnamed product";
  const batchCheckout = isBatchCheckoutBundle(bundle);

  return (
    <Fragment>
      <tr className={cn("border-b border-border", dashItemsTableRowHover)}>
        <td className="w-10 px-2 py-3 align-top">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 bg-card text-foreground hover:bg-accent"
            aria-expanded={expanded}
            aria-label={
              expanded ?
                "Collapse status timeline for this product"
              : "Expand status timeline for this product"
            }
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                expanded ? "rotate-180" : "rotate-0",
              )}
            />
          </button>
        </td>
        <td className="min-w-[14rem] px-3 py-3 align-top">
          <div className="flex min-w-0 gap-3">
            <ProductRequestThumbnail
              variant="cart"
              imageUrl={request.productImageUrl}
              productLabel={productName}
              className="w-14 max-w-14 shrink-0"
            />
            <div className="min-w-0 space-y-1">
              <p className="line-clamp-2 font-medium leading-snug text-foreground">
                {productName}
              </p>
              <p className="text-xs text-muted-foreground">
                {displaySiteName(request.siteName, request.productUrl)}
                {bundle ? ` · Batch ${bundle.session.batchNumber}` : ""}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {request.id}
              </p>
            </div>
          </div>
        </td>
        <td className="min-w-[10rem] px-3 py-3 align-top">
          <StatusBadge kind={status.badgeKind} title={status.title}>
            {status.label}
          </StatusBadge>
        </td>
        <td className="whitespace-nowrap px-3 py-3 align-top text-sm text-muted-foreground">
          <time dateTime={new Date(activityMs).toISOString()}>
            {new Date(activityMs).toLocaleString()}
          </time>
        </td>
        <td className="min-w-[10rem] px-3 py-3 align-top">
          <div className="flex flex-wrap gap-2">
            {request.status === "withdrawn" ?
              <ReinstateProductButton
                itemRequestId={request.id}
                productLabel={request.productName}
                isOutsidePurchase={outsidePurchase}
                paymentPrompted={Boolean(request.outsidePurchasePaymentPromptedAt)}
              />
            : null}
            <SingleEstimateRecordsDialogButton
              quotes={quotes}
              batchCheckout={batchCheckout}
            />
            {bundle ?
              <BatchEstimateRecordDialogButton
                batchNumber={bundle.session.batchNumber}
                request={request}
                productName={productName}
                batchShare={batchShare}
                latestEstimate={latestEstimate}
                statusEvents={bundle.statusEvents}
                sessionCreatedAt={bundle.session.createdAt}
              />
            : null}
          </div>
        </td>
      </tr>
      {expanded ?
        <tr className={dashItemsTableRowExpanded}>
          <td colSpan={5} className="px-4 py-4">
            <ProductHistoryTrackRecord
              request={request}
              snapshots={snapshots}
              quotes={quotes}
              batchShare={batchShare}
              batchEstimateNote={latestEstimate?.staffNote ?? null}
              fulfillmentLabelOverride={fulfillmentLabelOverride}
              returnRequest={returnRequest}
              orderContext={orderContext}
              statusLabel={status.label}
              defaultOpen
            />
          </td>
        </tr>
      : null}
    </Fragment>
  );
}
