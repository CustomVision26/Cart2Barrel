"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";

import { AdminRefundRequestControls } from "@/components/admin/admin-refund-request-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import {
  CONDITION_OPTIONS,
  type WarehouseReceiveCondition,
  receivingConditionSelectClassName,
  ReceivingRowActions,
} from "@/components/admin/receiving-row-actions";
import type { Order } from "@/db/schema";
import {
  adminCustomerSortKey,
} from "@/lib/admin-customer-group";
import { adminOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import type { OrderItemReadCore } from "@/lib/order-item-read-compat";
import { orderItemFulfillmentBadgeKind } from "@/lib/status-badge-map";
import type { PendingRefundRequestBrief } from "@/data/order-item-refund-requests";
import { formatUsd } from "@/lib/admin-markup";

export type { WarehouseReceiveCondition } from "@/components/admin/receiving-row-actions";

export type WarehouseReceivingLine = {
  id: string;
  itemLabel: string;
  productName: string;
  orderedQty: number;
  orderItem: OrderItemReadCore;
  orderStatus: Order["status"];
  orderNumber: string;
  batchNumber: string | null;
  batchSessionId: string | null;
  clerkUserId: string;
  customerGroupSortKey: string;
  customerDisplayLabel: string;
  refundedCents: number;
  pendingRefundRequest: PendingRefundRequestBrief | null;
};

type RowState = {
  receivedQty: number;
  condition: WarehouseReceiveCondition;
  shelfLocation: string;
  proofFileCount: number;
};

type CustomerLineGroup = {
  clerkUserId: string;
  displayLabel: string;
  totalQty: number;
  totalValue: number;
  refundCount: number;
  lines: WarehouseReceivingLine[];
};

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

/** True when the line would show the standard "good — awaiting barrel" headline (not refund-pending). */
function isLineAwaitingBarrelGoodStatus(line: WarehouseReceivingLine): boolean {
  const orderSlice = { status: line.orderStatus };
  const fulfillment = effectiveOrderItemFulfillmentStatus(
    line.orderItem,
    orderSlice,
  );
  if (line.pendingRefundRequest != null) return false;
  return fulfillment === "delivery_received_good_awaiting_barrel";
}

function packageLineBatchLabel(line: WarehouseReceivingLine): string {
  const bn = line.batchNumber?.trim();
  if (bn) return bn;
  const sid = line.batchSessionId?.trim();
  if (sid) return `Session ${shortId(sid)}`;
  return "Single package";
}

function PackageMeta({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/80 p-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={
          mono ?
            "mt-0.5 break-all font-mono text-xs text-foreground"
          : "mt-0.5 text-sm font-medium text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

function PackageInventoryCard({
  line,
  row,
  onUpdate,
}: {
  line: WarehouseReceivingLine;
  row: RowState;
  onUpdate: (id: string, patch: Partial<RowState>) => void;
}) {
  const [recordOpen, setRecordOpen] = useState(true);
  const [intakeOpen, setIntakeOpen] = useState(true);
  const orderSlice = { status: line.orderStatus };
  const fulfillment = effectiveOrderItemFulfillmentStatus(
    line.orderItem,
    orderSlice,
  );
  const pendingRefund = line.pendingRefundRequest != null;
  const batchDisplay = packageLineBatchLabel(line);
  const receiptProgress =
    line.orderedQty <= 0 ?
      0
    : Math.min(100, Math.round((row.receivedQty / line.orderedQty) * 100));

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="border-b border-border bg-muted/20 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                Package file
              </span>
              <StatusBadge
                kind={orderItemFulfillmentBadgeKind(line.orderItem, orderSlice, {
                  pendingRefundRequest: pendingRefund,
                })}
                title={fulfillment}
              >
                {adminOrderLineStatusLabel(fulfillment, {
                  pendingRefundRequest: pendingRefund,
                })}
              </StatusBadge>
            </div>
            <h3 className="line-clamp-2 text-base font-semibold text-foreground">
              {line.productName}
            </h3>
            <p className="text-xs text-muted-foreground">
              Receiving file for order{" "}
              <span className="font-mono text-foreground">
                {shortId(line.orderNumber)}
              </span>{" "}
              and line{" "}
              <span className="font-mono text-foreground">{shortId(line.id)}</span>
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="grid min-w-[16rem] grid-cols-2 gap-2 text-xs">
              <PackageMeta label="Batch" value={batchDisplay} />
              <PackageMeta
                label="Line value"
                value={formatUsd(line.orderItem.price)}
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
              onClick={() => setRecordOpen((open) => !open)}
              aria-expanded={recordOpen}
            >
              <ChevronDownIcon
                className={`size-4 transition-transform ${
                  recordOpen ? "rotate-180" : "rotate-0"
                }`}
                aria-hidden
              />
              {recordOpen ? "Hide record" : "Show record"}
            </button>
          </div>
        </div>
      </div>

      {recordOpen ? (
      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <PackageMeta label="Order" value={shortId(line.orderNumber)} mono />
            <PackageMeta label="Order item" value={shortId(line.id)} mono />
            <PackageMeta
              label="Batch session"
              value={line.batchSessionId ? shortId(line.batchSessionId) : "-"}
              mono
            />
            <PackageMeta label="Ordered qty" value={line.orderedQty} />
          </div>

          <div className="rounded-xl border border-border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Receiving progress
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.receivedQty} of {line.orderedQty} units recorded
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {receiptProgress}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${receiptProgress}%` }}
              />
            </div>
          </div>

          {line.pendingRefundRequest ?
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <AdminRefundRequestControls
                refundRequest={line.pendingRefundRequest}
                linePriceCents={line.orderItem.price}
                refundedCents={line.refundedCents}
                productLabel={line.productName}
                productNumber={line.id}
                orderNumber={line.orderNumber}
                batchNumber={line.batchNumber}
                batchSessionId={line.batchSessionId}
              />
            </div>
          : (
            <div className="rounded-xl border border-border bg-muted/10 p-3 text-sm text-muted-foreground">
              No shopper refund request is attached to this package file.
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <button
            type="button"
            className="flex w-full items-start gap-3 bg-muted/20 p-3 text-left transition-colors hover:bg-muted/35"
            onClick={() => setIntakeOpen((open) => !open)}
            aria-expanded={intakeOpen}
          >
            <ChevronDownIcon
              className={`mt-0.5 size-4 shrink-0 transition-transform ${
                intakeOpen ? "rotate-180" : "rotate-0"
              }`}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                Receiving intake
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {intakeOpen ?
                  "Hide quantity, condition, shelf, barcode, and proof tools."
                : "Show quantity, condition, shelf, barcode, and proof tools."}
              </span>
            </span>
          </button>

          {intakeOpen ? (
            <div className="space-y-3 p-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Received qty
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={row.receivedQty}
                    onChange={(e) =>
                      onUpdate(line.id, {
                        receivedQty: Math.max(
                          0,
                          Number.parseInt(e.target.value, 10) || 0,
                        ),
                      })
                    }
                    className="tabular-nums"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Package condition
                  </span>
                  <select
                    className={receivingConditionSelectClassName}
                    value={row.condition}
                    onChange={(e) =>
                      onUpdate(line.id, {
                        condition: e.target.value as WarehouseReceiveCondition,
                      })
                    }
                    aria-label={`Condition for ${line.itemLabel}`}
                  >
                    {CONDITION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-lg border border-border bg-muted/10 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Shelf / bin
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {row.shelfLocation.trim() || "Not assigned"}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/10 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Proof photos
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {row.proofFileCount} file
                  {row.proofFileCount === 1 ? "" : "s"} staged
                </p>
              </div>

              <ReceivingRowActions
                lineLabel={line.itemLabel}
                shelfLocation={row.shelfLocation}
                proofFileCount={row.proofFileCount}
                onShelfAssigned={(shelf) =>
                  onUpdate(line.id, { shelfLocation: shelf })
                }
                onProofFilesAdded={(count) =>
                  onUpdate(line.id, {
                    proofFileCount: row.proofFileCount + count,
                  })
                }
              />
            </div>
          ) : null}
        </div>
      </div>
      ) : null}
    </article>
  );
}

function AwaitingBarrelPackagesTable({ lines }: { lines: WarehouseReceivingLine[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className="px-3 py-2.5 font-medium text-foreground">Customer</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Product</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Status</th>
            <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">Qty</th>
            <th className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
              Line value
            </th>
            <th className="px-3 py-2.5 font-medium text-foreground">Order</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Order item</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Batch</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const orderSlice = { status: line.orderStatus };
            const fulfillment = effectiveOrderItemFulfillmentStatus(
              line.orderItem,
              orderSlice,
            );
            const pendingRefund = line.pendingRefundRequest != null;
            const statusLabel = adminOrderLineStatusLabel(fulfillment, {
              pendingRefundRequest: pendingRefund,
            });
            return (
              <tr
                key={line.id}
                className="border-b border-border bg-background last:border-b-0 odd:bg-muted/15"
              >
                <td className="max-w-[12rem] px-3 py-2 align-top text-foreground">
                  <span className="line-clamp-2">{line.customerDisplayLabel}</span>
                </td>
                <td className="max-w-[14rem] px-3 py-2 align-top font-medium text-foreground">
                  <span className="line-clamp-2">{line.productName}</span>
                </td>
                <td className="max-w-[14rem] px-3 py-2 align-top text-muted-foreground">
                  <span className="line-clamp-2 text-xs leading-snug">{statusLabel}</span>
                </td>
                <td className="px-3 py-2 align-top tabular-nums text-foreground">
                  {line.orderedQty}
                </td>
                <td className="px-3 py-2 align-top tabular-nums text-foreground">
                  {formatUsd(line.orderItem.price)}
                </td>
                <td className="px-3 py-2 align-top font-mono text-xs text-foreground">
                  {shortId(line.orderNumber)}
                </td>
                <td className="px-3 py-2 align-top font-mono text-xs text-foreground">
                  {shortId(line.id)}
                </td>
                <td className="max-w-[10rem] px-3 py-2 align-top text-xs text-foreground">
                  <span className="line-clamp-2">{packageLineBatchLabel(line)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CustomerPackageGroup({
  group,
  rows,
  onUpdate,
}: {
  group: CustomerLineGroup;
  rows: Record<string, RowState>;
  onUpdate: (id: string, patch: Partial<RowState>) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-background">
      <button
        type="button"
        className="flex w-full flex-col gap-3 border-b border-border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/35 lg:flex-row lg:items-center lg:justify-between"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-start gap-3">
          <ChevronDownIcon
            className={`mt-1 size-4 shrink-0 transition-transform ${
              open ? "rotate-180" : "rotate-0"
            }`}
            aria-hidden
          />
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Customer package group
            </span>
            <span className="mt-1 block text-base font-semibold text-foreground">
              {group.displayLabel}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {open ? "Hide package files" : "Show package files"}
            </span>
          </span>
        </span>
        <span className="grid w-full grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:w-auto lg:min-w-[28rem]">
          <PackageMeta label="Files" value={group.lines.length} />
          <PackageMeta label="Units" value={group.totalQty} />
          <PackageMeta label="Value" value={formatUsd(group.totalValue)} />
          <PackageMeta label="Refund flags" value={group.refundCount} />
        </span>
      </button>

      {open ? (
        <div className="space-y-4 p-3">
          {group.lines.map((line) => {
            const row = rows[line.id];
            if (!row) return null;
            return (
              <PackageInventoryCard
                key={line.id}
                line={line}
                row={row}
                onUpdate={onUpdate}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function AdminWarehouseReceivingSection({
  lines,
}: {
  lines: WarehouseReceivingLine[];
}) {
  const [tableView, setTableView] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const map: Record<string, RowState> = {};
    for (const line of lines) {
      map[line.id] = {
        receivedQty: line.orderedQty,
        condition: "good",
        shelfLocation: "",
        proofFileCount: 0,
      };
    }
    return map;
  });

  const updateRow = (id: string, patch: Partial<RowState>) => {
    setRows((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const customerLineGroups = useMemo(() => {
    const byClerk = new Map<string, WarehouseReceivingLine[]>();
    for (const line of lines) {
      const list = byClerk.get(line.clerkUserId);
      if (list) list.push(line);
      else byClerk.set(line.clerkUserId, [line]);
    }
    const groups: (CustomerLineGroup & { sortKey: string })[] = [...byClerk.entries()].map(([clerkUserId, ls]) => ({
      clerkUserId,
      sortKey:
        ls[0]?.customerGroupSortKey ??
        adminCustomerSortKey({
          fullName: null,
          email: null,
          clerkUserId,
        }),
      displayLabel: ls[0]?.customerDisplayLabel ?? clerkUserId,
      totalQty: ls.reduce((sum, line) => sum + line.orderedQty, 0),
      totalValue: ls.reduce((sum, line) => sum + line.orderItem.price, 0),
      refundCount: ls.filter((line) => line.pendingRefundRequest != null).length,
      lines: ls,
    }));
    groups.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return groups;
  }, [lines]);

  const tableLines = useMemo(
    () => lines.filter(isLineAwaitingBarrelGoodStatus),
    [lines],
  );
  const summaryLines = tableView ? tableLines : lines;

  if (lines.length === 0) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Warehouse receiving
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No purchase-coordination lines on this page. When ops record retailer purchases,
            awaiting-inbound lines appear here (same queue as Purchase orders).
          </p>
        </div>
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing to receive yet.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="border-b border-border bg-muted/20 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                Packaging file inventory
              </p>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Receive, locate, and document package files
              </h2>
              <p className="text-sm text-muted-foreground">
                Each card is a receiving file for one package line. Staff can
                verify quantity, condition, shelf / bin, barcode, proof photos,
                and refund exceptions before the package moves into barrel or
                consolidation workflow.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[24rem]">
              <div className="flex flex-wrap items-center justify-end gap-2 lg:justify-start">
                <Switch
                  id="admin-packages-table-view"
                  checked={tableView}
                  onCheckedChange={setTableView}
                  aria-label="Switch to table view listing only good receipt awaiting barrel lines"
                />
                <Label
                  htmlFor="admin-packages-table-view"
                  className="cursor-pointer text-xs font-normal text-muted-foreground"
                >
                  Table view (awaiting barrel only)
                </Label>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs sm:min-w-[24rem]">
                <PackageMeta label="Package files" value={summaryLines.length} />
                <PackageMeta
                  label="Units expected"
                  value={summaryLines.reduce((sum, line) => sum + line.orderedQty, 0)}
                />
                <PackageMeta
                  label="Inventory value"
                  value={formatUsd(
                    summaryLines.reduce((sum, line) => sum + line.orderItem.price, 0),
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-4">
          {tableView ?
            tableLines.length === 0 ?
              <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                No package lines on this page currently show{" "}
                <span className="font-medium text-foreground">
                  Delivery received: good - awaiting barrel
                </span>{" "}
                (for example, a pending refund changes the headline). Turn off table view to see
                all package files.
              </p>
            : <AwaitingBarrelPackagesTable lines={tableLines} />
          : customerLineGroups.map((group) => (
              <CustomerPackageGroup
                key={group.clerkUserId}
                group={group}
                rows={rows}
                onUpdate={updateRow}
              />
            ))}
        </div>
      </div>
    </section>
  );
}
