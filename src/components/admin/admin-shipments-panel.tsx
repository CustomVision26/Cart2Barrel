"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId, useState } from "react";

import { AdminShippingChargeIntakeCard } from "@/components/admin/admin-shipping-charge-intake-card";
import { AdminCustomerRecordLabel } from "@/components/admin/admin-customer-record-label";
import type { AdminStaffProfilesByClerkUserId } from "@/lib/admin-staff-profiles";
import { AdminNestedFindOrganizePanel } from "@/components/admin/admin-nested-find-organize-panel";
import type { AdminShipmentCustomerGroup } from "@/lib/barrel-outbound-shipping-charge";
import type { AdminBarrelOutboundShippingChargeRow } from "@/lib/barrel-outbound-shipping-charge";
import { cn } from "@/lib/utils";

const NOT_READY_LOCK_MESSAGE =
  "Container is still being packed. Publish charges after it is full and the customer confirms shipping on Dashboard → Shipping.";

function containerMatchesQuery(
  row: AdminBarrelOutboundShippingChargeRow,
  q: string,
): boolean {
  if (!q) return true;
  const chunks = [
    row.barrelId,
    row.alias,
    row.slotLabel,
    row.containerName,
    row.customerName,
    row.customerEmail,
  ];
  return chunks.some(
    (chunk) => chunk != null && String(chunk).toLowerCase().includes(q),
  );
}

function CustomerShipmentSection({
  group,
  expanded,
  onExpandedChange,
  lineSearch,
  onLineSearchChange,
  lineFindOrganizeVisible,
  onLineFindOrganizeVisibleChange,
  linePageSize,
  onLinePageSizeChange,
  panelIds,
  staffProfilesByClerkUserId = {},
}: {
  group: AdminShipmentCustomerGroup;
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
  lineSearch: string;
  onLineSearchChange: (value: string) => void;
  lineFindOrganizeVisible: boolean;
  onLineFindOrganizeVisibleChange: (visible: boolean) => void;
  linePageSize: 5 | 10 | 25 | 50;
  onLinePageSizeChange: (size: 5 | 10 | 25 | 50) => void;
  panelIds: { switchId: string; searchId: string; pageSizeId: string };
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
}) {
  const allContainers = [
    ...group.readyContainers.map((row) => ({ row, ready: true as const })),
    ...group.notReadyContainers.map((row) => ({ row, ready: false as const })),
  ];
  const searchNorm = lineSearch.trim().toLowerCase();
  const filtered = allContainers.filter(({ row }) =>
    containerMatchesQuery(row, searchNorm),
  );
  const lineCount = filtered.length;
  const lineShowFrom = lineCount === 0 ? 0 : 1;
  const lineShowTo = Math.min(linePageSize, lineCount);
  const visible = filtered.slice(0, linePageSize);
  const readyVisible = visible.filter((v) => v.ready);
  const notReadyVisible = visible.filter((v) => !v.ready);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-background">
      <button
        type="button"
        className="flex w-full flex-col gap-2 border-b border-border bg-muted p-4 text-left transition-colors hover:bg-accent"
        onClick={() => onExpandedChange(!expanded)}
        aria-expanded={expanded}
      >
        <span className="flex items-start gap-3">
          <ChevronDownIcon
            className={cn(
              "mt-0.5 size-4 shrink-0 transition-transform",
              expanded ? "rotate-180" : "rotate-0",
            )}
            aria-hidden
          />
          <span className="min-w-0">
            <AdminCustomerRecordLabel
              clerkUserId={group.clerkUserId}
              fullName={group.customerName}
              email={group.customerEmail}
              primaryClassName="text-lg font-semibold tracking-tight"
              secondaryClassName="text-sm"
            />
          </span>
        </span>
      </button>

      {expanded ? (
        <div className="space-y-5 p-4">
          <AdminNestedFindOrganizePanel
            switchId={panelIds.switchId}
            searchInputId={panelIds.searchId}
            pageSizeSelectId={panelIds.pageSizeId}
            visible={lineFindOrganizeVisible}
            onVisibleChange={onLineFindOrganizeVisibleChange}
            search={lineSearch}
            onSearchChange={onLineSearchChange}
            searchLabel="Search containers"
            searchPlaceholder="Container label, alias, customer…"
            pageSize={linePageSize}
            onPageSizeChange={onLinePageSizeChange}
            pageSizeLabel="Containers per page"
            showFrom={lineShowFrom}
            showTo={lineShowTo}
            totalCount={lineCount}
            totalLoaded={allContainers.length}
            itemLabel="container"
            className="mb-0"
          />

          {visible.length === 0 ? (
            <p className="rounded-lg border border-border/80 bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              {lineSearch.trim()
                ? "No containers match the current search."
                : "No containers for this customer."}
            </p>
          ) : null}

          {readyVisible.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">
                Ready for shipping ({readyVisible.length})
              </h3>
              <div className="grid gap-3">
                {readyVisible.map(({ row }) => (
                  <AdminShippingChargeIntakeCard
                    key={row.barrelId}
                    row={row}
                    publishEnabled={!row.paidAt}
                    staffProfilesByClerkUserId={staffProfilesByClerkUserId}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {notReadyVisible.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Not ready for shipping ({notReadyVisible.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Still filling — customer cannot confirm shipping or pay outbound
                charges yet.
              </p>
              <div className="grid gap-3">
                {notReadyVisible.map(({ row }) => (
                  <AdminShippingChargeIntakeCard
                    key={row.barrelId}
                    row={row}
                    publishEnabled={false}
                    lockMessage={NOT_READY_LOCK_MESSAGE}
                    staffProfilesByClerkUserId={staffProfilesByClerkUserId}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function AdminShipmentsPanel({
  customerGroups,
  showPreview,
  previewRow,
  staffProfilesByClerkUserId = {},
}: {
  customerGroups: AdminShipmentCustomerGroup[];
  showPreview: boolean;
  previewRow: AdminBarrelOutboundShippingChargeRow;
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
}) {
  const baseId = useId();
  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null);
  const [panelChoiceMade, setPanelChoiceMade] = useState(false);
  const [lineSearch, setLineSearch] = useState("");
  const [lineFindOrganizeVisible, setLineFindOrganizeVisible] = useState(true);
  const [linePageSize, setLinePageSize] = useState<5 | 10 | 25 | 50>(10);

  const activeCustomerId =
    panelChoiceMade ? openCustomerId : (customerGroups[0]?.clerkUserId ?? null);

  return (
    <div className="grid max-w-2xl gap-8">
      {showPreview ? (
        <section className="space-y-3">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Charge intake (preview)
            </h2>
            <p className="text-sm text-muted-foreground">
              This is the form you will use once customers have containers in the
              system.
            </p>
          </header>
          <AdminShippingChargeIntakeCard
            row={previewRow}
            publishEnabled={false}
            lockMessage="Preview only — publish unlocks when a customer has a full container on Dashboard → Shipping."
            staffProfilesByClerkUserId={staffProfilesByClerkUserId}
          />
        </section>
      ) : null}

      {customerGroups.map((group) => (
        <CustomerShipmentSection
          key={group.clerkUserId}
          group={group}
          expanded={activeCustomerId === group.clerkUserId}
          onExpandedChange={(next) => {
            setPanelChoiceMade(true);
            if (next) {
              setOpenCustomerId(group.clerkUserId);
              setLineSearch("");
            } else if (activeCustomerId === group.clerkUserId) {
              setOpenCustomerId(null);
            }
          }}
          lineSearch={lineSearch}
          onLineSearchChange={setLineSearch}
          lineFindOrganizeVisible={lineFindOrganizeVisible}
          onLineFindOrganizeVisibleChange={setLineFindOrganizeVisible}
          linePageSize={linePageSize}
          onLinePageSizeChange={setLinePageSize}
          panelIds={{
            switchId: `${baseId}-line-find-organize-${group.clerkUserId}`,
            searchId: `${baseId}-line-search-${group.clerkUserId}`,
            pageSizeId: `${baseId}-line-page-size-${group.clerkUserId}`,
          }}
          staffProfilesByClerkUserId={staffProfilesByClerkUserId}
        />
      ))}
    </div>
  );
}
