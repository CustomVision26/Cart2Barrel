"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";

import {
  AdminPackageFileCard,
  packageIntakeRowStateFromLine,
  type PackageIntakeRowState,
} from "@/components/admin/admin-package-file-card";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  adminCustomerSortKey,
} from "@/lib/admin-customer-group";
import { adminOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import type { WarehouseReceivingLine } from "@/lib/admin-warehouse-receiving-types";
import { formatUsd } from "@/lib/admin-markup";

export type { WarehouseReceivingLine } from "@/lib/admin-warehouse-receiving-types";
export type { WarehouseReceiveCondition } from "@/components/admin/receiving-row-actions";

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


function AwaitingBarrelPackagesTable({ lines }: { lines: WarehouseReceivingLine[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className="px-3 py-2.5 font-medium text-foreground">Customer</th>
            <th className="w-14 px-3 py-2.5 font-medium text-foreground">Image</th>
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
                <td className="px-3 py-2 align-top">
                  <ProductRequestThumbnail
                    variant="admin"
                    imageUrl={line.productImageUrl}
                    productLabel={line.productName}
                  />
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
  rows: Record<string, PackageIntakeRowState>;
  onUpdate: (id: string, patch: Partial<PackageIntakeRowState>) => void;
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

      {open ?
        <div className="grid grid-cols-1 gap-2 p-3 min-[520px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {group.lines.map((line) => {
            const row = rows[line.id];
            if (!row) return null;
            return (
              <AdminPackageFileCard
                key={line.id}
                line={line}
                row={row}
                onUpdate={(patch) => onUpdate(line.id, patch)}
              />
            );
          })}
        </div>
      : null}
    </section>
  );
}

export function AdminWarehouseReceivingSection({
  lines,
}: {
  lines: WarehouseReceivingLine[];
}) {
  const [tableView, setTableView] = useState(false);
  const [rows, setRows] = useState<Record<string, PackageIntakeRowState>>(() => {
    const map: Record<string, PackageIntakeRowState> = {};
    for (const line of lines) {
      map[line.id] = packageIntakeRowStateFromLine(line);
    }
    return map;
  });

  const updateRow = (id: string, patch: Partial<PackageIntakeRowState>) => {
    setRows((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  useEffect(() => {
    setRows((prev) => {
      const next = { ...prev };
      for (const line of lines) {
        const fromServer = packageIntakeRowStateFromLine(line);
        if (!next[line.id]) {
          next[line.id] = fromServer;
          continue;
        }
        next[line.id] = {
          ...next[line.id],
          proofPhotoUrls: fromServer.proofPhotoUrls,
          proofFileCount: fromServer.proofFileCount,
        };
      }
      return next;
    });
  }, [lines]);

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

  const summaryLines = lines;

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
                Each card shows one package awaiting barrel. Use Preview intake to
                review recorded data, or Edit intake to update quantity, condition,
                shelf, barcode, and proof photos before assign-to-barrel.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[24rem]">
              <div className="flex flex-wrap items-center justify-end gap-2 lg:justify-start">
                <Switch
                  id="admin-packages-table-view"
                  checked={tableView}
                  onCheckedChange={setTableView}
                  aria-label="Switch to table view for all package lines"
                />
                <Label
                  htmlFor="admin-packages-table-view"
                  className="cursor-pointer text-xs font-normal text-muted-foreground"
                >
                  Table view
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
            lines.length === 0 ?
              <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                No package lines match the current filters.
              </p>
            : <AwaitingBarrelPackagesTable lines={lines} />
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
