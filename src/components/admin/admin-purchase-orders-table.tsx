"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { TruckIcon } from "lucide-react";
import { toast } from "sonner";

import { saveWarehouseReceiptSnapshotsAction } from "@/actions/save-warehouse-receipt-snapshots";

import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import { AdminOrderLineActions } from "@/components/admin/admin-order-line-actions";
import {
  CONDITION_OPTIONS,
  type WarehouseReceiveCondition,
  receivingConditionSelectClassName,
  ReceivingRowActions,
} from "@/components/admin/receiving-row-actions";
import { WarehouseBarcodeImageField } from "@/components/orders/warehouse-barcode-image-field";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import type { PurchaseQueueLineRow } from "@/data/admin-purchase-queue";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import { adminOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { buildAdminOrdersListHref } from "@/lib/paid-orders-list-params";
import { orderItemFulfillmentBadgeKind } from "@/lib/status-badge-map";
import { canSubmitWarehouseReceiptForFulfillment } from "@/lib/warehouse-receipt-queue";
import { displaySiteName } from "@/lib/site-name";
import {
  adminCustomerDisplayLabel,
  adminCustomerSortKey,
} from "@/lib/admin-customer-group";
import { cn } from "@/lib/utils";

function customerLabel(row: PurchaseQueueLineRow): string {
  return adminCustomerDisplayLabel({
    fullName: row.customerFullName,
    email: row.customerEmail,
    clerkUserId: row.order.clerkUserId,
  });
}

function receiveLineLabel(row: PurchaseQueueLineRow): string {
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

function receiptSelectableRow(row: PurchaseQueueLineRow): boolean {
  const fulfillment = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order,
  );
  const net = row.orderItem.price - row.refundedCents;
  return canSubmitWarehouseReceiptForFulfillment(fulfillment) && net > 0;
}

function receiveDraftFromRow(row: PurchaseQueueLineRow): ReceiveDraft {
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

type ReceiveDraft = {
  receivedQty: number;
  condition: WarehouseReceiveCondition;
  shelfLocation: string;
  proofFileCount: number;
  barcodeValue: string;
};

export function AdminPurchaseOrdersTable({
  rows,
  snapshotsByRequestId = {},
}: {
  rows: PurchaseQueueLineRow[];
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ReceiveDraft>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();
  const [savePending, startSave] = useTransition();

  const selectableIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (receiptSelectableRow(r)) s.add(r.orderItem.id);
    }
    return s;
  }, [rows]);

  const allSelected =
    selectableIds.size > 0 &&
    [...selectableIds].every((id) => selected.has(id));

  const selectedCount = useMemo(() => {
    let n = 0;
    for (const id of selected) {
      if (selectableIds.has(id)) n += 1;
    }
    return n;
  }, [selected, selectableIds]);

  const toggleRow = useCallback(
    (orderItemId: string) => {
      if (!selectableIds.has(orderItemId)) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(orderItemId)) next.delete(orderItemId);
        else next.add(orderItemId);
        return next;
      });
    },
    [selectableIds],
  );

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (selectableIds.size === 0) return prev;
      const next = new Set(prev);
      const allOn = [...selectableIds].every((id) => next.has(id));
      if (allOn) {
        for (const id of selectableIds) next.delete(id);
      } else {
        for (const id of selectableIds) next.add(id);
      }
      return next;
    });
  }, [selectableIds]);

  const selectedInTableOrder = useMemo(
    () =>
      rows
        .map((r) => r.orderItem.id)
        .filter((id) => selected.has(id) && selectableIds.has(id)),
    [rows, selected, selectableIds],
  );

  const PURCHASE_ORDERS_TABLE_COL_SPAN = 15;

  const customerRowGroups = useMemo(() => {
    const byClerk = new Map<string, PurchaseQueueLineRow[]>();
    for (const row of rows) {
      const id = row.order.clerkUserId;
      const list = byClerk.get(id);
      if (list) list.push(row);
      else byClerk.set(id, [row]);
    }
    const groups = [...byClerk.entries()].map(([clerkUserId, custRows]) => {
      const first = custRows[0]!;
      return {
        clerkUserId,
        sortKey: adminCustomerSortKey({
          fullName: first.customerFullName,
          email: first.customerEmail,
          clerkUserId,
        }),
        displayLabel: adminCustomerDisplayLabel({
          fullName: first.customerFullName,
          email: first.customerEmail,
          clerkUserId,
        }),
        rows: custRows,
      };
    });
    groups.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return groups;
  }, [rows]);

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
        No lines on this page.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Select lines (including problem receipts), then use{" "}
          <span className="font-medium text-foreground">Received delivery</span>{" "}
          to log or correct quantities, condition, and shelf. Condition{" "}
          <span className="font-medium text-foreground">Good</span> sets{" "}
          <span className="font-medium text-foreground">
            Delivery received: good - awaiting barrel
          </span>
          ; the line then leaves this list for{" "}
          <Link
            href="/admin/packages"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Packages
          </Link>
          . Shoppers see it on{" "}
          <Link
            href="/dashboard/orders"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Dashboard → Orders
          </Link>
          ; receipt detail stays in{" "}
          <span className="font-medium text-foreground">Request line audit</span>.
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
        <table className="w-full min-w-[76rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="w-10 px-2 py-2.5">
                <span className="sr-only">Select for receiving</span>
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-primary"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={selectableIds.size === 0}
                  aria-label="Select all lines on this page"
                />
              </th>
              <th className="px-3 py-2.5 font-medium text-foreground">Photo</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Product</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Retailer</th>
              <th className="px-3 py-2.5 font-medium text-foreground">URL</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Batch</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Customer</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Order</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Qty</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Variant</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Quote cost</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Line total</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Status</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Ops</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Audit</th>
            </tr>
          </thead>
          {customerRowGroups.map(({ clerkUserId, displayLabel, rows: custRows }) => (
            <tbody key={clerkUserId}>
              <tr className="border-b border-border bg-muted/50">
                <td
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground"
                  colSpan={PURCHASE_ORDERS_TABLE_COL_SPAN}
                >
                  Customer · {displayLabel}
                </td>
              </tr>
              {custRows.map((row) => (
                <PurchaseQueueRow
                  key={row.orderItem.id}
                  row={row}
                  snapshotsByRequestId={snapshotsByRequestId}
                  selected={selected.has(row.orderItem.id)}
                  receiveSelectable={receiptSelectableRow(row)}
                  onToggleSelect={() => toggleRow(row.orderItem.id)}
                />
              ))}
            </tbody>
          ))}
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
              Record receipt for the selected line
              {selectedInTableOrder.length !== 1 ? "s" : ""}. Submitting saves the line, adds an
              audit snapshot, and sets fulfillment from the condition you record.
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
                      <Label className="text-muted-foreground">
                        Ordered Qty
                      </Label>
                      <p className="text-sm tabular-nums font-medium text-foreground">
                        {row.orderItem.quantity}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`recv-${orderItemId}-qty`}>
                        Received Qty
                      </Label>
                      <Input
                        id={`recv-${orderItemId}-qty`}
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
                    <Label htmlFor={`recv-${orderItemId}-cond`}>Condition</Label>
                    <select
                      id={`recv-${orderItemId}-cond`}
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
                    <Label htmlFor={`recv-${orderItemId}-shelf`}>
                      Shelf location
                    </Label>
                    <Input
                      id={`recv-${orderItemId}-shelf`}
                      value={draft.shelfLocation}
                      onChange={(e) =>
                        updateDraft(orderItemId, {
                          shelfLocation: e.target.value,
                        })
                      }
                      placeholder="e.g. A-12-03 / BIN-4421"
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
                  const res = await saveWarehouseReceiptSnapshotsAction({
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

function PurchaseQueueRow(props: {
  row: PurchaseQueueLineRow;
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
  selected: boolean;
  receiveSelectable: boolean;
  onToggleSelect: () => void;
}) {
  const { row, snapshotsByRequestId, selected, receiveSelectable, onToggleSelect } = props;
  const r = row.request;
  const fulfillment = effectiveOrderItemFulfillmentStatus(row.orderItem, row.order);
  const awaitingInbound =
    fulfillment === "company_purchase_pending_delivery" ||
    fulfillment === "delivery_requested_pending_fulfillment";
  const needsReceiptCorrection =
    fulfillment === "delivery_received_item_missing" ||
    fulfillment === "delivery_received_item_damaged" ||
    fulfillment === "delivery_received_wrong_item";
  const awaitingBarrelGood =
    fulfillment === "delivery_received_good_awaiting_barrel";
  const refundable = Math.max(0, row.orderItem.price - row.refundedCents);
  const highlightInbound = awaitingInbound && refundable > 0;
  const highlightCorrection = needsReceiptCorrection && refundable > 0;
  const highlightBarrelGood = awaitingBarrelGood && refundable > 0;
  const refundRequestHighlight = row.pendingRefundRequest != null;

  const isBatch =
    !!(row.resolvedBatchSessionId?.trim()) ||
    !!(row.resolvedBatchNumber?.trim());

  const size = r.productSize?.trim();
  const color = r.productColor?.trim();
  const variantLabel =
    [size, color].filter(Boolean).join(" · ") || "—";

  const retailerLabel = displaySiteName(r.siteName, r.productUrl);
  const productTitle = r.productName?.trim() || "Unnamed product";

  return (
    <tr
      className={cn(
        "border-b border-border align-top",
        highlightInbound &&
          "bg-sky-500/[0.04] shadow-[inset_3px_0_0_rgb(56_189_248_/_0.55)]",
        highlightCorrection &&
          "bg-amber-500/[0.06] shadow-[inset_3px_0_0_rgb(245_158_11_/_0.55)]",
        highlightBarrelGood &&
          "bg-emerald-500/[0.05] shadow-[inset_3px_0_0_rgb(16_185_129_/_0.5)]",
        refundRequestHighlight &&
          "bg-violet-500/[0.05] shadow-[inset_3px_0_0_rgb(167_139_250_/_0.65)]",
      )}
    >
      <td className="px-2 py-3 align-top">
        <input
          type="checkbox"
          className="size-4 rounded border-input accent-primary disabled:opacity-40"
          checked={selected}
          disabled={!receiveSelectable}
          onChange={onToggleSelect}
          aria-label={`Select ${productTitle} for receiving`}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <ProductRequestThumbnail
          variant="admin"
          imageUrl={r.productImageUrl}
          productLabel={r.productName}
        />
      </td>
      <td className="max-w-[11rem] px-3 py-3 align-top font-medium text-foreground">
        <span className="line-clamp-2">{productTitle}</span>
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
      <td className="max-w-[9rem] px-3 py-3 align-top text-muted-foreground">
        <span className="line-clamp-2 text-xs sm:text-sm">{retailerLabel}</span>
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
      <td className="max-w-[8rem] px-3 py-3 align-top">
        <div className="space-y-1">
          {highlightCorrection ?
            <span
              className="inline-flex items-center gap-1 rounded-md border border-amber-500/45 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-950 dark:text-amber-100"
              title="Receipt needs correction — update via Received delivery."
            >
              Needs correction
            </span>
          : highlightBarrelGood ?
            <span
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/45 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-950 dark:text-emerald-100"
              title="Good receipt — continue in Packages for warehouse receiving."
            >
              Awaiting barrel
            </span>
          : highlightInbound ?
            <span
              className="inline-flex items-center gap-1 rounded-md border border-sky-500/45 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-100"
              title="Retailer purchase approved — coordinate inbound delivery."
            >
              <TruckIcon className="size-3 shrink-0 text-sky-400" aria-hidden />
              Awaiting inbound
            </span>
          : null}
          {isBatch ?
            <>
              <span className="inline-flex rounded-md border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
                Batch
              </span>
              <p className="font-mono text-xs font-medium text-foreground">
                {row.resolvedBatchNumber?.trim() ||
                  (row.resolvedBatchSessionId ?
                    `${row.resolvedBatchSessionId.slice(0, 8)}…`
                  : "—")}
              </p>
            </>
          : (
            <span className="text-xs italic text-muted-foreground">Single</span>
          )}
        </div>
      </td>
      <td className="max-w-[9rem] px-3 py-3 align-top text-muted-foreground">
        <span className="line-clamp-2 text-xs sm:text-sm">{customerLabel(row)}</span>
      </td>
      <td className="max-w-[7rem] px-3 py-3 align-top">
        <Link
          href={buildAdminOrdersListHref({ q: row.order.id })}
          className="break-all font-mono text-[11px] font-medium text-primary underline-offset-2 hover:underline"
          title={row.order.id}
          prefetch={false}
        >
          {row.order.id.slice(0, 8)}…
        </Link>
      </td>
      <td className="px-3 py-3 align-top tabular-nums text-muted-foreground">
        {row.orderItem.quantity}
      </td>
      <td className="max-w-[8rem] px-3 py-3 align-top text-xs text-muted-foreground">
        <span className="line-clamp-2">{variantLabel}</span>
      </td>
      <td className="px-3 py-3 align-top tabular-nums font-medium text-foreground">
        {row.quotedItemCostCents != null ?
          formatUsd(row.quotedItemCostCents)
        : "—"}
      </td>
      <td className="px-3 py-3 align-top tabular-nums text-foreground">
        <span className="font-medium">{formatUsd(row.orderItem.price)}</span>
        {row.refundedCents > 0 ?
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Net {formatUsd(row.orderItem.price - row.refundedCents)}
          </span>
        : null}
      </td>
      <td className="max-w-[10rem] px-3 py-3 align-top">
        <StatusBadge
          kind={orderItemFulfillmentBadgeKind(row.orderItem, row.order, {
            pendingRefundRequest: row.pendingRefundRequest != null,
          })}
          title={fulfillment}
        >
          {adminOrderLineStatusLabel(fulfillment, {
            pendingRefundRequest: row.pendingRefundRequest != null,
          })}
        </StatusBadge>
      </td>
      <td className="px-3 py-3 align-top">
        <AdminOrderLineActions
          orderItemId={row.orderItem.id}
          fulfillmentStatus={fulfillment}
          linePriceCents={row.orderItem.price}
          refundedCents={row.refundedCents}
          productLabel={r.productName?.trim() || "Item"}
          orderNumber={row.order.id}
          batchNumber={row.resolvedBatchNumber}
          batchSessionId={row.resolvedBatchSessionId}
          purchaseTracking={{
            trackingUrl: row.orderItem.companyPurchaseTrackingUrl,
            retailerTrackingCompany:
              row.orderItem.companyPurchaseRetailerTrackingCompany,
            retailerTrackingNumber:
              row.orderItem.companyPurchaseRetailerTrackingNumber,
          }}
          retailerReceiptImageUrls={row.orderItem.companyPurchaseReceiptImageUrls}
          pendingRefundRequest={row.pendingRefundRequest}
        />
      </td>
      <td className="px-3 py-3 align-top">
        <ItemRequestLineAuditDialog
          itemRequestId={r.id}
          productLabel={r.productName?.trim() || ""}
          snapshots={snapshotsByRequestId[r.id] ?? []}
        />
      </td>
    </tr>
  );
}
