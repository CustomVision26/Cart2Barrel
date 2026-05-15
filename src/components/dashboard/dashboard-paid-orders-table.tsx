"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { toast } from "sonner";

import { submitCustomerWarehouseReceiptAction } from "@/actions/submit-customer-warehouse-receipt";
import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import {
  CONDITION_OPTIONS,
  type WarehouseReceiveCondition,
  receivingConditionSelectClassName,
  ReceivingRowActions,
} from "@/components/admin/receiving-row-actions";
import { WarehouseBarcodeImageField } from "@/components/orders/warehouse-barcode-image-field";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { CollapsibleOrderTableSection } from "@/components/orders/collapsible-order-table-section";
import { PaidOrderAccordionRoot } from "@/components/orders/paid-order-accordion";
import { DashboardOrderLineTracking } from "@/components/dashboard/dashboard-order-line-tracking";
import { DashboardRequestRefundDialog } from "@/components/dashboard/dashboard-request-refund-dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import type { OrderListCore } from "@/data/order-list-select";
import { formatUsd } from "@/lib/admin-markup";
import { dashboardOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import {
  groupPaidRowsStableByOrder,
  partitionPaidLinesIntoBatchBuckets,
} from "@/lib/partition-paid-order-batch-groups";
import { orderItemFulfillmentBadgeKind } from "@/lib/status-badge-map";
import { displaySiteName } from "@/lib/site-name";
import { canSubmitWarehouseReceiptForFulfillment } from "@/lib/warehouse-receipt-queue";

function subgroupColSpan(): number {
  return 13;
}

function receiveLineLabel(row: DashboardPaidOrderLineRow): string {
  return `Order ${row.order.id.slice(0, 8)}… · Item ${row.orderItem.id.slice(0, 8)}…`;
}

function isReceiveCondition(
  v: string | null | undefined,
): v is WarehouseReceiveCondition {
  return (
    v === "good" ||
    v === "damaged" ||
    v === "missing" ||
    v === "wrong_item"
  );
}

type ReceiveDraft = {
  receivedQty: number;
  condition: WarehouseReceiveCondition;
  shelfLocation: string;
  proofFileCount: number;
  barcodeValue: string;
};

function receiveDraftFromRow(row: DashboardPaidOrderLineRow): ReceiveDraft {
  const oi = row.orderItem;
  if (oi.warehouseReceivedAt) {
    const cond = isReceiveCondition(oi.warehouseReceivedCondition) ?
        oi.warehouseReceivedCondition
      : "good";
    return {
      receivedQty: oi.warehouseReceivedQty ?? oi.quantity,
      condition: cond,
      shelfLocation: oi.warehouseShelfLocation ?? "",
      proofFileCount: oi.warehouseReceivedProofPhotoCount ?? 0,
      barcodeValue: oi.warehouseReceivedBarcode ?? "",
    };
  }
  return {
    receivedQty: oi.quantity,
    condition: "good",
    shelfLocation: "",
    proofFileCount: 0,
    barcodeValue: "",
  };
}

function rowSelectable(row: DashboardPaidOrderLineRow): boolean {
  const fulfillment = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order,
  );
  const net = row.orderItem.price - row.refundedCents;
  return canSubmitWarehouseReceiptForFulfillment(fulfillment) && net > 0;
}

function dashboardShowLineTracking(row: DashboardPaidOrderLineRow): boolean {
  const fulfillment = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order,
  );
  const oi = row.orderItem;
  if (fulfillment === "company_purchase_pending_delivery") return true;
  if (fulfillment === "delivery_requested_pending_fulfillment") return true;
  if (
    fulfillment === "delivery_received_item_missing" ||
    fulfillment === "delivery_received_item_damaged" ||
    fulfillment === "delivery_received_wrong_item"
  ) {
    return true;
  }
  if (fulfillment === "delivery_received_good_awaiting_barrel") {
    return !!(
      oi.companyPurchaseTrackingUrl?.trim() ||
      oi.companyPurchaseRetailerTrackingNumber?.trim() ||
      oi.companyPurchaseRetailerTrackingCompany?.trim()
    );
  }
  if (fulfillment === "product_return_awaiting_delivery") return true;
  return false;
}

export function DashboardPaidOrdersTable({
  rows,
  snapshotsByRequestId = {},
  orderAccordionResetKey,
}: {
  rows: DashboardPaidOrderLineRow[];
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
  orderAccordionResetKey: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ReceiveDraft>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savePending, startSave] = useTransition();

  const selectableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rows) {
      if (rowSelectable(r)) ids.add(r.orderItem.id);
    }
    return ids;
  }, [rows]);

  const allSelectableSelected =
    selectableIds.size > 0 &&
    [...selectableIds].every((id) => selected.has(id));

  const selectedCount = useMemo(() => {
    let n = 0;
    for (const id of selected) {
      if (selectableIds.has(id)) n += 1;
    }
    return n;
  }, [selected, selectableIds]);

  const toggleRow = useCallback((orderItemId: string) => {
    if (!selectableIds.has(orderItemId)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderItemId)) next.delete(orderItemId);
      else next.add(orderItemId);
      return next;
    });
  }, [selectableIds]);

  const toggleAllSelectable = useCallback(() => {
    setSelected((prev) => {
      if (selectableIds.size === 0) return prev;
      const next = new Set(prev);
      if (allSelectableSelected) {
        for (const id of selectableIds) next.delete(id);
      } else {
        for (const id of selectableIds) next.add(id);
      }
      return next;
    });
  }, [selectableIds, allSelectableSelected]);

  const selectedInTableOrder = useMemo(
    () =>
      rows
        .map((r) => r.orderItem.id)
        .filter((id) => selected.has(id) && selectableIds.has(id)),
    [rows, selected, selectableIds],
  );

  const openReceiveDialog = () => {
    const nextDrafts: Record<string, ReceiveDraft> = {};
    for (const row of rows) {
      const id = row.orderItem.id;
      if (!selected.has(id) || !selectableIds.has(id)) continue;
      nextDrafts[id] = receiveDraftFromRow(row);
    }
    setDrafts(nextDrafts);
    setReceiveOpen(true);
  };

  const updateDraft = (orderItemId: string, patch: Partial<ReceiveDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [orderItemId]: { ...prev[orderItemId], ...patch },
    }));
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No orders on this page.
      </p>
    );
  }

  const orderGroups = groupPaidRowsStableByOrder(rows);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          When your package arrives, select the line
          {selectableIds.size !== 1 ? "s" : ""} and use{" "}
          <span className="font-medium text-foreground">Received delivery</span>{" "}
          to confirm quantity and condition. Submitting adds a snapshot to the line audit trail and
          updates fulfillment status.
        </p>
        <Button
          type="button"
          size="sm"
          disabled={selectedCount === 0}
          onClick={openReceiveDialog}
        >
          Received delivery
          {selectedCount > 0 ?
            <span className="ml-1 tabular-nums text-primary-foreground/80">
              ({selectedCount})
            </span>
          : null}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="w-10 px-2 py-2.5">
                <span className="sr-only">Select for receiving</span>
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-primary"
                  checked={allSelectableSelected}
                  onChange={toggleAllSelectable}
                  disabled={selectableIds.size === 0}
                  aria-label="Select all lines you can confirm as received"
                />
              </th>
              <th className="px-3 py-2.5 font-medium text-foreground">Photo</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Product</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Site</th>
              <th className="px-3 py-2.5 font-medium text-foreground">URL</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Qty</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Line total</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Refunded</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Fulfillment</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                Tracking
              </th>
              <th className="px-3 py-2.5 font-medium text-foreground">Refund</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Audit</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Checked out</th>
            </tr>
          </thead>
          <PaidOrderAccordionRoot
            resetKey={orderAccordionResetKey}
            initialExpandedOrderId={orderGroups[0]?.order.id ?? null}
          >
            {orderGroups.map(({ order, lines }) => (
              <OrderBlock
                key={order.id}
                order={order}
                lines={lines}
                snapshotsByRequestId={snapshotsByRequestId}
                selected={selected}
                onToggleRow={toggleRow}
              />
            ))}
          </PaidOrderAccordionRoot>
        </table>
      </div>

      <Dialog
        open={receiveOpen}
        onOpenChange={(open) => {
          setReceiveOpen(open);
          if (!open) setSaveError(null);
        }}
      >
        <DialogContent className="max-h-[min(90vh,680px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Received delivery</DialogTitle>
            <DialogDescription>
              Confirm what arrived for the selected line
              {selectedInTableOrder.length !== 1 ? "s" : ""}. Submitting saves the receipt, adds an
              audit snapshot, and updates the line&apos;s fulfillment status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {selectedInTableOrder.map((orderItemId) => {
              const row = rows.find((r) => r.orderItem.id === orderItemId);
              const draft = drafts[orderItemId];
              if (!row || !draft) return null;
              const r = row.request;
              const lineLabel = receiveLineLabel(row);
              return (
                <div
                  key={orderItemId}
                  className="space-y-4 rounded-lg border border-border bg-muted/20 p-4"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {r.productName?.trim() || "Unnamed product"}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {lineLabel}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Ordered Qty</Label>
                      <p className="text-sm tabular-nums font-medium text-foreground">
                        {row.orderItem.quantity}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`dash-recv-${orderItemId}-qty`}>
                        Received Qty
                      </Label>
                      <Input
                        id={`dash-recv-${orderItemId}-qty`}
                        type="number"
                        min={0}
                        value={draft.receivedQty}
                        onChange={(e) =>
                          updateDraft(orderItemId, {
                            receivedQty: Math.max(
                              0,
                              Number.parseInt(e.target.value, 10) || 0,
                            ),
                          })
                        }
                        className="tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`dash-recv-${orderItemId}-cond`}>Condition</Label>
                    <select
                      id={`dash-recv-${orderItemId}-cond`}
                      className={receivingConditionSelectClassName}
                      value={draft.condition}
                      onChange={(e) =>
                        updateDraft(orderItemId, {
                          condition: e.target
                            .value as WarehouseReceiveCondition,
                        })
                      }
                    >
                      {CONDITION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`dash-recv-${orderItemId}-shelf`}>
                      Shelf location
                    </Label>
                    <Input
                      id={`dash-recv-${orderItemId}-shelf`}
                      value={draft.shelfLocation}
                      onChange={(e) =>
                        updateDraft(orderItemId, {
                          shelfLocation: e.target.value,
                        })
                      }
                      placeholder="Optional — if staff gave you a bin or shelf code"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Actions
                    </p>
                    <ReceivingRowActions
                      lineLabel={lineLabel}
                      shelfLocation={draft.shelfLocation}
                      proofFileCount={draft.proofFileCount}
                      onShelfAssigned={(shelf) =>
                        updateDraft(orderItemId, { shelfLocation: shelf })
                      }
                      onProofFilesAdded={(count) =>
                        updateDraft(orderItemId, {
                          proofFileCount: draft.proofFileCount + count,
                        })
                      }
                      onBarcodeApplied={(value) =>
                        updateDraft(orderItemId, { barcodeValue: value })
                      }
                    />
                  </div>
                  <WarehouseBarcodeImageField
                    orderItemId={orderItemId}
                    imageUrl={row.orderItem.warehouseReceivedBarcodeImageUrl}
                    disabled={savePending}
                  />
                </div>
              );
            })}
          </div>
          {saveError ?
            <p className="text-sm text-destructive" role="alert">
              {saveError}
            </p>
          : null}
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savePending}
              onClick={() => setReceiveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savePending || selectedInTableOrder.length === 0}
              onClick={() => {
                setSaveError(null);
                const lines = selectedInTableOrder.flatMap((orderItemId) => {
                  const d = drafts[orderItemId];
                  if (!d) return [];
                  return [
                    {
                      orderItemId,
                      receivedQty: d.receivedQty,
                      condition: d.condition,
                      shelfLocation: d.shelfLocation,
                      proofPhotoCount: d.proofFileCount,
                      barcodeValue:
                        d.barcodeValue.trim() === "" ? undefined : d.barcodeValue,
                    },
                  ];
                });
                if (lines.length === 0) {
                  setSaveError("Nothing to submit.");
                  return;
                }
                startSave(async () => {
                  const res = await submitCustomerWarehouseReceiptAction({
                    lines,
                  });
                  if (!res.ok) {
                    setSaveError(res.message);
                    toast.error(res.message);
                    return;
                  }
                  toast.success(res.message);
                  setReceiveOpen(false);
                  setSelected((prev) => {
                    const next = new Set(prev);
                    for (const id of selectedInTableOrder) next.delete(id);
                    return next;
                  });
                  router.refresh();
                });
              }}
            >
              {savePending ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderBlock({
  order,
  lines,
  snapshotsByRequestId,
  selected,
  onToggleRow,
}: {
  order: OrderListCore;
  lines: DashboardPaidOrderLineRow[];
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
  selected: Set<string>;
  onToggleRow: (orderItemId: string) => void;
}) {
  const buckets = partitionPaidLinesIntoBatchBuckets(lines);
  const hasBatchMix = buckets.some((b) => b.kind === "batch");
  const hasSinglesMix = buckets.some((b) => b.kind === "single");
  const onlySinglesSubgroup = buckets.length === 1 && buckets[0]!.kind === "single";

  const lineCount = lines.length;

  return (
    <CollapsibleOrderTableSection
      orderId={order.id}
      colSpan={subgroupColSpan()}
      lineCount={lineCount}
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
            · {lineCount === 1 ? "1 line" : `${lineCount} lines`}
          </span>
        </>
      }
    >
      {onlySinglesSubgroup ?
        buckets[0]!.lines.map((row) => (
          <DashboardOrderDataRow
            key={row.orderItem.id}
            row={row}
            snapshotsByRequestId={snapshotsByRequestId}
            selected={selected.has(row.orderItem.id)}
            canSelect={rowSelectable(row)}
            onToggleSelect={() => onToggleRow(row.orderItem.id)}
          />
        ))
      : buckets.map((bucket, bi) => {
          if (bucket.kind === "batch") {
            return (
              <FragmentBucket
                key={bucket.batchSessionId}
                title={
                  <>
                    Batch{" "}
                    <span className="font-mono text-xs text-primary">
                      {bucket.batchNumber ?? bucket.batchSessionId.slice(0, 8) + "…"}
                    </span>
                    {" · "}
                    {bucket.lines.length}{" "}
                    {bucket.lines.length === 1 ? "product" : "products"}
                  </>
                }
              >
                {bucket.lines.map((row) => (
                  <DashboardOrderDataRow
                    key={row.orderItem.id}
                    row={row}
                    snapshotsByRequestId={snapshotsByRequestId}
                    selected={selected.has(row.orderItem.id)}
                    canSelect={rowSelectable(row)}
                    onToggleSelect={() => onToggleRow(row.orderItem.id)}
                  />
                ))}
              </FragmentBucket>
            );
          }
          return (
            <FragmentBucket
              key={`single:${order.id}:${bi}`}
              title={hasBatchMix && hasSinglesMix ? "Single items" : "Single"}
              muted={!(hasBatchMix && hasSinglesMix)}
            >
              {bucket.lines.map((row) => (
                <DashboardOrderDataRow
                  key={row.orderItem.id}
                  row={row}
                  snapshotsByRequestId={snapshotsByRequestId}
                  selected={selected.has(row.orderItem.id)}
                  canSelect={rowSelectable(row)}
                  onToggleSelect={() => onToggleRow(row.orderItem.id)}
                />
              ))}
            </FragmentBucket>
          );
        })
      }
    </CollapsibleOrderTableSection>
  );
}

function FragmentBucket({
  title,
  muted,
  children,
}: {
  title: ReactNode;
  muted?: boolean;
  children: ReactNode;
}) {
  const colSpan = subgroupColSpan();
  return (
    <>
      <tr className={`${muted ? "bg-background/60" : "bg-primary/[0.06]"}`}>
        <td
          className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${muted ? "text-muted-foreground" : "text-foreground/90"}`}
          colSpan={colSpan}
        >
          {title}
        </td>
      </tr>
      {children}
    </>
  );
}

function DashboardRefundPreviewDialog({ row }: { row: DashboardPaidOrderLineRow }) {
  if (row.refundedCents <= 0) return null;

  const r = row.request;
  const productName = r.productName?.trim() || "Unnamed product";
  const productNumber = row.orderItem.id;
  const batchDisplay =
    row.resolvedBatchNumber?.trim()
      ? row.resolvedBatchNumber.trim()
      : row.resolvedBatchSessionId?.trim()
        ? `Session ${row.resolvedBatchSessionId.trim().slice(0, 8)}…`
        : null;
  const size = r.productSize?.trim();
  const color = r.productColor?.trim();

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground shadow-xs transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Preview refund
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Refund preview</DialogTitle>
          <DialogDescription>
            Refund details recorded for this product line after approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <dl className="grid gap-3 text-foreground">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Product name
                </dt>
                <dd className="mt-0.5 font-medium leading-snug">{productName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Product number
                </dt>
                <dd className="mt-0.5 break-all font-mono text-xs" title={productNumber}>
                  {productNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Order number
                </dt>
                <dd className="mt-0.5 break-all font-mono text-xs" title={row.order.id}>
                  {row.order.id}
                </dd>
              </div>
              {batchDisplay ?
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Batch
                  </dt>
                  <dd className="mt-0.5 font-medium">{batchDisplay}</dd>
                  {row.resolvedBatchSessionId?.trim() && row.resolvedBatchNumber?.trim() ?
                    <dd
                      className="mt-1 break-all font-mono text-[10px] text-muted-foreground"
                      title={row.resolvedBatchSessionId.trim()}
                    >
                      ID {row.resolvedBatchSessionId.trim()}
                    </dd>
                  : null}
                </div>
              : null}
            </dl>
          </div>

          <div className="grid gap-3 rounded-lg border border-border bg-background p-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Quantity
              </p>
              <p className="mt-0.5 tabular-nums text-foreground">
                {row.orderItem.quantity}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Size
              </p>
              <p className="mt-0.5 text-foreground">{size || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Color
              </p>
              <p className="mt-0.5 text-foreground">{color || "—"}</p>
            </div>
          </div>

          <div className="rounded-lg border border-violet-500/30 bg-violet-500/[0.08] p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-violet-900 dark:text-violet-200">
              Total refunded
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {formatUsd(row.refundedCents)}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Approval history
            </p>
            {row.refundDetails.length > 0 ?
              <div className="divide-y divide-border rounded-lg border border-border">
                {row.refundDetails.map((refund, i) => (
                  <div key={refund.id} className="space-y-1 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium tabular-nums text-foreground">
                        {formatUsd(refund.amountCents)}
                      </p>
                      <time
                        dateTime={refund.createdAt}
                        className="text-xs text-muted-foreground"
                      >
                        {new Date(refund.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Approved refund {i + 1}
                      {refund.stripeRefundId ?
                        <>
                          {" · "}
                          <span className="font-mono">{refund.stripeRefundId}</span>
                        </>
                      : null}
                    </p>
                  </div>
                ))}
              </div>
            : (
              <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                Refund total is recorded, but detailed refund rows were not available.
              </p>
            )}
          </div>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

function DashboardOrderDataRow(props: {
  row: DashboardPaidOrderLineRow;
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
  selected: boolean;
  canSelect: boolean;
  onToggleSelect: () => void;
}) {
  const { row, snapshotsByRequestId, selected, canSelect, onToggleSelect } =
    props;
  const r = row.request;
  const fulfillment = effectiveOrderItemFulfillmentStatus(row.orderItem, row.order);
  const pendingRefund = row.pendingRefundRequest != null;
  const showTracking = dashboardShowLineTracking(row);

  return (
    <tr className="align-top">
      <td className="px-2 py-3 align-top">
        <input
          type="checkbox"
          className="size-4 rounded border-input accent-primary disabled:opacity-40"
          checked={selected}
          disabled={!canSelect}
          onChange={onToggleSelect}
          aria-label={`Select ${r.productName?.trim() || "product"} for receiving`}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <ProductRequestThumbnail
          variant="list"
          imageUrl={r.productImageUrl}
          productLabel={r.productName}
        />
      </td>
      <td className="max-w-[10rem] px-3 py-3 align-top font-medium text-foreground">
        <span className="line-clamp-2">{r.productName?.trim() || "Unnamed product"}</span>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground" title={r.id}>
          Req {r.id.slice(0, 8)}…
        </p>
        {row.orderItem.warehouseReceivedAt ?
          <p className="mt-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            Inbound receipt saved{" "}
            <time dateTime={row.orderItem.warehouseReceivedAt}>
              {new Date(row.orderItem.warehouseReceivedAt).toLocaleString()}
            </time>
          </p>
        : null}
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
          Product url
        </Link>
      </td>
      <td className="px-3 py-3 align-top tabular-nums text-muted-foreground">{row.orderItem.quantity}</td>
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
      <td className="max-w-[14rem] px-3 py-3 align-top">
        <StatusBadge
          kind={orderItemFulfillmentBadgeKind(row.orderItem, row.order, {
            pendingRefundRequest: pendingRefund,
          })}
          title={pendingRefund ? undefined : fulfillment}
        >
          {dashboardOrderLineStatusLabel(fulfillment, {
            pendingRefundRequest: pendingRefund,
          })}
        </StatusBadge>
      </td>
      <td className="px-3 py-3 align-top">
        {showTracking ?
          <DashboardOrderLineTracking
            trackingUrl={row.orderItem.companyPurchaseTrackingUrl}
            retailerCompany={row.orderItem.companyPurchaseRetailerTrackingCompany}
            trackingNumber={row.orderItem.companyPurchaseRetailerTrackingNumber}
            productLabel={r.productName?.trim() || "Item"}
          />
        : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <DashboardRefundPreviewDialog row={row} />
        <DashboardRequestRefundDialog row={row} />
        {row.pendingRefundRequest ?
          <p className="mt-2 text-[10px] font-medium text-amber-900 dark:text-amber-100">
            Awaiting staff approval
          </p>
        : null}
      </td>
      <td className="px-3 py-3 align-top">
        <ItemRequestLineAuditDialog
          itemRequestId={r.id}
          productLabel={r.productName?.trim() || ""}
          snapshots={snapshotsByRequestId[r.id] ?? []}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-muted-foreground">
        <time dateTime={row.order.createdAt}>{new Date(row.order.createdAt).toLocaleString()}</time>
      </td>
    </tr>
  );
}
