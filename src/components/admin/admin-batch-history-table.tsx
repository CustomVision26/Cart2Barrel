"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import type { AdminBatchHistoryBundle } from "@/data/batch-quote-sessions";
import type { BatchQuoteEstimate, ItemRequestLineSnapshot } from "@/db/schema";
import { AdminFindOrganizeVisibilityToggle } from "@/components/admin/admin-find-organize-visibility-toggle";
import { AdminCustomerRecordLabel } from "@/components/admin/admin-customer-record-label";
import { AdminUpdatedByCell } from "@/components/admin/admin-staff-record-label";
import type { AdminStaffProfilesByClerkUserId } from "@/lib/admin-staff-profiles";
import {
  batchEstimateRecordedByClerkUserId,
  snapshotRecordedByClerkUserId,
} from "@/lib/admin-staff-profiles";
import { AdminNestedFindOrganizePanel } from "@/components/admin/admin-nested-find-organize-panel";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatUsd } from "@/lib/admin-markup";
import {
  adminCustomerSortKey,
} from "@/lib/admin-customer-group";
import { displaySiteName } from "@/lib/site-name";
import { compareLocale, compareNum, type SortDir } from "@/lib/table-sort";
import { adminParentControlsDisabledClass } from "@/lib/admin-parent-controls-disabled";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

type StatusFilter = "all" | "submitted" | "estimated";
type EstimateFilter = "all" | "with_estimate" | "no_estimate";
type SortKey =
  | "batchNumber"
  | "sentAt"
  | "customer"
  | "status"
  | "subtotal";

const SELECT_CLASS =
  "h-8 min-w-[9rem] rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function EstimateRevisionBrief({
  est,
  staffProfilesByClerkUserId,
}: {
  est: BatchQuoteEstimate;
  staffProfilesByClerkUserId: AdminStaffProfilesByClerkUserId;
}) {
  const voided = est.voidedAt != null && String(est.voidedAt).trim() !== "";
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border border-border bg-background/80 px-2.5 py-2 tabular-nums text-xs">
      <span className="min-w-0 flex-1 text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide text-foreground/80">
          {voided ? "Superseded" : "Active"}
        </span>
        {voided && est.voidedAt?.trim() ? (
          <>
            {" "}
            <time dateTime={est.voidedAt} className="text-[11px]">
              {new Date(est.voidedAt).toLocaleString(undefined, {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </time>
          </>
        ) : (
          <>
            {" "}
            · saved{" "}
            <time dateTime={est.createdAt}>
              {new Date(est.createdAt).toLocaleString(undefined, {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </time>
          </>
        )}
      </span>
      <span className="min-w-[9rem] max-w-[11rem] shrink-0">
        <AdminUpdatedByCell
          clerkUserId={batchEstimateRecordedByClerkUserId(est)}
          profilesByClerkUserId={staffProfilesByClerkUserId}
          primaryClassName="text-[11px] font-medium"
          secondaryClassName="text-[10px] text-muted-foreground"
        />
      </span>
      <span className="font-medium text-foreground">{formatUsd(est.subtotalCents)}</span>
    </li>
  );
}

function snapshotMeta(snap: ItemRequestLineSnapshot): string[] {
  const parts: string[] = [];
  if (snap.productSize?.trim()) parts.push(`Size: ${snap.productSize.trim()}`);
  if (snap.productColor?.trim()) parts.push(`Color: ${snap.productColor.trim()}`);
  return parts;
}

function SnapshotBrief({ snap }: { snap: ItemRequestLineSnapshot | null }) {
  if (!snap) {
    return <span className="text-muted-foreground">—</span>;
  }
  const extras = snapshotMeta(snap);
  const trimmedNote = snap.note?.trim();
  const note = !trimmedNote
    ? null
    : trimmedNote.length > 140
      ? `${trimmedNote.slice(0, 137)}…`
      : trimmedNote;

  return (
    <div className="space-y-1">
      <p className="font-medium leading-tight text-foreground">
        {snap.productName?.trim() || "Product"}
      </p>
      <p className="text-[11px] text-muted-foreground">
        Qty{" "}
        <span className="tabular-nums text-foreground">{snap.quantity}</span>
        {extras.length ? ` · ${extras.join(" · ")}` : ""}
      </p>
      <p className="break-all text-[11px] text-muted-foreground">
        {displaySiteName(snap.siteName, snap.productUrl)}
      </p>
      {note ? (
        <p className="whitespace-pre-wrap text-[11px] text-muted-foreground/90">
          {note}
        </p>
      ) : null}
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
        {new Date(snap.createdAt).toLocaleString(undefined, {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </p>
    </div>
  );
}

function batchCustomerLabel(bundle: AdminBatchHistoryBundle): string {
  const n = bundle.userFullName?.trim();
  if (n) return n;
  const e = bundle.userEmail?.trim();
  if (e) return e;
  return bundle.session.clerkUserId.slice(0, 12);
}

function bundleSentMs(bundle: AdminBatchHistoryBundle): number {
  const s = bundle.session.submittedAt?.trim();
  if (s) {
    const t = new Date(s).getTime();
    if (Number.isFinite(t)) return t;
  }
  const c = bundle.session.createdAt?.trim();
  if (c) {
    const t = new Date(c).getTime();
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

function bundleSubtotalCents(bundle: AdminBatchHistoryBundle): number {
  return bundle.latestEstimate?.subtotalCents ?? -1;
}

function BatchHistoryArticle({
  bundle,
  staffProfilesByClerkUserId,
}: {
  bundle: AdminBatchHistoryBundle;
  staffProfilesByClerkUserId: AdminStaffProfilesByClerkUserId;
}) {
  const estimate = bundle.latestEstimate;
  const session = bundle.session;

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold text-foreground">
            {session.batchNumber}
          </p>
          <p className="text-xs text-muted-foreground">{session.siteKey}</p>
        </div>
        <div className="text-right text-xs">
          <p className="font-medium text-foreground">{batchCustomerLabel(bundle)}</p>
          {bundle.userEmail?.trim() ? (
            <p className="truncate text-muted-foreground">{bundle.userEmail}</p>
          ) : null}
        </div>
        <dl className="flex w-full flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted-foreground sm:w-auto">
          <div className="flex gap-2">
            <dt className="font-medium uppercase tracking-wide text-foreground/80">
              Status
            </dt>
            <dd className="capitalize text-foreground">{session.status}</dd>
          </div>
          {session.submittedAt ? (
            <div className="flex gap-2">
              <dt className="font-medium uppercase tracking-wide text-foreground/80">
                Sent
              </dt>
              <dd className="text-foreground">
                {new Date(session.submittedAt).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </dd>
            </div>
          ) : null}
          {estimate ? (
            <div className="flex gap-2">
              <dt className="font-medium uppercase tracking-wide text-foreground/80">
                Estimate subtotal
              </dt>
              <dd className="tabular-nums font-medium text-foreground">
                {formatUsd(estimate.subtotalCents)}
              </dd>
            </div>
          ) : null}
        </dl>
      </header>

      {bundle.submissionEvents.length > 0 ? (
        <div className="border-b border-border bg-muted/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Shopper submissions
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Chronological rounds frozen when the shopper sent this bundle (or asked staff to revise
            it after a quote).
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 py-0 pl-5 text-xs text-foreground">
            {bundle.submissionEvents.map((ev, idx) => (
              <li key={`${ev.createdAt}-${idx}`}>
                <span className="font-medium">
                  {ev.kind === "initial_submission"
                    ? "Initial submission"
                    : "Customer resend"}
                </span>
                <span className="text-muted-foreground"> · </span>
                <time dateTime={ev.createdAt}>
                  {new Date(ev.createdAt).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </time>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {bundle.estimateRevisions.length > 0 ? (
        <div className="border-b border-border bg-muted/15 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Combined estimate revisions
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Newest first. Editing from Batch estimates voids the prior row and records a new active
            total—customers see the latest active line only.
          </p>
          <ol className="mt-2 list-none space-y-2 p-0">
            {bundle.estimateRevisions.map((est) => (
              <EstimateRevisionBrief
                key={est.id}
                est={est}
                staffProfilesByClerkUserId={staffProfilesByClerkUserId}
              />
            ))}
          </ol>
        </div>
      ) : null}

      {bundle.lines.every((l) => !l.submissionSnapshot && !l.estimateAdminSnapshot) ? (
        <div className="px-4 py-6 text-sm text-muted-foreground">
          No submission or estimate snapshots on file yet (legacy batches, or snapshots were not
          persisted). Future submissions and edits will populate this audit view after migrating the
          snapshot phase enum.
        </div>
      ) : (
        <FloatingHorizontalScroll>
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                <th className="w-[34%] px-3 py-2.5 text-xs font-medium">
                  Sent to staff (frozen line)
                </th>
                <th className="w-[34%] px-3 py-2.5 text-xs font-medium">
                  After batch estimate (admin copy)
                </th>
                <th className="min-w-[9rem] px-3 py-2.5 text-xs font-medium">
                  Updated by
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bundle.lines.map((line) => (
                <tr key={`${session.id}:${line.itemRequestId}`}>
                  <td className="align-top px-3 py-3 text-xs">
                    <SnapshotBrief snap={line.submissionSnapshot} />
                  </td>
                  <td className="align-top px-3 py-3 text-xs">
                    <SnapshotBrief snap={line.estimateAdminSnapshot} />
                  </td>
                  <td className="min-w-[9rem] max-w-[11rem] align-top px-3 py-3 text-xs">
                    <AdminUpdatedByCell
                      clerkUserId={snapshotRecordedByClerkUserId(
                        line.estimateAdminSnapshot,
                      )}
                      profilesByClerkUserId={staffProfilesByClerkUserId}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </FloatingHorizontalScroll>
      )}
    </article>
  );
}

function batchHistoryBundleMatchesSearch(
  bundle: AdminBatchHistoryBundle,
  q: string,
): boolean {
  if (!q) return true;
  const parts = [
    bundle.session.batchNumber,
    bundle.session.siteKey,
    bundle.userFullName ?? "",
    bundle.userEmail ?? "",
  ];
  return parts.some((p) => p.toLowerCase().includes(q));
}

type AdminBatchHistoryTableProps = {
  bundles: AdminBatchHistoryBundle[];
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
};

export function AdminBatchHistoryTable({
  bundles,
  staffProfilesByClerkUserId = {},
}: AdminBatchHistoryTableProps) {
  const baseId = useId();
  const findOrganizeSwitchId = `${baseId}-find-organize`;
  const [search, setSearch] = useState("");
  const [openClerkUserId, setOpenClerkUserId] = useState<string | null>(null);
  const [panelChoiceMade, setPanelChoiceMade] = useState(false);
  const [lineSearch, setLineSearch] = useState("");
  const [lineFindOrganizeVisible, setLineFindOrganizeVisible] = useState(true);
  const [linePageSize, setLinePageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [linePageByCustomerId, setLinePageByCustomerId] = useState<
    Record<string, number>
  >({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [estimateFilter, setEstimateFilter] = useState<EstimateFilter>("all");
  const [siteFilter, setSiteFilter] = useState("");
  const [customerResendOnly, setCustomerResendOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("sentAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [page, setPage] = useState(1);
  const [findOrganizeVisible, setFindOrganizeVisible] = useState(true);

  useEffect(() => {
    setPage(1);
    setPanelChoiceMade(false);
    setOpenClerkUserId(null);
    setLineSearch("");
  }, [
    search,
    statusFilter,
    estimateFilter,
    siteFilter,
    customerResendOnly,
    sortKey,
    sortDir,
    pageSize,
  ]);

  const filtered = useMemo(() => {
    const qBatch = search.trim().toLowerCase();
    const qSite = siteFilter.trim().toLowerCase();
    return bundles.filter((b) => {
      if (qBatch && !b.session.batchNumber.toLowerCase().includes(qBatch)) {
        return false;
      }
      if (qSite && !b.session.siteKey.toLowerCase().includes(qSite)) {
        return false;
      }
      if (statusFilter !== "all" && b.session.status !== statusFilter) {
        return false;
      }
      if (estimateFilter === "with_estimate" && !b.latestEstimate) {
        return false;
      }
      if (estimateFilter === "no_estimate" && b.latestEstimate) {
        return false;
      }
      if (
        customerResendOnly &&
        !b.submissionEvents.some((e) => e.kind === "customer_resend")
      ) {
        return false;
      }
      return true;
    });
  }, [
    bundles,
    search,
    siteFilter,
    statusFilter,
    estimateFilter,
    customerResendOnly,
  ]);

  const filteredSorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      switch (sortKey) {
        case "batchNumber":
          return compareLocale(a.session.batchNumber, b.session.batchNumber, sortDir);
        case "customer":
          return compareLocale(batchCustomerLabel(a), batchCustomerLabel(b), sortDir);
        case "status":
          return compareLocale(a.session.status, b.session.status, sortDir);
        case "subtotal": {
          const ca = bundleSubtotalCents(a);
          const cb = bundleSubtotalCents(b);
          return compareNum(ca, cb, sortDir);
        }
        case "sentAt":
        default:
          return compareNum(bundleSentMs(a), bundleSentMs(b), sortDir);
      }
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  useEffect(() => {
    if (page !== pageSafe) setPage(pageSafe);
  }, [page, pageSafe]);

  const pageSlice = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, pageSafe, pageSize]);

  const groupedPageSlice = useMemo(() => {
    const byClerk = new Map<string, AdminBatchHistoryBundle[]>();
    for (const b of pageSlice) {
      const list = byClerk.get(b.session.clerkUserId);
      if (list) list.push(b);
      else byClerk.set(b.session.clerkUserId, [b]);
    }
    const groups = [...byClerk.entries()].map(([clerkUserId, bundles]) => {
      const first = bundles[0]!;
      return {
        clerkUserId,
        groupSortKey: adminCustomerSortKey({
          fullName: first.userFullName,
          email: first.userEmail,
          clerkUserId,
        }),
        displayLabel: batchCustomerLabel(first),
        bundles,
      };
    });
    groups.sort((a, b) => a.groupSortKey.localeCompare(b.groupSortKey));
    return groups;
  }, [pageSlice]);

  const activeClerkUserId =
    panelChoiceMade ? openClerkUserId : (groupedPageSlice[0]?.clerkUserId ?? null);
  const customerExpanded = activeClerkUserId !== null;

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
    if (activeClerkUserId !== clerkUserId) setLineSearch("");
  }, [activeClerkUserId]);

  const showFrom =
    filteredSorted.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1;
  const showTo = Math.min(pageSafe * pageSize, filteredSorted.length);

  const cycleSortDir = useCallback(() => {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }, []);

  if (bundles.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No batches have been submitted to staff yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Each submission freezes what the shopper sent (
        <span className="font-medium text-foreground">Sent to staff</span> column). Repeated sends
        after a quoted batch appear in{" "}
        <span className="font-medium text-foreground">Shopper submissions</span> as{" "}
        <span className="font-medium text-foreground">Customer resend</span>. Saving a combined
        estimate stores line snapshots beside{" "}
        <span className="font-medium text-foreground">After batch estimate</span> (admin copy with
        memo). Staff revisions from <span className="font-medium text-foreground">Batch estimates</span>{" "}
        append rows below; superseded totals stay listed for audit.
      </p>

      <div
        className={cn(
          "space-y-3 rounded-lg border border-border bg-muted/10 p-4",
          adminParentControlsDisabledClass(customerExpanded),
        )}
        aria-hidden={customerExpanded || undefined}
      >
        <AdminFindOrganizeVisibilityToggle
          id={findOrganizeSwitchId}
          visible={findOrganizeVisible}
          onVisibleChange={setFindOrganizeVisible}
        />

        {findOrganizeVisible ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <Field className="gap-1.5">
                <FieldLabel htmlFor="batch-history-search" className="text-xs">
                  Batch number
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="batch-history-search"
                    placeholder="e.g. bat…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoComplete="off"
                  />
                </FieldContent>
                <FieldDescription>Substring match, case-insensitive.</FieldDescription>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel htmlFor="batch-history-site" className="text-xs">
                  Site key
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="batch-history-site"
                    placeholder="Filter by retailer key"
                    value={siteFilter}
                    onChange={(e) => setSiteFilter(e.target.value)}
                    autoComplete="off"
                  />
                </FieldContent>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel htmlFor="batch-history-status" className="text-xs">
                  Status
                </FieldLabel>
                <FieldContent>
                  <select
                    id="batch-history-status"
                    className={SELECT_CLASS}
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as StatusFilter)
                    }
                  >
                    <option value="all">All</option>
                    <option value="submitted">Submitted</option>
                    <option value="estimated">Estimated</option>
                  </select>
                </FieldContent>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel htmlFor="batch-history-estimate" className="text-xs">
                  Active estimate
                </FieldLabel>
                <FieldContent>
                  <select
                    id="batch-history-estimate"
                    className={SELECT_CLASS}
                    value={estimateFilter}
                    onChange={(e) =>
                      setEstimateFilter(e.target.value as EstimateFilter)
                    }
                  >
                    <option value="all">All</option>
                    <option value="with_estimate">Has active estimate</option>
                    <option value="no_estimate">No active estimate</option>
                  </select>
                </FieldContent>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel htmlFor="batch-history-sort" className="text-xs">
                  Sort by
                </FieldLabel>
                <FieldContent>
                  <div className="flex flex-wrap gap-2">
                    <select
                      id="batch-history-sort"
                      className={cn(SELECT_CLASS, "min-w-[11rem] flex-1")}
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value as SortKey)}
                    >
                      <option value="sentAt">Sent / created</option>
                      <option value="batchNumber">Batch number</option>
                      <option value="customer">Customer</option>
                      <option value="status">Status</option>
                      <option value="subtotal">Active subtotal</option>
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={cycleSortDir}
                      aria-label={
                        sortDir === "asc"
                          ? "Sort ascending; click for descending"
                          : "Sort descending; click for ascending"
                      }
                    >
                      {sortDir === "asc" ? "Asc ↑" : "Desc ↓"}
                    </Button>
                  </div>
                </FieldContent>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel htmlFor="batch-history-page-size" className="text-xs">
                  Per page
                </FieldLabel>
                <FieldContent>
                  <select
                    id="batch-history-page-size"
                    className={SELECT_CLASS}
                    value={pageSize}
                    onChange={(e) =>
                      setPageSize(
                        Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]
                      )
                    }
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </FieldContent>
              </Field>

              <label className="flex cursor-pointer items-center gap-2 self-end text-sm text-foreground sm:col-span-2 lg:col-span-1">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={customerResendOnly}
                  onChange={(e) => setCustomerResendOnly(e.target.checked)}
                />
                Customer resend only
              </label>
            </div>

            <p className="text-xs text-muted-foreground">
              {filteredSorted.length === 0 ? (
                <>No batches match the current filters.</>
              ) : (
                <>
                  Showing{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {showFrom}–{showTo}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {filteredSorted.length}
                  </span>{" "}
                  batch{filteredSorted.length === 1 ? "" : "es"}
                  {filteredSorted.length < bundles.length ? (
                    <>
                      {" "}
                      (<span className="tabular-nums">{bundles.length}</span> total loaded)
                    </>
                  ) : null}
                </>
              )}
            </p>
          </>
        ) : null}
      </div>

      <div className="space-y-8">
        {groupedPageSlice.map(({ clerkUserId, displayLabel, bundles: customerBundles }) => {
          const first = customerBundles[0]!;
          const expanded = activeClerkUserId === clerkUserId;
          const lineNorm = lineSearch.trim().toLowerCase();
          const lineFiltered = customerBundles.filter((b) =>
            batchHistoryBundleMatchesSearch(b, lineNorm),
          );
          const lineCount = lineFiltered.length;
          const lineTotalPages = Math.max(1, Math.ceil(lineCount / linePageSize));
          const rawLinePage = linePageByCustomerId[clerkUserId] ?? 1;
          const linePageSafe = Math.min(Math.max(1, rawLinePage), lineTotalPages);
          const lineStart = (linePageSafe - 1) * linePageSize;
          const bundleSlice = lineFiltered.slice(lineStart, lineStart + linePageSize);
          const lineShowFrom = lineCount === 0 ? 0 : lineStart + 1;
          const lineShowTo = Math.min(lineStart + linePageSize, lineCount);

          return (
          <div key={clerkUserId} className="overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 border-b border-border bg-muted/25 px-3 py-3 text-left hover:bg-muted/40",
                expanded && "bg-muted/35",
              )}
              aria-expanded={expanded}
              onClick={() => toggleCustomer(clerkUserId)}
            >
              {expanded ? (
                <ChevronDownIcon className="size-4 shrink-0" aria-hidden />
              ) : (
                <ChevronRightIcon className="size-4 shrink-0" aria-hidden />
              )}
              <AdminCustomerRecordLabel
                clerkUserId={clerkUserId}
                fullName={first.userFullName}
                email={first.userEmail}
                primaryClassName="text-sm font-semibold"
              />
              <span className="text-xs text-muted-foreground">
                ({customerBundles.length} batch{customerBundles.length === 1 ? "" : "es"})
              </span>
            </button>
            {expanded ? (
              <div className="space-y-4 p-4">
                <AdminNestedFindOrganizePanel
                  switchId={`${baseId}-line-find-organize-${clerkUserId}`}
                  searchInputId={`${baseId}-line-search-${clerkUserId}`}
                  pageSizeSelectId={`${baseId}-line-page-size-${clerkUserId}`}
                  visible={lineFindOrganizeVisible}
                  onVisibleChange={setLineFindOrganizeVisible}
                  search={lineSearch}
                  onSearchChange={setLineSearch}
                  searchLabel="Search batches"
                  searchPlaceholder="Batch number, site, customer…"
                  pageSize={linePageSize}
                  onPageSizeChange={setLinePageSize}
                  pageSizeLabel="Batches per page"
                  showFrom={lineShowFrom}
                  showTo={lineShowTo}
                  totalCount={lineCount}
                  totalLoaded={customerBundles.length}
                  itemLabel="batch"
                  className="mb-0"
                />
                {lineCount > linePageSize ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={linePageSafe <= 1}
                      onClick={() =>
                        setLinePageByCustomerId((prev) => ({
                          ...prev,
                          [clerkUserId]: Math.max(1, linePageSafe - 1),
                        }))
                      }
                    >
                      Previous batches
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={linePageSafe >= lineTotalPages}
                      onClick={() =>
                        setLinePageByCustomerId((prev) => ({
                          ...prev,
                          [clerkUserId]: Math.min(lineTotalPages, linePageSafe + 1),
                        }))
                      }
                    >
                      Next batches
                    </Button>
                  </div>
                ) : null}
                <div className="space-y-8">
                  {bundleSlice.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {lineSearch.trim()
                        ? "No batches match the current search."
                        : "No batches for this customer."}
                    </p>
                  ) : null}
                  {bundleSlice.map((bundle) => (
                    <BatchHistoryArticle
                      key={bundle.session.id}
                      bundle={bundle}
                      staffProfilesByClerkUserId={staffProfilesByClerkUserId}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          );
        })}
      </div>

      {filteredSorted.length > 0 ? (
        <div
          className={cn(
            "flex flex-col items-stretch gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between",
            adminParentControlsDisabledClass(customerExpanded),
          )}
          aria-hidden={customerExpanded || undefined}
        >
          <p className="text-xs text-muted-foreground">
            Page{" "}
            <span className="font-medium tabular-nums text-foreground">{pageSafe}</span> of{" "}
            <span className="font-medium tabular-nums text-foreground">{totalPages}</span>
            {customerExpanded ? (
              <span className="text-muted-foreground/80">
                {" "}
                (collapse customer to change)
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={customerExpanded || pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={customerExpanded || pageSafe >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
