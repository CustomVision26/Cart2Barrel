"use client";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { Fragment, useCallback, useEffect, useId, useMemo, useState } from "react";

import { AdminFindOrganizeVisibilityToggle } from "@/components/admin/admin-find-organize-visibility-toggle";
import { AdminNestedFindOrganizePanel } from "@/components/admin/admin-nested-find-organize-panel";
import { AdminCustomerRecordLabel } from "@/components/admin/admin-customer-record-label";
import { AdminStaffRecordLabel } from "@/components/admin/admin-staff-record-label";
import { BarrelAssignmentHistoryProduct } from "@/components/barrels/barrel-assignment-history-product";
import { Button } from "@/components/ui/button";
import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import type { AssignmentHistoryRow } from "@/data/barrel-package-assignment";
import { adminCustomerSortKey } from "@/lib/admin-customer-group";
import { cn } from "@/lib/utils";

export type AdminBarrelAssignmentHistoryRow = AssignmentHistoryRow;

const TABLE_COL_SPAN = 7;

type ProductAssignmentTrack = {
  packageId: string;
  events: AdminBarrelAssignmentHistoryRow[];
  latest: AdminBarrelAssignmentHistoryRow;
};

function eventMs(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatWhen(iso: string, compact = false): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: compact ? "short" : "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function actionLabel(action: AdminBarrelAssignmentHistoryRow["action"]): string {
  switch (action) {
    case "assigned":
      return "Assigned";
    case "reassigned":
      return "Reassigned";
    case "removed":
      return "Removed";
  }
}

function actionBadgeClass(action: AdminBarrelAssignmentHistoryRow["action"]): string {
  switch (action) {
    case "assigned":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "reassigned":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "removed":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  }
}

function ActionBadge({
  action,
  compact = false,
}: {
  action: AdminBarrelAssignmentHistoryRow["action"];
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full font-medium",
        actionBadgeClass(action),
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
      )}
    >
      {actionLabel(action)}
    </span>
  );
}

function rowMatchesQuery(
  row: AdminBarrelAssignmentHistoryRow,
  q: string,
  profile?: { fullName: string | null; email: string | null },
  staffProfile?: { fullName: string | null; email: string | null },
): boolean {
  if (!q) return true;
  const chunks = [
    row.productNameSnapshot,
    row.barrelLabelSnapshot,
    row.adminNote,
    row.ownerClerkUserId,
    row.actorClerkUserId,
    row.packageId,
    profile?.fullName,
    profile?.email,
    staffProfile?.fullName,
    staffProfile?.email,
    actionLabel(row.action),
  ];
  return chunks.some(
    (chunk) => chunk != null && String(chunk).toLowerCase().includes(q),
  );
}

function groupIntoProductTracks(
  events: AdminBarrelAssignmentHistoryRow[],
): ProductAssignmentTrack[] {
  const map = new Map<string, AdminBarrelAssignmentHistoryRow[]>();
  for (const event of events) {
    const list = map.get(event.packageId) ?? [];
    list.push(event);
    map.set(event.packageId, list);
  }

  return [...map.entries()]
    .map(([packageId, trackEvents]) => {
      const sorted = [...trackEvents].sort(
        (a, b) => eventMs(b.createdAt) - eventMs(a.createdAt),
      );
      return {
        packageId,
        events: sorted,
        latest: sorted[0]!,
      };
    })
    .sort((a, b) => eventMs(b.latest.createdAt) - eventMs(a.latest.createdAt));
}

function trackMatchesQuery(
  track: ProductAssignmentTrack,
  q: string,
  profile?: { fullName: string | null; email: string | null },
  profilesByClerkUserId?: Record<
    string,
    { fullName: string | null; email: string | null }
  >,
): boolean {
  return track.events.some((event) =>
    rowMatchesQuery(
      event,
      q,
      profile,
      profilesByClerkUserId?.[event.actorClerkUserId],
    ),
  );
}

function countProductTracks(rows: AdminBarrelAssignmentHistoryRow[]): number {
  return new Set(rows.map((row) => row.packageId)).size;
}

export function AdminBarrelAssignmentHistoryTable({
  rows,
  profilesByClerkUserId,
}: {
  rows: AdminBarrelAssignmentHistoryRow[];
  profilesByClerkUserId: Record<
    string,
    { fullName: string | null; email: string | null }
  >;
}) {
  const baseId = useId();
  const findOrganizeSwitchId = `${baseId}-find-organize`;
  const [search, setSearch] = useState("");
  const [findOrganizeVisible, setFindOrganizeVisible] = useState(true);
  const [openOwnerId, setOpenOwnerId] = useState<string | null>(null);
  const [panelChoiceMade, setPanelChoiceMade] = useState(false);
  const [openTrackKey, setOpenTrackKey] = useState<string | null>(null);
  const [lineSearch, setLineSearch] = useState("");
  const [lineFindOrganizeVisible, setLineFindOrganizeVisible] = useState(true);
  const [linePageSize, setLinePageSize] = useState<5 | 10 | 25 | 50>(10);
  const [linePage, setLinePage] = useState(1);
  const searchNorm = search.trim().toLowerCase();

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        rowMatchesQuery(
          row,
          searchNorm,
          profilesByClerkUserId[row.ownerClerkUserId],
          profilesByClerkUserId[row.actorClerkUserId],
        ),
      ),
    [rows, searchNorm, profilesByClerkUserId],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, AdminBarrelAssignmentHistoryRow[]>();
    for (const row of filteredRows) {
      const list = map.get(row.ownerClerkUserId) ?? [];
      list.push(row);
      map.set(row.ownerClerkUserId, list);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const profileA = profilesByClerkUserId[a];
      const profileB = profilesByClerkUserId[b];
      return adminCustomerSortKey({
        clerkUserId: a,
        fullName: profileA?.fullName,
        email: profileA?.email,
      }).localeCompare(
        adminCustomerSortKey({
          clerkUserId: b,
          fullName: profileB?.fullName,
          email: profileB?.email,
        }),
      );
    });
  }, [filteredRows, profilesByClerkUserId]);

  const activeOwnerId = panelChoiceMade ? openOwnerId : (grouped[0]?.[0] ?? null);
  const customerExpanded = activeOwnerId !== null;

  const toggleTrack = useCallback((trackKey: string) => {
    setOpenTrackKey((prev) => (prev === trackKey ? null : trackKey));
  }, []);

  useEffect(() => {
    setOpenTrackKey(null);
    setLinePage(1);
  }, [lineSearch, linePageSize, activeOwnerId]);

  function staffProfile(actorClerkUserId: string) {
    return profilesByClerkUserId[actorClerkUserId];
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No assignment events recorded yet.
      </p>
    );
  }

  const filteredProductCount = countProductTracks(filteredRows);

  return (
    <div className="space-y-4">
      {!customerExpanded ? (
      <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
        <AdminFindOrganizeVisibilityToggle
          id={findOrganizeSwitchId}
          visible={findOrganizeVisible}
          onVisibleChange={setFindOrganizeVisible}
        />
        {findOrganizeVisible ? (
          <>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-foreground">Search</span>
              <input
                id={`${baseId}-search`}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Product, barrel, customer, staff, action, note…"
                className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
                autoComplete="off"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              {filteredProductCount} product
              {filteredProductCount === 1 ? "" : "s"} · {filteredRows.length} event
              {filteredRows.length === 1 ? "" : "s"} across {grouped.length} customer
              {grouped.length === 1 ? "" : "s"}
            </p>
          </>
        ) : null}
      </div>
      ) : null}

      {grouped.length === 0 ? (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No assignment events match the current search.
        </p>
      ) : (
        grouped.map(([ownerId, ownerRows]) => {
          const expanded = activeOwnerId === ownerId;
          const ownerProfile = profilesByClerkUserId[ownerId];
          const lineNorm = lineSearch.trim().toLowerCase();
          const ownerTracks = groupIntoProductTracks(ownerRows);
          const lineFiltered = ownerTracks.filter((track) =>
            trackMatchesQuery(track, lineNorm, ownerProfile, profilesByClerkUserId),
          );
          const lineCount = lineFiltered.length;
          const lineTotalPages = Math.max(1, Math.ceil(lineCount / linePageSize));
          const linePageSafe = Math.min(Math.max(1, linePage), lineTotalPages);
          const lineStart = (linePageSafe - 1) * linePageSize;
          const lineSlice = lineFiltered.slice(lineStart, lineStart + linePageSize);
          const lineShowFrom = lineCount === 0 ? 0 : lineStart + 1;
          const lineShowTo = Math.min(lineStart + linePageSize, lineCount);

          return (
            <section
              key={ownerId}
              className="overflow-hidden rounded-lg border border-border"
            >
              <button
                type="button"
                className={cn(
                  "flex w-full flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-3 py-2.5 text-left hover:bg-muted/45",
                  expanded && "bg-muted/40",
                )}
                aria-expanded={expanded}
                onClick={() => {
                  setPanelChoiceMade(true);
                  const next = activeOwnerId === ownerId ? null : ownerId;
                  if (next !== activeOwnerId) {
                    setLineSearch("");
                    setOpenTrackKey(null);
                  }
                  setOpenOwnerId(next);
                }}
              >
                {expanded ? (
                  <ChevronDownIcon className="size-4 shrink-0" aria-hidden />
                ) : (
                  <ChevronRightIcon className="size-4 shrink-0" aria-hidden />
                )}
                <AdminCustomerRecordLabel
                  clerkUserId={ownerId}
                  fullName={ownerProfile?.fullName}
                  email={ownerProfile?.email}
                  primaryClassName="text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  ({ownerTracks.length} product{ownerTracks.length === 1 ? "" : "s"} ·{" "}
                  {ownerRows.length} event{ownerRows.length === 1 ? "" : "s"})
                </span>
              </button>

              {expanded ? (
                <div className="space-y-3 p-3">
                  <AdminNestedFindOrganizePanel
                    switchId={`${baseId}-line-find-organize-${ownerId}`}
                    searchInputId={`${baseId}-line-search-${ownerId}`}
                    pageSizeSelectId={`${baseId}-line-page-size-${ownerId}`}
                    visible={lineFindOrganizeVisible}
                    onVisibleChange={setLineFindOrganizeVisible}
                    search={lineSearch}
                    onSearchChange={setLineSearch}
                    searchLabel="Search products"
                    searchPlaceholder="Product, barrel, staff, action, note…"
                    pageSize={linePageSize}
                    onPageSizeChange={setLinePageSize}
                    pageSizeLabel="Products per page"
                    showFrom={lineShowFrom}
                    showTo={lineShowTo}
                    totalCount={lineCount}
                    totalLoaded={ownerTracks.length}
                    itemLabel="product"
                    className="mb-0"
                  />

                  <p className="text-[11px] text-muted-foreground">
                    Each row shows the latest action for a product.{" "}
                    <span className="font-medium text-foreground">Updated by</span>{" "}
                    shows the admin name and email who made the change. Double-click a
                    row for full history (newest first).
                  </p>

                  <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border bg-background">
                    <table className="w-full min-w-[52rem] border-collapse text-left text-xs">
                      <thead className="border-b border-border bg-muted/40 text-[11px] text-muted-foreground">
                        <tr>
                          <th className="min-w-[10rem] px-2 py-1.5 font-medium">
                            Product
                          </th>
                          <th className="min-w-[9rem] px-2 py-1.5 font-medium whitespace-nowrap">
                            Updated by
                          </th>
                          <th className="px-2 py-1.5 font-medium whitespace-nowrap">
                            Latest action
                          </th>
                          <th className="px-2 py-1.5 font-medium whitespace-nowrap">
                            Last updated
                          </th>
                          <th className="min-w-[9rem] px-2 py-1.5 font-medium">
                            Barrel / movement
                          </th>
                          <th className="px-2 py-1.5 font-medium text-right">Events</th>
                          <th className="min-w-[8rem] px-2 py-1.5 font-medium">
                            Latest note
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {lineSlice.length === 0 ? (
                          <tr>
                            <td
                              colSpan={TABLE_COL_SPAN}
                              className="px-4 py-8 text-center text-sm text-muted-foreground"
                            >
                              {lineSearch.trim()
                                ? "No products match the current search."
                                : "No products for this customer."}
                            </td>
                          </tr>
                        ) : null}
                        {lineSlice.map((track) => {
                          const { latest, events } = track;
                          const trackKey = `${ownerId}:${track.packageId}`;
                          const trackExpanded = openTrackKey === trackKey;
                          const priorEvents = events.slice(1);

                          return (
                            <Fragment key={track.packageId}>
                              <tr
                                className={cn(
                                  "cursor-pointer transition-colors hover:bg-muted/25",
                                  trackExpanded && "bg-muted/20",
                                )}
                                title="Double-click to show full action history"
                                onDoubleClick={() => toggleTrack(trackKey)}
                              >
                                <td className="max-w-[14rem] px-2 py-1.5">
                                  <BarrelAssignmentHistoryProduct
                                    productName={latest.productNameSnapshot}
                                    productImageUrl={latest.productImageUrl}
                                    quantity={latest.quantity}
                                    compact
                                  />
                                </td>
                                <td className="min-w-[9rem] max-w-[11rem] px-2 py-1.5">
                                  <AdminStaffRecordLabel
                                    clerkUserId={latest.actorClerkUserId}
                                    fullName={
                                      staffProfile(latest.actorClerkUserId)?.fullName
                                    }
                                    email={
                                      staffProfile(latest.actorClerkUserId)?.email
                                    }
                                    primaryClassName="text-xs font-semibold"
                                    secondaryClassName="text-[10px]"
                                  />
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap">
                                  <ActionBadge action={latest.action} compact />
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap tabular-nums text-muted-foreground">
                                  <time dateTime={latest.createdAt}>
                                    {formatWhen(latest.createdAt, true)}
                                  </time>
                                </td>
                                <td
                                  className="max-w-[11rem] truncate px-2 py-1.5 text-muted-foreground"
                                  title={latest.barrelLabelSnapshot?.trim() || undefined}
                                >
                                  {latest.barrelLabelSnapshot?.trim() || "—"}
                                </td>
                                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                  {events.length}
                                </td>
                                <td
                                  className="max-w-[10rem] truncate px-2 py-1.5 text-muted-foreground"
                                  title={latest.adminNote?.trim() || undefined}
                                >
                                  {latest.adminNote?.trim() || "—"}
                                </td>
                              </tr>
                              {trackExpanded ? (
                                <tr className="bg-muted/10">
                                  <td colSpan={TABLE_COL_SPAN} className="p-0">
                                    <div className="border-t border-border px-3 py-2">
                                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                        Action history · {events.length} record
                                        {events.length === 1 ? "" : "s"} (newest first)
                                      </p>
                                      <table className="w-full min-w-[46rem] border-collapse text-left text-[11px]">
                                        <thead className="border-b border-border/80 text-muted-foreground">
                                          <tr>
                                            <th className="px-2 py-1 font-medium">
                                              When
                                            </th>
                                            <th className="px-2 py-1 font-medium">
                                              Action
                                            </th>
                                            <th className="min-w-[9rem] px-2 py-1 font-medium">
                                              Updated by
                                            </th>
                                            <th className="px-2 py-1 font-medium">
                                              Barrel / movement
                                            </th>
                                            <th className="px-2 py-1 font-medium">
                                              Note
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60">
                                          {events.map((event, index) => (
                                            <tr
                                              key={event.id}
                                              className={cn(
                                                index === 0 && "bg-primary/5",
                                              )}
                                            >
                                              <td className="whitespace-nowrap px-2 py-1 tabular-nums text-muted-foreground">
                                                <time dateTime={event.createdAt}>
                                                  {formatWhen(event.createdAt, true)}
                                                </time>
                                                {index === 0 ? (
                                                  <span className="ml-1.5 text-[10px] font-medium text-primary">
                                                    current
                                                  </span>
                                                ) : null}
                                              </td>
                                              <td className="px-2 py-1 whitespace-nowrap">
                                                <ActionBadge
                                                  action={event.action}
                                                  compact
                                                />
                                              </td>
                                              <td className="min-w-[9rem] max-w-[11rem] px-2 py-1">
                                                <AdminStaffRecordLabel
                                                  clerkUserId={event.actorClerkUserId}
                                                  fullName={
                                                    staffProfile(event.actorClerkUserId)
                                                      ?.fullName
                                                  }
                                                  email={
                                                    staffProfile(event.actorClerkUserId)
                                                      ?.email
                                                  }
                                                  primaryClassName="text-[11px] font-semibold"
                                                  secondaryClassName="text-[10px]"
                                                />
                                              </td>
                                              <td
                                                className="max-w-[12rem] truncate px-2 py-1 text-muted-foreground"
                                                title={
                                                  event.barrelLabelSnapshot?.trim() ||
                                                  undefined
                                                }
                                              >
                                                {event.barrelLabelSnapshot?.trim() || "—"}
                                              </td>
                                              <td
                                                className="max-w-[10rem] truncate px-2 py-1 text-muted-foreground"
                                                title={event.adminNote?.trim() || undefined}
                                              >
                                                {event.adminNote?.trim() || "—"}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      {priorEvents.length === 0 ? (
                                        <p className="mt-2 text-[11px] text-muted-foreground">
                                          No earlier actions — this product has a single
                                          recorded event.
                                        </p>
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </FloatingHorizontalScroll>

                  {lineCount > linePageSize ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={linePageSafe <= 1}
                        onClick={() => setLinePage((p) => Math.max(1, p - 1))}
                      >
                        Previous products
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={linePageSafe >= lineTotalPages}
                        onClick={() =>
                          setLinePage((p) => Math.min(lineTotalPages, p + 1))
                        }
                      >
                        Next products
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}
