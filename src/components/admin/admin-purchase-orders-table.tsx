"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";

import { ChevronDownIcon, ChevronRightIcon, PackageCheck, TruckIcon } from "lucide-react";
import { toast } from "sonner";

import { saveWarehouseReceiptSnapshotsAction } from "@/actions/save-warehouse-receipt-snapshots";

import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import { AdminCustomerRecordLabel } from "@/components/admin/admin-customer-record-label";
import { AdminUpdatedByCell } from "@/components/admin/admin-staff-record-label";
import { AdminNestedFindOrganizePanel } from "@/components/admin/admin-nested-find-organize-panel";
import { useAdminNestedPanelFocus } from "@/components/admin/admin-nested-panel-focus-context";
import { AdminOrderLineActions } from "@/components/admin/admin-order-line-actions";
import {
  CONDITION_OPTIONS,
  type WarehouseReceiveCondition,
  receivingConditionSelectClassName,
  ReceivingRowActions,
} from "@/components/admin/receiving-row-actions";
import { WarehouseProofPhotosField } from "@/components/orders/warehouse-proof-photos-field";
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
import {
  isMoneyBackProductReturn,
  isMoneyBackReturnAwaitingRefund,
} from "@/lib/order-line-product-return-display";
import { canSubmitWarehouseReceiptForFulfillment } from "@/lib/warehouse-receipt-queue";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";
import { displaySiteName } from "@/lib/site-name";
import {
  adminCustomerDisplayLabel,
  adminCustomerSortKey,
} from "@/lib/admin-customer-group";
import { cn } from "@/lib/utils";
import { adminParentControlsDisabledClass } from "@/lib/admin-parent-controls-disabled";
import {
  resolveOrderLineUpdatedByClerkUserId,
  type AdminStaffProfilesByClerkUserId,
} from "@/lib/admin-staff-profiles";

const LINE_PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

function purchaseLineMatchesQuery(row: PurchaseQueueLineRow, q: string): boolean {
  if (!q) return true;
  const r = row.request;
  const chunks = [
    r.id,
    r.productName,
    r.productUrl,
    displaySiteName(r.siteName, r.productUrl),
    row.order.id,
    row.orderItem.id,
    row.resolvedBatchNumber,
    row.resolvedBatchSessionId,
    row.customerFullName,
    row.customerEmail,
    customerLabel(row),
  ];
  return chunks.some(
    (chunk) => chunk != null && String(chunk).toLowerCase().includes(q),
  );
}

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

function inboundReceiptSavedTooltip(row: PurchaseQueueLineRow): string | null {
  const at = row.orderItem.warehouseReceivedAt;
  if (!at) return null;
  const when = new Date(at).toLocaleString();
  const cond = isReceiveCondition(row.orderItem.warehouseReceivedCondition) ?
    warehouseReceiveConditionLabel(row.orderItem.warehouseReceivedCondition)
  : null;
  const qty =
    row.orderItem.warehouseReceivedQty != null ?
      `${row.orderItem.warehouseReceivedQty}/${row.orderItem.quantity} received`
    : null;
  return [
    `Inbound receipt saved ${when}`,
    cond ? `Condition: ${cond}` : null,
    qty,
  ]
    .filter(Boolean)
    .join(" · ");
}

function receiptSelectableRow(row: PurchaseQueueLineRow): boolean {
  const fulfillment = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order,
  );
  const net = row.orderItem.price - row.refundedCents;
  if (
    fulfillment === "product_return_awaiting_delivery" &&
    isMoneyBackProductReturn(row.fulfilledProductReturnRequest?.desiredOutcome)
  ) {
    return false;
  }
  return canSubmitWarehouseReceiptForFulfillment(fulfillment) && net > 0;
}

function receiveDraftFromRow(row: PurchaseQueueLineRow): ReceiveDraft {
  const oi = row.orderItem;
  const fulfillment = effectiveOrderItemFulfillmentStatus(oi, row.order);
  if (fulfillment === "product_return_awaiting_delivery") {
    return {
      receivedQty: oi.quantity,
      condition: "good",
      shelfLocation: "",
      proofPhotoUrls: [],
      proofFileCount: 0,
      barcodeValue: "",
    };
  }
  if (oi.warehouseReceivedAt) {
    const cond = isReceiveCondition(oi.warehouseReceivedCondition) ?
        oi.warehouseReceivedCondition
      : "good";
    const proofPhotoUrls = [...(oi.warehouseReceivedProofPhotoUrls ?? [])];
    return {
      receivedQty: oi.warehouseReceivedQty ?? oi.quantity,
      condition: cond,
      shelfLocation: oi.warehouseShelfLocation ?? "",
      proofPhotoUrls,
      proofFileCount:
        proofPhotoUrls.length > 0 ?
          proofPhotoUrls.length
        : (oi.warehouseReceivedProofPhotoCount ?? 0),
      barcodeValue: oi.warehouseReceivedBarcode ?? "",
    };
  }
  return {
    receivedQty: oi.quantity,
    condition: "good",
    shelfLocation: "",
    proofPhotoUrls: [],
    proofFileCount: 0,
    barcodeValue: "",
  };
}

type ReceiveDraft = {
  receivedQty: number;
  condition: WarehouseReceiveCondition;
  shelfLocation: string;
  proofFileCount: number;
  proofPhotoUrls: string[];
  barcodeValue: string;
};

export function AdminPurchaseOrdersTable({
  rows,
  snapshotsByRequestId = {},
  staffProfilesByClerkUserId = {},
}: {
  rows: PurchaseQueueLineRow[];
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
}) {
  const baseId = useId();
  const { setNestedPanelActive } = useAdminNestedPanelFocus();
  const [openClerkUserId, setOpenClerkUserId] = useState<string | null>(null);
  const [panelChoiceMade, setPanelChoiceMade] = useState(false);
  const [lineSearch, setLineSearch] = useState("");
  const [lineFindOrganizeVisible, setLineFindOrganizeVisible] = useState(true);
  const [linePageSize, setLinePageSize] =
    useState<(typeof LINE_PAGE_SIZE_OPTIONS)[number]>(10);
  const [linePageByCustomerId, setLinePageByCustomerId] = useState<
    Record<string, number>
  >({});
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

  const PURCHASE_ORDERS_TABLE_COL_SPAN = 16;

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

  const activeClerkUserId =
    panelChoiceMade ? openClerkUserId : (customerRowGroups[0]?.clerkUserId ?? null);
  const customerExpanded = activeClerkUserId !== null;

  useEffect(() => {
    setNestedPanelActive(customerExpanded);
  }, [customerExpanded, setNestedPanelActive]);

  useEffect(() => {
    if (!activeClerkUserId) return;
    setLinePageByCustomerId((prev) => ({
      ...prev,
      [activeClerkUserId]: 1,
    }));
  }, [lineSearch, linePageSize, activeClerkUserId]);

  const toggleCustomer = useCallback((clerkUserId: string) => {
    setPanelChoiceMade(true);
    setOpenClerkUserId(activeClerkUserId === clerkUserId ? null : clerkUserId);
    if (activeClerkUserId !== clerkUserId) {
      setLineSearch("");
      setLinePageByCustomerId({});
    }
  }, [activeClerkUserId]);

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

      <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border">
        <table className="w-full min-w-[76rem] text-left text-sm">
          <thead
            className={cn(
              "border-b border-border bg-muted/40",
              adminParentControlsDisabledClass(customerExpanded),
            )}
            aria-hidden={customerExpanded || undefined}
          >
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
              <th className="min-w-[9rem] px-3 py-2.5 font-medium text-foreground">
                Updated by
              </th>
              <th className="px-3 py-2.5 font-medium text-foreground">Audit</th>
            </tr>
          </thead>
          {customerRowGroups.map(({ clerkUserId, displayLabel, rows: custRows }) => {
            const first = custRows[0]!;
            const expanded = activeClerkUserId === clerkUserId;
            const searchNorm = lineSearch.trim().toLowerCase();
            const lineFiltered = custRows.filter((row) =>
              purchaseLineMatchesQuery(row, searchNorm),
            );
            const lineCount = lineFiltered.length;
            const lineTotalPages = Math.max(
              1,
              Math.ceil(lineCount / linePageSize),
            );
            const rawLinePage = linePageByCustomerId[clerkUserId] ?? 1;
            const linePageSafe = Math.min(
              Math.max(1, rawLinePage),
              lineTotalPages,
            );
            const lineStart = (linePageSafe - 1) * linePageSize;
            const lineSlice = lineFiltered.slice(
              lineStart,
              lineStart + linePageSize,
            );
            const lineShowFrom = lineCount === 0 ? 0 : lineStart + 1;
            const lineShowTo = Math.min(lineStart + linePageSize, lineCount);

            return (
            <tbody key={clerkUserId}>
              <tr
                className={cn(
                  "border-b border-border bg-muted/50 transition-colors hover:bg-muted/60",
                  expanded && "bg-muted/40",
                )}
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onClick={() => toggleCustomer(clerkUserId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCustomer(clerkUserId);
                  }
                }}
              >
                <td
                  className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground"
                  colSpan={PURCHASE_ORDERS_TABLE_COL_SPAN}
                >
                  <span className="inline-flex items-center gap-2">
                    {expanded ? (
                      <ChevronDownIcon className="size-4 shrink-0" aria-hidden />
                    ) : (
                      <ChevronRightIcon className="size-4 shrink-0" aria-hidden />
                    )}
                    <AdminCustomerRecordLabel
                      clerkUserId={clerkUserId}
                      fullName={first.customerFullName}
                      email={first.customerEmail}
                      className="inline-block align-middle"
                      primaryClassName="text-xs font-semibold"
                    />
                    <span className="font-normal normal-case text-muted-foreground">
                      ({custRows.length} line{custRows.length === 1 ? "" : "s"})
                    </span>
                  </span>
                </td>
              </tr>
              {expanded ? (
                <>
                  <tr className="bg-muted/15">
                    <td colSpan={PURCHASE_ORDERS_TABLE_COL_SPAN} className="p-0">
                      <div className="border-b border-border px-3 py-4">
                        <AdminNestedFindOrganizePanel
                          switchId={`${baseId}-line-find-organize-${clerkUserId}`}
                          searchInputId={`${baseId}-line-search-${clerkUserId}`}
                          pageSizeSelectId={`${baseId}-line-page-size-${clerkUserId}`}
                          visible={lineFindOrganizeVisible}
                          onVisibleChange={setLineFindOrganizeVisible}
                          search={lineSearch}
                          onSearchChange={setLineSearch}
                          searchLabel="Search purchase lines"
                          searchPlaceholder="Product, URL, order id, request id, batch…"
                          pageSize={linePageSize}
                          onPageSizeChange={setLinePageSize}
                          pageSizeLabel="Lines per page"
                          showFrom={lineShowFrom}
                          showTo={lineShowTo}
                          totalCount={lineCount}
                          totalLoaded={custRows.length}
                          itemLabel="line"
                          emptyMessage="No purchase lines for this customer."
                          noMatchMessage="No lines match the current search."
                          className="mb-0"
                        />
                        {lineCount > linePageSize ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={linePageSafe <= 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLinePageByCustomerId((prev) => ({
                                  ...prev,
                                  [clerkUserId]: Math.max(1, linePageSafe - 1),
                                }));
                              }}
                            >
                              Previous lines
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={linePageSafe >= lineTotalPages}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLinePageByCustomerId((prev) => ({
                                  ...prev,
                                  [clerkUserId]: Math.min(
                                    lineTotalPages,
                                    linePageSafe + 1,
                                  ),
                                }));
                              }}
                            >
                              Next lines
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {lineSlice.length === 0 ? (
                    <tr>
                      <td
                        colSpan={PURCHASE_ORDERS_TABLE_COL_SPAN}
                        className="px-4 py-8 text-center text-sm text-muted-foreground"
                      >
                        {lineSearch.trim()
                          ? "No lines match the current search."
                          : "No purchase lines for this customer."}
                      </td>
                    </tr>
                  ) : null}
                  {lineSlice.map((row) => (
                    <PurchaseQueueRow
                      key={row.orderItem.id}
                      row={row}
                      snapshotsByRequestId={snapshotsByRequestId}
                      staffProfilesByClerkUserId={staffProfilesByClerkUserId}
                      selected={selected.has(row.orderItem.id)}
                      receiveSelectable={receiptSelectableRow(row)}
                      onToggleSelect={() => toggleRow(row.orderItem.id)}
                    />
                  ))}
                </>
              ) : null}
            </tbody>
            );
          })}
        </table>
      </FloatingHorizontalScroll>

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
                      showProofPhotos={false}
                      onShelfAssigned={(shelf) =>
                        updateDraft(orderItemId, { shelfLocation: shelf })
                      }
                      onProofFilesAdded={() => {}}
                      onBarcodeApplied={(value) =>
                        updateDraft(orderItemId, { barcodeValue: value })
                      }
                    />
                  </div>
                  <WarehouseProofPhotosField
                    orderItemId={orderItemId}
                    imageUrls={draft.proofPhotoUrls}
                    disabled={savePending}
                    onUrlsChange={(urls) =>
                      updateDraft(orderItemId, {
                        proofPhotoUrls: urls,
                        proofFileCount: urls.length,
                      })
                    }
                  />
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
                      proofPhotoCount: d.proofPhotoUrls.length,
                      proofPhotoUrls: d.proofPhotoUrls,
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
  staffProfilesByClerkUserId: AdminStaffProfilesByClerkUserId;
  selected: boolean;
  receiveSelectable: boolean;
  onToggleSelect: () => void;
}) {
  const {
    row,
    snapshotsByRequestId,
    staffProfilesByClerkUserId,
    selected,
    receiveSelectable,
    onToggleSelect,
  } = props;
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
  const awaitingMoneyBackRefund = isMoneyBackReturnAwaitingRefund({
    fulfillmentStatus: fulfillment,
    fulfilledProductReturnRequest: row.fulfilledProductReturnRequest,
  });

  const isBatch =
    !!(row.resolvedBatchSessionId?.trim()) ||
    !!(row.resolvedBatchNumber?.trim());

  const size = r.productSize?.trim();
  const color = r.productColor?.trim();
  const variantLabel =
    [size, color].filter(Boolean).join(" · ") || "—";

  const retailerLabel = displaySiteName(r.siteName, r.productUrl);
  const productTitle = r.productName?.trim() || "Unnamed product";
  const inboundReceiptTip = inboundReceiptSavedTooltip(row);

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
        awaitingMoneyBackRefund &&
          "bg-rose-500/[0.05] shadow-[inset_3px_0_0_rgb(244_63_94_/_0.55)]",
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
        {inboundReceiptTip ?
          <span
            className="mt-1 inline-flex cursor-default items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-0.5"
            title={inboundReceiptTip}
          >
            <PackageCheck
              className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Receipt
            </span>
            <span className="sr-only">{inboundReceiptTip}</span>
          </span>
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
          : awaitingMoneyBackRefund ?
            <span
              className="inline-flex items-center gap-1 rounded-md border border-rose-500/45 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-950 dark:text-rose-100"
              title="Money-back return — use Refund line after return tracking is on file."
            >
              Awaiting refund
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
            pendingProductReturnRequest: row.pendingProductReturnRequest != null,
            fulfilledProductReturnRequest: row.fulfilledProductReturnRequest,
            refundedCents: row.refundedCents,
            linePriceCents: row.orderItem.price,
            warehouseReceivedCondition: row.orderItem.warehouseReceivedCondition,
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
          pendingProductReturnRequest={row.pendingProductReturnRequest}
          fulfilledProductReturnRequest={row.fulfilledProductReturnRequest}
        />
      </td>
      <td className="min-w-[9rem] max-w-[11rem] px-3 py-3 align-top">
        <AdminUpdatedByCell
          clerkUserId={resolveOrderLineUpdatedByClerkUserId(row.orderItem)}
          profilesByClerkUserId={staffProfilesByClerkUserId}
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
