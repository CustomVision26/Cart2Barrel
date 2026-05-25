"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { BatchEstimatePreviewDialog } from "@/components/dashboard/batch-estimate-preview-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Field,
  FieldContent,
  FieldLabel,
} from "@/components/ui/field";
import { FieldLabelWithHelp } from "@/components/ui/field-label-with-help";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { OwnerBatchQuoteSessionBundle } from "@/data/batch-quote-sessions";
import type { BatchQuoteSessionStatusEvent, ItemRequest } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import {
  batchQuoteSessionEventKindLabel,
  ownerBatchQuoteSessionStatusBadge,
} from "@/lib/batch-quote-session-status-labels";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { displaySiteName } from "@/lib/site-name";
import {
  batchQuoteSessionBadgeKind,
  batchQuoteSessionEventBadgeKind,
} from "@/lib/status-badge-map";
import { compareLocale, compareNum, type SortDir } from "@/lib/table-sort";
import { cn } from "@/lib/utils";
import {
  BATCH_QUOTE_HISTORY_SNAPSHOT_V,
  type BatchQuoteHistorySnapshot,
} from "@/types/batch-quote-history-snapshot";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

type StatusFilter =
  | "all"
  | "submitted"
  | "estimated"
  | "paid_pending_staff_purchase";
type SortKey = "sentAt" | "batchNumber" | "status" | "subtotal";

const SELECT_CLASS =
  "h-8 min-w-[9rem] rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type DashboardBatchHistorySectionProps = {
  bundles: OwnerBatchQuoteSessionBundle[];
};

function ownerBundleSentMs(b: OwnerBatchQuoteSessionBundle): number {
  const submitted = b.session.submittedAt?.trim()
    ? new Date(b.session.submittedAt).getTime()
    : null;
  if (submitted != null && Number.isFinite(submitted)) return submitted;

  const est = b.latestEstimate?.createdAt?.trim()
    ? new Date(b.latestEstimate.createdAt).getTime()
    : null;
  if (est != null && Number.isFinite(est)) return est;

  return new Date(b.session.createdAt).getTime();
}

function ownerBundleSubtotalCents(b: OwnerBatchQuoteSessionBundle): number {
  return b.latestEstimate?.subtotalCents ?? -1;
}

function parseBatchQuoteHistorySnapshot(
  detail: BatchQuoteSessionStatusEvent["detail"],
): BatchQuoteHistorySnapshot | null {
  if (!detail || typeof detail !== "object") return null;
  const snap = (detail as { snapshot?: unknown }).snapshot;
  if (!snap || typeof snap !== "object") return null;
  if ((snap as { v?: unknown }).v !== BATCH_QUOTE_HISTORY_SNAPSHOT_V) return null;
  return snap as BatchQuoteHistorySnapshot;
}

function haystackForOwnerBundleSearch(b: OwnerBatchQuoteSessionBundle): string {
  const parts: string[] = [
    b.session.batchNumber,
    b.session.siteKey,
    b.session.status,
  ];
  for (const r of b.requests) {
    parts.push(
      r.productName ?? "",
      r.productUrl ?? "",
      r.siteName ?? "",
      r.note ?? "",
      r.productSize ?? "",
      r.productColor ?? "",
    );
  }
  for (const ev of b.statusEvents) {
    parts.push(ev.kind, batchQuoteSessionEventKindLabel(ev.kind));
    const snap = parseBatchQuoteHistorySnapshot(ev.detail);
    if (snap) {
      for (const line of snap.lines) {
        parts.push(
          line.productName ?? "",
          line.productUrl,
          line.siteName ?? "",
        );
      }
    }
  }
  return parts.join("\n").toLowerCase();
}

export function DashboardBatchHistorySection({
  bundles,
}: DashboardBatchHistorySectionProps) {
  const [expandedBySessionId, setExpandedBySessionId] = useState<
    Record<string, boolean>
  >({});
  const [expandedStageByEventId, setExpandedStageByEventId] = useState<
    Record<string, boolean>
  >({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("sentAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [page, setPage] = useState(1);
  const [findOrganizeVisible, setFindOrganizeVisible] = useState(true);

  const eligibleBundles = useMemo(
    () =>
      bundles.filter(
        (b) =>
          b.session.status === "submitted" ||
          b.session.status === "estimated" ||
          b.session.status === "paid_pending_staff_purchase"
      ),
    [bundles]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return eligibleBundles.filter((b) => {
      if (statusFilter !== "all" && b.session.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return haystackForOwnerBundleSearch(b).includes(q);
    });
  }, [eligibleBundles, search, statusFilter]);

  const filteredSorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      switch (sortKey) {
        case "batchNumber":
          return compareLocale(
            a.session.batchNumber,
            b.session.batchNumber,
            sortDir
          );
        case "status":
          return compareLocale(a.session.status, b.session.status, sortDir);
        case "subtotal": {
          const ca = ownerBundleSubtotalCents(a);
          const cb = ownerBundleSubtotalCents(b);
          return compareNum(ca, cb, sortDir);
        }
        case "sentAt":
        default:
          return compareNum(
            ownerBundleSentMs(a),
            ownerBundleSentMs(b),
            sortDir
          );
      }
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const pageSlice = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, pageSafe, pageSize]);

  const showFrom =
    filteredSorted.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1;
  const showTo = Math.min(pageSafe * pageSize, filteredSorted.length);

  const cycleSortDir = useCallback(() => {
    setPage(1);
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }, []);

  const isBodyExpanded = (sessionId: string) =>
    expandedBySessionId[sessionId] !== false;

  const toggleBody = (sessionId: string) => {
    setExpandedBySessionId((prev) => {
      const open = prev[sessionId] !== false;
      return { ...prev, [sessionId]: !open };
    });
  };

  if (eligibleBundles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No submitted, quoted, or paid batches yet. When you send a bundle from{" "}
        <Link
          href={DASHBOARD_ADD_ITEM_ROUTES.batchQuotesActive}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          Batch Quotes
        </Link>
        , it appears here with any estimate staff send back.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium text-foreground">Find & organize</p>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="dashboard-batch-history-find-organize"
              className="cursor-pointer text-xs font-normal text-muted-foreground"
            >
              Show filters and sort
            </Label>
            <Switch
              id="dashboard-batch-history-find-organize"
              checked={findOrganizeVisible}
              onCheckedChange={setFindOrganizeVisible}
            />
          </div>
        </div>

        {findOrganizeVisible ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field className="gap-1.5">
                <FieldLabelWithHelp
                  htmlFor="dashboard-batch-history-search"
                  label="Search"
                  help="Matches batch number, site, status, and any line item fields."
                  helpLabel="About Search"
                />
                <FieldContent>
                  <Input
                    id="dashboard-batch-history-search"
                    placeholder="Batch #, site key, product name…"
                    value={search}
                    onChange={(e) => {
                      setPage(1);
                      setSearch(e.target.value);
                    }}
                    autoComplete="off"
                  />
                </FieldContent>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel
                  htmlFor="dashboard-batch-history-status"
                  className="text-xs"
                >
                  Status
                </FieldLabel>
                <FieldContent>
                  <select
                    id="dashboard-batch-history-status"
                    className={SELECT_CLASS}
                    value={statusFilter}
                    onChange={(e) => {
                      setPage(1);
                      setStatusFilter(e.target.value as StatusFilter);
                    }}
                  >
                    <option value="all">All</option>
                    <option value="submitted">Submitted</option>
                    <option value="estimated">Quoted (batch)</option>
                    <option value="paid_pending_staff_purchase">
                      Paid : Awaiting staff purchase
                    </option>
                  </select>
                </FieldContent>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel
                  htmlFor="dashboard-batch-history-sort"
                  className="text-xs"
                >
                  Sort by
                </FieldLabel>
                <FieldContent>
                  <div className="flex flex-wrap gap-2">
                    <select
                      id="dashboard-batch-history-sort"
                      className={cn(SELECT_CLASS, "min-w-[11rem] flex-1")}
                      value={sortKey}
                      onChange={(e) => {
                        setPage(1);
                        setSortKey(e.target.value as SortKey);
                      }}
                    >
                      <option value="sentAt">Sent / last activity</option>
                      <option value="batchNumber">Batch number</option>
                      <option value="status">Status</option>
                      <option value="subtotal">Estimate subtotal</option>
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

              <Field className="gap-1.5 sm:col-span-2 lg:col-span-1">
                <FieldLabel
                  htmlFor="dashboard-batch-history-page-size"
                  className="text-xs"
                >
                  Per page
                </FieldLabel>
                <FieldContent>
                  <select
                    id="dashboard-batch-history-page-size"
                    className={SELECT_CLASS}
                    value={pageSize}
                    onChange={(e) => {
                      setPage(1);
                      setPageSize(
                        Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]
                      );
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </FieldContent>
              </Field>
            </div>

            <p className="text-xs text-muted-foreground">
              {filteredSorted.length === 0 ? (
                <>No batches match the current search or filters.</>
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
                  {filteredSorted.length < eligibleBundles.length ? (
                    <>
                      {" "}
                      (<span className="tabular-nums">{eligibleBundles.length}</span>{" "}
                      total)
                    </>
                  ) : null}
                </>
              )}
            </p>
          </>
        ) : null}
      </div>

      {filteredSorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Try clearing the search box or setting status to{" "}
          <span className="font-medium text-foreground">All</span>.
        </p>
      ) : null}

      {pageSlice.map(({ session, requests, latestEstimate, statusEvents }) => {
        const bodyOpen = isBodyExpanded(session.id);
        const submittedLabel = session.submittedAt?.trim()
          ? new Date(session.submittedAt).toLocaleString()
          : "—";
        const estimateLabel =
          latestEstimate?.createdAt?.trim()
            ? new Date(latestEstimate.createdAt).toLocaleString()
            : "—";

        const inCart =
          session.status === "in_cart" ||
          Boolean(session.cartAcceptanceAcceptedAt);

        const hasEstimateRow =
          session.status === "estimated" ||
          session.status === "paid_pending_staff_purchase";

        return (
          <section
            key={session.id}
            className="space-y-3 rounded-lg border border-border bg-muted/10 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-1 sm:gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-expanded={bodyOpen}
                  aria-controls={`batch-history-${session.id}-body`}
                  aria-label={
                    bodyOpen ? "Collapse batch details" : "Expand batch details"
                  }
                  id={`batch-history-${session.id}-toggle`}
                  onClick={() => toggleBody(session.id)}
                >
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform duration-200",
                      bodyOpen ? "rotate-180" : "rotate-0",
                    )}
                    aria-hidden
                  />
                </Button>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Batch number:{" "}
                    <span className="font-mono text-primary">{session.batchNumber}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Site key{" "}
                    <span className="font-medium text-foreground">{session.siteKey}</span>
                    {" · "}
                    <StatusBadge kind={batchQuoteSessionBadgeKind(session.status)}>
                      {ownerBatchQuoteSessionStatusBadge(session.status)}
                    </StatusBadge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sent to staff:{" "}
                    <time dateTime={session.submittedAt ?? undefined} className="text-foreground">
                      {submittedLabel}
                    </time>
                  </p>
                  {hasEstimateRow ? (
                    <p className="text-xs text-muted-foreground">
                      Staff estimate:{" "}
                      {latestEstimate ? (
                        <>
                          <span className="font-medium text-foreground">
                            {formatUsd(latestEstimate.subtotalCents)}
                          </span>
                          {" · "}
                          Saved{" "}
                          <time dateTime={latestEstimate.createdAt}>
                            {estimateLabel}
                          </time>
                        </>
                      ) : (
                        <span className="text-foreground">
                          Awaiting refreshed estimate (prior copy voided).
                        </span>
                      )}
                    </p>
                  ) : null}
                  {session.status === "paid_pending_staff_purchase" ? (
                    <p className="text-xs text-muted-foreground">
                      Checkout completed — staff will purchase this bundle. Open{" "}
                      <Link
                        href="/dashboard/orders"
                        className="font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        Orders
                      </Link>{" "}
                      for payment details and updates.
                    </p>
                  ) : null}
                </div>
              </div>
              {hasEstimateRow && latestEstimate ? (
                <div className="flex max-w-xl flex-col items-stretch gap-2 sm:items-end">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <BatchEstimatePreviewDialog
                      batchSessionId={session.id}
                      batchNumber={session.batchNumber}
                      siteKey={session.siteKey}
                      estimate={latestEstimate}
                    />
                  </div>
                  {session.status === "estimated" && !inCart ? (
                    <p className="text-right text-xs text-muted-foreground">
                      Bundled checkout only after you accept staff&apos;s estimate on{" "}
                      <Link
                        href={DASHBOARD_ADD_ITEM_ROUTES.batchQuotesActive}
                        className="font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        Batch Quotes
                      </Link>{" "}
                      (Active).
                    </p>
                  ) : null}
                  {session.status === "estimated" && inCart ? (
                    <p className="text-right text-xs text-muted-foreground">
                      This batch is in your{" "}
                      <Link
                        href="/dashboard/cart"
                        className="font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        Cart
                      </Link>{" "}
                      as a combined bundle. Remove it there if you need to undo acceptance.
                    </p>
                  ) : null}
                </div>
              ) : session.status === "submitted" ? (
                <p className="max-w-xs text-xs text-muted-foreground sm:text-right">
                  Staff will bundle every line listed below before you receive a quoted
                  subtotal—when it arrives, preview here and accept the estimate under{" "}
                  <Link
                    href={DASHBOARD_ADD_ITEM_ROUTES.batchQuotesActive}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    Batch Quotes
                  </Link>{" "}
                  (Active).
                </p>
              ) : null}
            </div>

            <div
              id={`batch-history-${session.id}-body`}
              role="region"
              aria-labelledby={`batch-history-${session.id}-toggle`}
              hidden={!bodyOpen}
              className={cn(bodyOpen && "space-y-3")}
            >
              <FloatingHorizontalScroll viewportClassName="rounded-md border border-border">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 font-medium">Photo</th>
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium">Site</th>
                      <th className="px-3 py-2 font-medium">Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {requests.map((r: ItemRequest) => (
                      <tr key={r.id}>
                        <td className="px-3 py-2 align-top">
                          <ProductRequestThumbnail
                            variant="list"
                            imageUrl={r.productImageUrl}
                            productLabel={r.productName}
                          />
                        </td>
                        <td className="max-w-[12rem] px-3 py-2 font-medium text-foreground">
                          <span className="line-clamp-2">
                            {r.productName?.trim() || "Unnamed product"}
                          </span>
                        </td>
                        <td className="max-w-[8rem] px-3 py-2 text-xs text-muted-foreground">
                          {displaySiteName(r.siteName, r.productUrl)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <a
                            href={r.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Product url
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </FloatingHorizontalScroll>
              {statusEvents.length > 0 ? (
                <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs font-medium text-foreground">
                    Quote history — each stage is a snapshot from when your bundle changed
                    state
                  </p>
                  <ul className="space-y-3">
                    {statusEvents.map((ev) => {
                      const snap = parseBatchQuoteHistorySnapshot(ev.detail);
                      const stageOpen = expandedStageByEventId[ev.id] === true;
                      const stageLabel =
                        snap?.stageLabel ?? batchQuoteSessionEventKindLabel(ev.kind);
                      const submittedSnap = snap?.submittedAt?.trim()
                        ? new Date(snap.submittedAt).toLocaleString()
                        : null;
                      const estimateSavedSnap =
                        snap?.estimate?.savedAt?.trim()
                          ? new Date(snap.estimate.savedAt).toLocaleString()
                          : null;

                      return (
                        <li
                          key={ev.id}
                          className="rounded-md border border-border/50 bg-background/40"
                        >
                          <div className="flex flex-wrap items-start gap-2 p-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mt-0.5 size-8 shrink-0 text-muted-foreground hover:text-foreground"
                              aria-expanded={stageOpen}
                              aria-label={
                                stageOpen ? "Collapse stage details" : "Expand stage details"
                              }
                              onClick={() =>
                                setExpandedStageByEventId((prev) => ({
                                  ...prev,
                                  [ev.id]: !prev[ev.id],
                                }))
                              }
                            >
                              <ChevronDown
                                className={cn(
                                  "size-4 transition-transform duration-200",
                                  stageOpen ? "rotate-180" : "rotate-0",
                                )}
                                aria-hidden
                              />
                            </Button>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <time
                                  dateTime={ev.createdAt}
                                  className="shrink-0 font-mono text-[11px] text-foreground/80"
                                >
                                  {new Date(ev.createdAt).toLocaleString()}
                                </time>
                                <StatusBadge kind={batchQuoteSessionEventBadgeKind(ev.kind)}>
                                  {stageLabel}
                                </StatusBadge>
                              </div>
                              {snap ?
                                <>
                                  {submittedSnap ?
                                    <p className="text-xs text-muted-foreground">
                                      Sent to staff (snapshot):{" "}
                                      <time
                                        dateTime={snap.submittedAt ?? undefined}
                                        className="text-foreground"
                                      >
                                        {submittedSnap}
                                      </time>
                                    </p>
                                  : null}
                                  {snap.estimate ?
                                    <p className="text-xs text-muted-foreground">
                                      Staff estimate (snapshot):{" "}
                                      <span className="font-medium text-foreground">
                                        {formatUsd(snap.estimate.subtotalCents)}
                                      </span>
                                      {estimateSavedSnap ?
                                        <>
                                          {" "}
                                          · Saved{" "}
                                          <time dateTime={snap.estimate.savedAt}>
                                            {estimateSavedSnap}
                                          </time>
                                        </>
                                      : null}
                                    </p>
                                  : null}
                                  {(snap.orderId ?? ev.detail?.orderId) ?
                                    <p className="text-xs text-muted-foreground">
                                      <Link
                                        href="/dashboard/orders"
                                        className="font-medium text-primary underline-offset-2 hover:underline"
                                      >
                                        View orders
                                      </Link>
                                      <span className="text-muted-foreground">
                                        {" "}
                                        for checkout details
                                      </span>
                                    </p>
                                  : null}
                                </>
                              : null}
                            </div>
                          </div>
                          {snap && stageOpen ?
                            <div
                              className="border-t border-border/40 px-2 pb-2 pt-1"
                              role="region"
                            >
                              {snap.lines.length === 0 ?
                                <p className="px-6 py-2 text-xs text-muted-foreground">
                                  No line items were stored for this stage (often a legacy
                                  log entry).
                                </p>
                              : <FloatingHorizontalScroll viewportClassName="rounded-md border border-border">
                                  <table className="w-full min-w-[36rem] text-left text-sm">
                                    <thead className="border-b border-border bg-muted/40">
                                      <tr>
                                        <th className="px-3 py-2 font-medium">Photo</th>
                                        <th className="px-3 py-2 font-medium">Product</th>
                                        <th className="px-3 py-2 font-medium">Site</th>
                                        <th className="px-3 py-2 font-medium">Link</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                      {snap.lines.map((line, lineIdx) => (
                                        <tr key={`${ev.id}-${lineIdx}`}>
                                          <td className="px-3 py-2 align-top">
                                            <ProductRequestThumbnail
                                              variant="list"
                                              imageUrl={line.productImageUrl}
                                              productLabel={line.productName}
                                            />
                                          </td>
                                          <td className="max-w-[12rem] px-3 py-2 font-medium text-foreground">
                                            <span className="line-clamp-2">
                                              {line.productName?.trim() || "Unnamed product"}
                                            </span>
                                          </td>
                                          <td className="max-w-[8rem] px-3 py-2 text-xs text-muted-foreground">
                                            {displaySiteName(
                                              line.siteName,
                                              line.productUrl,
                                            )}
                                          </td>
                                          <td className="whitespace-nowrap px-3 py-2">
                                            <a
                                              href={line.productUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                                            >
                                              Product url
                                            </a>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </FloatingHorizontalScroll>
                              }
                            </div>
                          : null}
                          {!snap ?
                            <p className="border-t border-border/40 px-4 py-2 text-xs text-muted-foreground">
                              This entry has no bundled line snapshot (saved before automatic
                              history copies were enabled).
                            </p>
                          : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {requests.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Line retention may be unavailable for legacy batches—open Batch Quotes if
                  the product grid is incomplete.
                </p>
              ) : null}
            </div>
          </section>
        );
      })}

      {filteredSorted.length > 0 ? (
        <div className="flex flex-col items-stretch gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Page{" "}
            <span className="font-medium tabular-nums text-foreground">
              {pageSafe}
            </span>{" "}
            of{" "}
            <span className="font-medium tabular-nums text-foreground">
              {totalPages}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageSafe <= 1}
              onClick={() => setPage(pageSafe - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage(pageSafe + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
