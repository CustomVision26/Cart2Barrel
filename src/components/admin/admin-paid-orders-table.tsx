import Link from "next/link";

import { FlagIcon, Package } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { AdminOrderEstimateSummary } from "@/components/admin/admin-order-estimate-summary";
import { AdminOrderLineActions } from "@/components/admin/admin-order-line-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { CollapsibleOrderBatchBucket } from "@/components/orders/collapsible-order-batch-bucket";
import { CollapsibleOrderTableSection } from "@/components/orders/collapsible-order-table-section";
import { PaidOrderAccordionRoot } from "@/components/orders/paid-order-accordion";
import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import type { AdminPaidOrderLineRow } from "@/data/admin-order-lines";
import type { OrderContainerLineAdmin } from "@/data/order-container-admin";
import type {
  BatchQuoteEstimate,
  ItemQuote,
  ItemRequestLineSnapshot,
} from "@/db/schema";
import { batchEstimateSummaryRows } from "@/lib/admin-order-estimate-summary-rows";
import { formatUsd } from "@/lib/admin-markup";
import {
  containerOfferingKindLabel,
  parseContainerOfferingKind,
} from "@/lib/validations/container-offering";
import {
  groupPaidRowsStableByOrder,
  partitionPaidLinesIntoBatchBuckets,
} from "@/lib/partition-paid-order-batch-groups";
import { BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID } from "@/lib/barrel-pipeline-fulfillment";
import { adminOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { effectiveOutsidePurchasePaidFulfillment } from "@/lib/outside-purchase-order-fulfillment";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { orderItemFulfillmentBadgeKind } from "@/lib/status-badge-map";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { displaySiteName } from "@/lib/site-name";
import {
  adminCustomerDisplayLabel,
  adminCustomerSortKey,
} from "@/lib/admin-customer-group";
import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { cn } from "@/lib/utils";

const EMPTY_ORDER_CONTAINERS: Record<string, OrderContainerLineAdmin[]> = {};

function subgroupColSpan(): number {
  return 13;
}

function customerLabel(row: AdminPaidOrderLineRow): string {
  return adminCustomerDisplayLabel({
    fullName: row.customerFullName,
    email: row.customerEmail,
    clerkUserId: row.order.clerkUserId,
  });
}

function groupPaidRowsByCustomer(rows: AdminPaidOrderLineRow[]) {
  const byClerk = new Map<string, AdminPaidOrderLineRow[]>();
  for (const row of rows) {
    const id = row.order.clerkUserId;
    const list = byClerk.get(id);
    if (list) list.push(row);
    else byClerk.set(id, [row]);
  }
  const out = [...byClerk.entries()].map(([clerkUserId, customerRows]) => {
    const first = customerRows[0]!;
    const sortKey = adminCustomerSortKey({
      fullName: first.customerFullName,
      email: first.customerEmail,
      clerkUserId,
    });
    const displayLabel = adminCustomerDisplayLabel({
      fullName: first.customerFullName,
      email: first.customerEmail,
      clerkUserId,
    });
    return {
      clerkUserId,
      sortKey,
      displayLabel,
      orderGroups: groupPaidRowsStableByOrder(customerRows),
    };
  });
  out.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return out;
}

/** Lines awaiting company purchase (highlight + batch banner; Ops → Review and approve). */
function lineShowsPurchaseAction(row: AdminPaidOrderLineRow): boolean {
  if (isOutsidePurchaseRequest(row.request)) {
    return false;
  }
  const fulfillment = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order,
  );
  if (
    fulfillment === "refunded" ||
    fulfillment === "pending_payment"
  ) {
    return false;
  }
  const refundable = Math.max(0, row.orderItem.price - row.refundedCents);
  return (
    fulfillment === "paid_pending_company_purchase" && refundable > 0
  );
}

export function AdminPaidOrdersTable({
  rows,
  snapshotsByRequestId = {},
  orderAccordionResetKey,
  latestQuotesByRequestId = {},
  batchEstimatesBySessionId = {},
  orderContainerLinesByOrderId = EMPTY_ORDER_CONTAINERS,
}: {
  rows: AdminPaidOrderLineRow[];
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
  /** Per request id: latest operational quote (purchase review + single-line estimate). */
  latestQuotesByRequestId?: Record<string, ItemQuote>;
  /** Per batch session id: checkout batch estimate roll-up. */
  batchEstimatesBySessionId?: Record<string, BatchQuoteEstimate>;
  /** Per order id: barrel/container checkout lines from the same paid order. */
  orderContainerLinesByOrderId?: Record<string, OrderContainerLineAdmin[]>;
  /** Paging/search/sort key so only one order stays expanded across result-set changes. */
  orderAccordionResetKey: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No orders on this page.
      </p>
    );
  }

  const customerOrderGroups = groupPaidRowsByCustomer(rows);
  const initialExpandedOrderId =
    customerOrderGroups[0]?.orderGroups[0]?.order.id ?? null;

  return (
    <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border">
      <table className="w-full min-w-[72rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className="px-3 py-2.5 font-medium text-foreground">Photo</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Quote source</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Product</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Customer</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Site</th>
            <th className="px-3 py-2.5 font-medium text-foreground">URL</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Qty</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Line total</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Refunded</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Status</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Ops</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Audit</th>
            <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
              Paid / created
            </th>
          </tr>
        </thead>
        <PaidOrderAccordionRoot
          resetKey={orderAccordionResetKey}
          initialExpandedOrderId={initialExpandedOrderId}
        >
          {customerOrderGroups.map(
            ({ clerkUserId, displayLabel, orderGroups }) => (
              <Fragment key={clerkUserId}>
              <tbody>
                <tr className="border-b border-border bg-muted/50">
                  <td
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground"
                    colSpan={subgroupColSpan()}
                  >
                    Customer · {displayLabel}
                  </td>
                </tr>
              </tbody>
              {orderGroups.map(({ order, lines }) => (
                <OrderBlock
                  key={order.id}
                  order={order}
                  lines={lines}
                  snapshotsByRequestId={snapshotsByRequestId}
                  latestQuotesByRequestId={latestQuotesByRequestId}
                  batchEstimatesBySessionId={batchEstimatesBySessionId}
                  containerLines={orderContainerLinesByOrderId[order.id] ?? []}
                />
              ))}
            </Fragment>
          ),
          )}
        </PaidOrderAccordionRoot>
      </table>
    </FloatingHorizontalScroll>
  );
}

function OrderBlock({
  order,
  lines,
  snapshotsByRequestId,
  latestQuotesByRequestId,
  batchEstimatesBySessionId,
  containerLines,
}: {
  order: AdminPaidOrderLineRow["order"];
  lines: AdminPaidOrderLineRow[];
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
  latestQuotesByRequestId?: Record<string, ItemQuote>;
  batchEstimatesBySessionId?: Record<string, BatchQuoteEstimate>;
  containerLines: OrderContainerLineAdmin[];
}) {
  const quotesByRequestId = latestQuotesByRequestId ?? {};
  const estimatesBySessionId = batchEstimatesBySessionId ?? {};
  const buckets = partitionPaidLinesIntoBatchBuckets(lines);
  const hasBatchMix = buckets.some((b) => b.kind === "batch");
  const hasSinglesMix = buckets.some((b) => b.kind === "single");
  const onlySinglesSubgroup = buckets.length === 1 && buckets[0]!.kind === "single";
  const productLineCount = lines.length;
  const totalLineCount = productLineCount + containerLines.length;
  const customerLabelForContainers =
    lines[0] != null ? customerLabel(lines[0]) : "—";

  return (
    <CollapsibleOrderTableSection
      orderId={order.id}
      colSpan={subgroupColSpan()}
      lineCount={totalLineCount}
      summaryContent={
        <>
          <span className="min-w-0 font-medium text-foreground">
            Order{" "}
            <span className="inline-block font-mono text-xs leading-snug text-primary break-all">
              {order.id}
            </span>
          </span>
          <span className="inline-flex items-center rounded-full border border-border/80 bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-foreground">
            Order {order.status}
          </span>
          <span className="tabular-nums text-foreground">
            Total {formatUsd(order.totalAmount)}
          </span>
          <span className="tabular-nums">
            <time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleString()}</time>
          </span>
          <span className="hidden text-muted-foreground sm:inline">
            · {totalLineCount === 1 ? "1 line" : `${totalLineCount} lines`}
          </span>
        </>
      }
    >
      {onlySinglesSubgroup ?
        buckets[0]!.lines.map((row) => (
          <AdminOrderDataRow
            key={row.orderItem.id}
            row={row}
            snapshotsByRequestId={snapshotsByRequestId}
            latestQuotesByRequestId={quotesByRequestId}
          />
        ))
      : buckets.map((bucket, bi) => {
          if (bucket.kind === "batch") {
            const batchEstimate =
              estimatesBySessionId[bucket.batchSessionId] ?? null;
            return (
              <CollapsibleOrderBatchBucket
                key={bucket.batchSessionId}
                colSpan={subgroupColSpan()}
                title={
                  <>
                    Batch{" "}
                    <span className="font-mono text-xs text-primary">
                      {bucket.batchNumber ?? bucket.batchSessionId.slice(0, 8) + "…"}
                    </span>
                    {" · session "}
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {bucket.batchSessionId.slice(0, 8)}…
                    </span>
                    {" · "}
                    {bucket.lines.length} {bucket.lines.length === 1 ? "product" : "products"}
                  </>
                }
                headerAside={(() => {
                  const pend = bucket.lines.filter(lineShowsPurchaseAction).length;
                  if (pend === 0) return null;
                  return (
                    <span
                      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-amber-500/45 bg-amber-500/[0.12] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200"
                      title="At least one line still needs purchase approval in Ops (Review and approve)."
                    >
                      <FlagIcon
                        className="size-3 shrink-0 text-amber-400"
                        aria-hidden
                      />
                      <span>Purchase pending</span>
                      <span className="tabular-nums opacity-90">
                        ({pend}/{bucket.lines.length})
                      </span>
                    </span>
                  );
                })()}
                estimateSummary={
                  batchEstimate ?
                    <AdminOrderEstimateSummary
                      rows={batchEstimateSummaryRows(batchEstimate)}
                    />
                  : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No batch estimate on file.
                    </p>
                  )
                }
              >
                {bucket.lines.map((row) => (
                  <AdminOrderDataRow
                    key={row.orderItem.id}
                    row={row}
                    snapshotsByRequestId={snapshotsByRequestId}
                    latestQuotesByRequestId={quotesByRequestId}
                    inBatchGroup
                  />
                ))}
              </CollapsibleOrderBatchBucket>
            );
          }
          return (
            <CollapsibleOrderBatchBucket
              key={`single:${order.id}:${bi}`}
              colSpan={subgroupColSpan()}
              title={hasBatchMix && hasSinglesMix ? "Single items" : "Single"}
              muted={!(hasBatchMix && hasSinglesMix)}
            >
              {bucket.lines.map((row) => (
                <AdminOrderDataRow
                  key={row.orderItem.id}
                  row={row}
                  snapshotsByRequestId={snapshotsByRequestId}
                  latestQuotesByRequestId={quotesByRequestId}
                />
              ))}
            </CollapsibleOrderBatchBucket>
          );
        })
      }
      {containerLines.length > 0 ?
        <CollapsibleOrderBatchBucket
          colSpan={subgroupColSpan()}
          title="Shipping containers"
          muted
        >
          {containerLines.map((c) => (
            <AdminOrderContainerLineRow
              key={c.id}
              row={c}
              customerLabelText={customerLabelForContainers}
              orderCreatedAt={order.createdAt}
            />
          ))}
        </CollapsibleOrderBatchBucket>
      : null}
    </CollapsibleOrderTableSection>
  );
}

function AdminOrderContainerLineRow({
  row,
  customerLabelText,
  orderCreatedAt,
}: {
  row: OrderContainerLineAdmin;
  customerLabelText: string;
  orderCreatedAt: string;
}) {
  return (
    <tr className="align-top bg-muted/15">
      <td className="px-3 py-3 align-top">
        <span className="flex size-12 items-center justify-center rounded-md border border-border/60 bg-muted/30 text-muted-foreground">
          <Package className="size-6 shrink-0" aria-hidden />
        </span>
      </td>
      <td className="max-w-[11rem] px-3 py-3 align-top text-muted-foreground">
        <span className="inline-flex rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
          Container
        </span>
      </td>
      <td className="max-w-[10rem] px-3 py-3 align-top font-medium text-foreground">
        <span className="line-clamp-2">{row.nameSnapshot}</span>
        <p className="mt-1 text-xs text-muted-foreground">
          {containerOfferingKindLabel(parseContainerOfferingKind(row.kindSnapshot))} ·{" "}
          {row.sizeSnapshot}
        </p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground" title={row.id}>
          Line {row.id.slice(0, 8)}…
        </p>
      </td>
      <td className="max-w-[10rem] px-3 py-3 align-top text-muted-foreground">
        <span className="line-clamp-2 text-xs sm:text-sm">{customerLabelText}</span>
      </td>
      <td className="max-w-[8rem] px-3 py-3 align-top text-muted-foreground">
        <span className="text-sm">—</span>
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top text-muted-foreground">—</td>
      <td className="px-3 py-3 align-top tabular-nums text-muted-foreground">{row.quantity}</td>
      <td className="px-3 py-3 align-top font-medium tabular-nums text-foreground">
        {formatUsd(row.lineTotalCents)}
      </td>
      <td className="px-3 py-3 align-top tabular-nums text-muted-foreground">—</td>
      <td className="max-w-[11rem] px-3 py-3 align-top">
        <span className="text-xs text-muted-foreground">Checkout merchandise</span>
      </td>
      <td className="px-3 py-3 align-top text-muted-foreground">—</td>
      <td className="px-3 py-3 align-top text-muted-foreground">—</td>
      <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-muted-foreground">
        <time dateTime={orderCreatedAt}>{new Date(orderCreatedAt).toLocaleString()}</time>
      </td>
    </tr>
  );
}

function quotedMerchandiseCostCents(
  latestQuotesByRequestId: Record<string, ItemQuote> | undefined,
  requestId: string,
): number | null {
  return latestQuotesByRequestId?.[requestId]?.itemCost ?? null;
}

function AdminOrderDataRow(props: {
  row: AdminPaidOrderLineRow;
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
  latestQuotesByRequestId?: Record<string, ItemQuote>;
  /** Renders each batch member as its own product row (batch roll-up stays in section header). */
  inBatchGroup?: boolean;
}) {
  const {
    row,
    snapshotsByRequestId,
    latestQuotesByRequestId = {},
    inBatchGroup = false,
  } = props;
  const r = row.request;
  const isOutside = isOutsidePurchaseRequest(r);
  const fulfillment = effectiveOutsidePurchasePaidFulfillment(
    r,
    row.orderItem,
    row.order,
  );
  const outsidePurchasePaidServiceFee =
    fulfillment === BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID;
  const purchaseFlag = lineShowsPurchaseAction(row);
  const pendingProductReturn = row.pendingProductReturnRequest != null;
  const isBatch =
    !inBatchGroup &&
    (!!(row.resolvedBatchSessionId && row.resolvedBatchSessionId.trim()) ||
      !!(row.resolvedBatchNumber && row.resolvedBatchNumber.trim()));

  const batchDialogLabel =
    isBatch ?
      row.resolvedBatchNumber?.trim() ||
      (row.resolvedBatchSessionId?.trim() ?
        `${row.resolvedBatchSessionId.trim().slice(0, 8)}…`
      : null)
    : null;

  const purchaseReviewContext =
    fulfillment === "paid_pending_company_purchase" ?
      {
        retailerLabel: displaySiteName(r.siteName, r.productUrl),
        quotedMerchandiseCostCents: quotedMerchandiseCostCents(
          latestQuotesByRequestId,
          r.id,
        ),
        productLabel: r.productName?.trim() || "Item",
        quantity: row.orderItem.quantity,
        sizeLabel: r.productSize?.trim() ?? null,
        colorLabel: r.productColor?.trim() ?? null,
        batchLabel: batchDialogLabel,
      }
    : null;

  return (
    <tr
      className={cn(
        "align-top",
        isBatch &&
          purchaseFlag &&
          "bg-amber-500/[0.04] shadow-[inset_3px_0_0_rgb(251_146_60_/_0.75)]",
        row.pendingRefundRequest != null &&
          "shadow-[inset_3px_0_0_rgb(167_139_250_/_0.65)] bg-violet-500/[0.05]",
      )}
    >
      <td className="px-3 py-3 align-top">
        <ProductRequestThumbnail
          variant="admin"
          imageUrl={r.productImageUrl}
          productLabel={r.productName}
        />
      </td>
      <td className="max-w-[11rem] px-3 py-3 align-top text-muted-foreground">
        {inBatchGroup ?
          <div className="space-y-1">
            {purchaseFlag ?
              <span
                className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-100"
                title="Confirm purchase via Ops · Review and approve after your team buys from the retailer."
              >
                <FlagIcon className="size-3 shrink-0 text-amber-400" aria-hidden />
                Needs purchase
              </span>
            : (
              <span className="text-sm italic text-muted-foreground">Batch item</span>
            )}
          </div>
        : isBatch ?
          <div className="space-y-1">
            {purchaseFlag ?
              <span
                className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-100"
                title="Confirm purchase via Ops · Review and approve after your team buys from the retailer."
              >
                <FlagIcon className="size-3 shrink-0 text-amber-400" aria-hidden />
                Needs purchase
              </span>
            : null}
            <span className="inline-flex rounded-md border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
              Batch bundle
            </span>
            <p
              className="font-mono text-sm font-medium text-foreground"
              title={row.resolvedBatchSessionId ?? undefined}
            >
              {row.resolvedBatchNumber ?? "—"}
            </p>
          </div>
        : (
          <span className="text-sm italic text-muted-foreground">Single product</span>
        )}
      </td>
      <td className="max-w-[10rem] px-3 py-3 align-top font-medium text-foreground">
        <span className="line-clamp-2">{r.productName?.trim() || "Unnamed product"}</span>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground" title={r.id}>
          Req {r.id.slice(0, 8)}…
        </p>
      </td>
      <td className="max-w-[10rem] px-3 py-3 align-top text-muted-foreground">
        <span className="line-clamp-2 text-xs sm:text-sm">{customerLabel(row)}</span>
      </td>
      <td className="max-w-[8rem] px-3 py-3 align-top text-muted-foreground">
        <span className="line-clamp-2 text-xs sm:text-sm">
          {displaySiteName(r.siteName, r.productUrl)}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top">
        <Link
          href={r.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          Open
        </Link>
      </td>
      <td className="px-3 py-3 align-top tabular-nums text-muted-foreground">
        {row.orderItem.quantity}
      </td>
      <td className="px-3 py-3 align-top font-medium tabular-nums text-foreground">
        {formatUsd(row.orderItem.price)}
      </td>
      <td className="px-3 py-3 align-top tabular-nums text-muted-foreground">
        {row.refundedCents > 0 ?
          <>
            {formatUsd(row.refundedCents)}
            {row.refundedCents < row.orderItem.price ?
              <span className="mt-0.5 block text-xs">
                Net {formatUsd(row.orderItem.price - row.refundedCents)}
              </span>
            : null}
          </>
        : "—"}
      </td>
      <td className="max-w-[11rem] px-3 py-3 align-top">
        <StatusBadge
          kind={orderItemFulfillmentBadgeKind(row.orderItem, row.order, {
            pendingRefundRequest: row.pendingRefundRequest != null,
            pendingProductReturnRequest: pendingProductReturn,
            fulfillmentOverride: fulfillment,
          })}
          title={fulfillment}
        >
          {adminOrderLineStatusLabel(fulfillment, {
            pendingRefundRequest: row.pendingRefundRequest != null,
            pendingProductReturnRequest: pendingProductReturn,
            fulfilledProductReturnRequest: row.fulfilledProductReturnRequest,
            refundedCents: row.refundedCents,
            linePriceCents: row.orderItem.price,
            warehouseReceivedCondition: row.orderItem.warehouseReceivedCondition,
          })}
        </StatusBadge>
      </td>
      <td className="px-3 py-3 align-top">
        {outsidePurchasePaidServiceFee ?
          <span className="text-xs text-muted-foreground">—</span>
        : <AdminOrderLineActions
            orderItemId={row.orderItem.id}
            fulfillmentStatus={fulfillment}
            linePriceCents={row.orderItem.price}
            refundedCents={row.refundedCents}
            productLabel={r.productName?.trim() || "Item"}
            orderNumber={row.order.id}
            batchNumber={row.resolvedBatchNumber}
            batchSessionId={row.resolvedBatchSessionId}
            purchaseReviewContext={purchaseReviewContext}
            purchaseTracking={{
              trackingUrl: row.orderItem.companyPurchaseTrackingUrl,
              retailerTrackingCompany:
                row.orderItem.companyPurchaseRetailerTrackingCompany,
              retailerTrackingNumber:
                row.orderItem.companyPurchaseRetailerTrackingNumber,
            }}
            retailerReceiptImageUrls={row.orderItem.companyPurchaseReceiptImageUrls}
            pendingRefundRequest={row.pendingRefundRequest}
            pendingProductReturnRequest={row.pendingProductReturnRequest}
            fulfilledProductReturnRequest={row.fulfilledProductReturnRequest}
          />
        }
      </td>
      <td className="px-3 py-3 align-top">
        <ItemRequestLineAuditDialog
          itemRequestId={r.id}
          productLabel={r.productName?.trim() || ""}
          snapshots={snapshotsByRequestId[r.id] ?? []}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-muted-foreground">
        <time dateTime={row.order.createdAt}>
          {new Date(row.order.createdAt).toLocaleString()}
        </time>
      </td>
    </tr>
  );
}
