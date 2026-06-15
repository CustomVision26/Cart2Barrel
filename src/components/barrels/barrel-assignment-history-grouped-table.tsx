"use client";

import { Fragment, useCallback, useId, useMemo, useState } from "react";

import { BarrelAssignmentHistoryProduct } from "@/components/barrels/barrel-assignment-history-product";
import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssignmentHistoryRow } from "@/data/barrel-package-assignment";
import {
  assignmentHistoryActionBadgeClass,
  assignmentHistoryActionLabel,
  assignmentHistoryRowMatchesQuery,
  formatAssignmentHistoryWhen,
  groupAssignmentHistoryIntoProductTracks,
} from "@/lib/barrel-assignment-history-display";
import { cn } from "@/lib/utils";

const TABLE_COL_SPAN = 6;

function ActionBadge({
  action,
  compact = false,
}: {
  action: AssignmentHistoryRow["action"];
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full font-medium",
        assignmentHistoryActionBadgeClass(action),
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
      )}
    >
      {assignmentHistoryActionLabel(action)}
    </span>
  );
}

export function BarrelAssignmentHistoryGroupedTable({
  rows,
}: {
  rows: AssignmentHistoryRow[];
}) {
  const baseId = useId();
  const [search, setSearch] = useState("");
  const [openTrackKey, setOpenTrackKey] = useState<string | null>(null);

  const searchNorm = search.trim().toLowerCase();

  const filteredRows = useMemo(
    () => rows.filter((row) => assignmentHistoryRowMatchesQuery(row, searchNorm)),
    [rows, searchNorm],
  );

  const tracks = useMemo(
    () => groupAssignmentHistoryIntoProductTracks(filteredRows),
    [filteredRows],
  );

  const toggleTrack = useCallback((packageId: string) => {
    setOpenTrackKey((prev) => (prev === packageId ? null : packageId));
  }, []);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No assignment history yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-border/80 bg-card p-4 ring-1 ring-foreground/5">
        <Label htmlFor={`${baseId}-search`} className="text-xs font-medium">
          Search products
        </Label>
        <Input
          id={`${baseId}-search`}
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpenTrackKey(null);
          }}
          placeholder="Product, barrel, action, note…"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          {tracks.length} product{tracks.length === 1 ? "" : "s"} · {filteredRows.length}{" "}
          event{filteredRows.length === 1 ? "" : "s"}
        </p>
      </div>

      {tracks.length === 0 ?
        <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No assignment events match the current search.
        </p>
      : <>
          <p className="text-[11px] text-muted-foreground">
            Each row is one product with its latest barrel move.{" "}
            <span className="font-medium text-foreground">Double-click a row</span> to
            open the full action history (newest first).
          </p>

          <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border/80 bg-card ring-1 ring-foreground/5">
            <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="min-w-[12rem] px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">
                    Latest action
                  </th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">
                    Last updated
                  </th>
                  <th className="min-w-[10rem] px-3 py-2 font-medium">
                    Barrel / movement
                  </th>
                  <th className="px-3 py-2 font-medium text-right">Events</th>
                  <th className="min-w-[8rem] px-3 py-2 font-medium">Latest note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80">
                {tracks.map((track) => {
                  const { latest, events } = track;
                  const trackExpanded = openTrackKey === track.packageId;
                  const priorEvents = events.slice(1);

                  return (
                    <Fragment key={track.packageId}>
                      <tr
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/80",
                          trackExpanded && "bg-muted/80",
                        )}
                        title="Double-click to show full action history"
                        onDoubleClick={() => toggleTrack(track.packageId)}
                      >
                        <td className="max-w-[14rem] px-3 py-2">
                          <BarrelAssignmentHistoryProduct
                            productName={latest.productNameSnapshot}
                            productImageUrl={latest.productImageUrl}
                            quantity={latest.quantity}
                            compact
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <ActionBadge action={latest.action} compact />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums text-muted-foreground">
                          <time dateTime={latest.createdAt}>
                            {formatAssignmentHistoryWhen(latest.createdAt, true)}
                          </time>
                        </td>
                        <td
                          className="max-w-[11rem] truncate px-3 py-2 text-muted-foreground"
                          title={latest.barrelLabelSnapshot?.trim() || undefined}
                        >
                          {latest.barrelLabelSnapshot?.trim() || "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {events.length}
                        </td>
                        <td
                          className="max-w-[10rem] truncate px-3 py-2 text-muted-foreground"
                          title={latest.adminNote?.trim() || undefined}
                        >
                          {latest.adminNote?.trim() || "—"}
                        </td>
                      </tr>
                      {trackExpanded ?
                        <tr className="bg-secondary/60">
                          <td colSpan={TABLE_COL_SPAN} className="p-0">
                            <div className="border-t border-border px-3 py-2">
                              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Action history · {events.length} record
                                {events.length === 1 ? "" : "s"} (newest first)
                              </p>
                              <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
                                <thead className="border-b border-border/80 text-muted-foreground">
                                  <tr>
                                    <th className="px-2 py-1 font-medium">When</th>
                                    <th className="px-2 py-1 font-medium">Action</th>
                                    <th className="px-2 py-1 font-medium">
                                      Barrel / movement
                                    </th>
                                    <th className="px-2 py-1 font-medium">Note</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                  {events.map((event, index) => (
                                    <tr
                                      key={event.id}
                                      className={cn(index === 0 && "bg-primary/5")}
                                    >
                                      <td className="whitespace-nowrap px-2 py-1 tabular-nums text-muted-foreground">
                                        <time dateTime={event.createdAt}>
                                          {formatAssignmentHistoryWhen(
                                            event.createdAt,
                                            true,
                                          )}
                                        </time>
                                        {index === 0 ?
                                          <span className="ml-1.5 text-[10px] font-medium text-primary">
                                            current
                                          </span>
                                        : null}
                                      </td>
                                      <td className="px-2 py-1 whitespace-nowrap">
                                        <ActionBadge action={event.action} compact />
                                      </td>
                                      <td
                                        className="max-w-[12rem] truncate px-2 py-1 text-muted-foreground"
                                        title={
                                          event.barrelLabelSnapshot?.trim() || undefined
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
                              {priorEvents.length === 0 ?
                                <p className="mt-2 text-[11px] text-muted-foreground">
                                  No earlier actions — this product has a single recorded
                                  event.
                                </p>
                              : null}
                            </div>
                          </td>
                        </tr>
                      : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </FloatingHorizontalScroll>
        </>
      }
    </div>
  );
}
