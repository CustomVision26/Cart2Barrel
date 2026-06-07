"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { BatchEstimatePreviewDialog } from "@/components/dashboard/batch-estimate-preview-dialog";
import { ProductChargesPreviewDialog } from "@/components/dashboard/product-charges-preview-dialog";
import { SingleEstimatePreviewDialog } from "@/components/orders/single-estimate-preview-dialog";
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
import type {
  AdminBatchHistoryOwnerBundle,
  OwnerBatchQuoteSessionBundle,
} from "@/data/batch-quote-sessions";
import type {
  BatchQuoteSessionStatusEvent,
  ItemQuote,
  ItemRequest,
} from "@/db/schema";
import { allocateCentsByWeight } from "@/lib/allocate-cents";
import { formatUsd } from "@/lib/admin-markup";
import { isOperationalQuoteRow } from "@/lib/checkout-snapshot-kind";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import { lineSaleTaxCentsFromQuote } from "@/lib/quote-line-tax";
import {
  batchQuoteSessionEventKindLabel,
  ownerBatchQuoteSessionStatusBadge,
} from "@/lib/batch-quote-session-status-labels";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { adminCustomerDisplayLabel, adminCustomerSortKey } from "@/lib/admin-customer-group";
import {
  dashItemsTableFilterPanel,
  dashItemsTableHeadPlain,
  dashItemsTableScroll,
  dashItemsTableStatusPanel,
} from "@/lib/app-table-surfaces";
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
  | "in_cart"
  | "paid_pending_staff_purchase";
type SortKey = "sentAt" | "batchNumber" | "status" | "subtotal" | "customer";

const SELECT_CLASS =
  "h-8 min-w-[9rem] rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type BatchHistoryLinkTargets = {
  batchQuotesActive: string;
  orders: string;
  cart: string;
};

const CUSTOMER_LINK_TARGETS: BatchHistoryLinkTargets = {
  batchQuotesActive: DASHBOARD_ADD_ITEM_ROUTES.batchQuotesActive,
  orders: "/dashboard/orders",
  cart: "/dashboard/cart",
};

type BatchHistorySectionVariant = "customer" | "admin";

type DashboardBatchHistorySectionProps = {
  bundles: OwnerBatchQuoteSessionBundle[] | AdminBatchHistoryOwnerBundle[];
  quotesByRequestId?: Record<string, ItemQuote[]>;
  variant?: BatchHistorySectionVariant;
  linkTargets?: BatchHistoryLinkTargets;
};

function isAdminHistoryBundle(
  bundle: OwnerBatchQuoteSessionBundle | AdminBatchHistoryOwnerBundle,
  variant: BatchHistorySectionVariant,
): bundle is AdminBatchHistoryOwnerBundle {
  return variant === "admin";
}

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

function haystackForOwnerBundleSearch(
  b: OwnerBatchQuoteSessionBundle | AdminBatchHistoryOwnerBundle,
  variant: BatchHistorySectionVariant = "customer",
): string {
  const parts: string[] = [
    b.session.batchNumber,
    b.session.siteKey,
    b.session.status,
  ];
  if (isAdminHistoryBundle(b, variant)) {
    parts.push(b.userFullName ?? "", b.userEmail ?? "", b.session.clerkUserId);
  }
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
  quotesByRequestId = {},
  variant = "customer",
  linkTargets = CUSTOMER_LINK_TARGETS,
}: DashboardBatchHistorySectionProps) {
  const routes = linkTargets;
  const idPrefix =
    variant === "admin" ? "admin-batch-history" : "dashboard-batch-history";
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
    null,
  );
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
          b.session.status === "in_cart" ||
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
      return haystackForOwnerBundleSearch(b, variant).includes(q);
    });
  }, [eligibleBundles, search, statusFilter, variant]);

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
        case "customer": {
          if (variant !== "admin") {
            return compareNum(
              ownerBundleSentMs(a),
              ownerBundleSentMs(b),
              sortDir,
            );
          }
          const aBundle = a as AdminBatchHistoryOwnerBundle;
          const bBundle = b as AdminBatchHistoryOwnerBundle;
          return compareLocale(
            adminCustomerSortKey({
              clerkUserId: aBundle.session.clerkUserId,
              fullName: aBundle.userFullName,
              email: aBundle.userEmail,
            }),
            adminCustomerSortKey({
              clerkUserId: bBundle.session.clerkUserId,
              fullName: bBundle.userFullName,
              email: bBundle.userEmail,
            }),
            sortDir,
          );
        }
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
  }, [filtered, sortKey, sortDir, variant]);

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
    expandedSessionId === sessionId;

  const toggleBody = (sessionId: string) => {
    setExpandedSessionId((prev) => (prev === sessionId ? null : sessionId));
  };

  if (eligibleBundles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {variant === "admin" ?
          <>
            No submitted, quoted, or paid batches yet. When a shopper sends a bundle from{" "}
            <Link
              href={routes.batchQuotesActive}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Submitted batches
            </Link>
            , it appears here with any estimate staff save.
          </>
        : <>
            No submitted, quoted, or paid batches yet. When you send a bundle from{" "}
            <Link
              href={routes.batchQuotesActive}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              Batch Quotes
            </Link>
            , it appears here with any estimate staff send back.
          </>
        }
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className={dashItemsTableFilterPanel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium text-foreground">Find & organize</p>
          <div className="flex items-center gap-2">
            <Label
              htmlFor={`${idPrefix}-find-organize`}
              className="cursor-pointer text-xs font-normal text-muted-foreground"
            >
              Show filters and sort
            </Label>
            <Switch
              id={`${idPrefix}-find-organize`}
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
                  htmlFor={`${idPrefix}-search`}
                  label="Search"
                  help={
                    variant === "admin" ?
                      "Matches batch number, site, status, customer, and any line item fields."
                    : "Matches batch number, site, status, and any line item fields."
                  }
                  helpLabel="About Search"
                />
                <FieldContent>
                  <Input
                    id={`${idPrefix}-search`}
                    placeholder={
                      variant === "admin" ?
                        "Batch #, customer, site key, product name…"
                      : "Batch #, site key, product name…"
                    }
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
                  htmlFor={`${idPrefix}-status`}
                  className="text-xs"
                >
                  Status
                </FieldLabel>
                <FieldContent>
                  <select
                    id={`${idPrefix}-status`}
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
                    <option value="in_cart">In Cart</option>
                    <option value="paid_pending_staff_purchase">
                      Paid : Awaiting staff purchase
                    </option>
                  </select>
                </FieldContent>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel
                  htmlFor={`${idPrefix}-sort`}
                  className="text-xs"
                >
                  Sort by
                </FieldLabel>
                <FieldContent>
                  <div className="flex flex-wrap gap-2">
                    <select
                      id={`${idPrefix}-sort`}
                      className={cn(SELECT_CLASS, "min-w-[11rem] flex-1")}
                      value={sortKey}
                      onChange={(e) => {
                        setPage(1);
                        setSortKey(e.target.value as SortKey);
                      }}
                    >
                      <option value="sentAt">Sent / last activity</option>
                      <option value="batchNumber">Batch number</option>
                      {variant === "admin" ? (
                        <option value="customer">Customer</option>
                      ) : null}
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
                  htmlFor={`${idPrefix}-page-size`}
                  className="text-xs"
                >
                  Per page
                </FieldLabel>
                <FieldContent>
                  <select
                    id={`${idPrefix}-page-size`}
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

      {pageSlice.map((bundle) => {
        const { session, requests, latestEstimate, statusEvents } = bundle;
        const adminBundle =
          isAdminHistoryBundle(bundle, variant) ? bundle : null;
        const bodyOpen = isBodyExpanded(session.id);
        const requestByUrl = new Map<string, ItemRequest>();
        for (const r of requests) {
          if (!requestByUrl.has(r.productUrl)) requestByUrl.set(r.productUrl, r);
        }
        const latestQuoteForRequest = (requestId: string): ItemQuote | null => {
          const list = quotesByRequestId[requestId] ?? [];
          if (list.length === 0) return null;
          return (
            [...list].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )[0] ?? null
          );
        };
        const latestOperationalQuoteForRequest = (
          requestId: string,
        ): ItemQuote | null => {
          const operational = (quotesByRequestId[requestId] ?? []).filter(
            isOperationalQuoteRow,
          );
          if (operational.length === 0) return null;
          return (
            [...operational].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )[0] ?? null
          );
        };
        // Divide the saved batch estimate across bundled products, weighted by
        // each line's latest quote, so per-product shares sum to the subtotal.
        const lineQuotes = requests.map((r) => latestQuoteForRequest(r.id));
        const shareByRequestId = new Map<
          string,
          {
            merchandise: number;
            serviceFee: number;
            shipping: number;
            tax: number;
            total: number;
          }
        >();
        if (latestEstimate) {
          const merch = allocateCentsByWeight(
            latestEstimate.siteMerchandiseTotalCents,
            lineQuotes.map((q) => q?.itemCost ?? 0),
          );
          const service = allocateCentsByWeight(
            latestEstimate.serviceHandlingTotalCents,
            lineQuotes.map((q) => q?.serviceFee ?? 0),
          );
          const shipping = allocateCentsByWeight(
            latestEstimate.siteShippingTotalCents,
            lineQuotes.map((q) => q?.estimatedShipping ?? 0),
          );
          const tax = allocateCentsByWeight(
            latestEstimate.siteSaleTaxTotalCents,
            lineQuotes.map((q) => (q ? lineSaleTaxCentsFromQuote(q) : 0)),
          );
          requests.forEach((r, i) => {
            shareByRequestId.set(r.id, {
              merchandise: merch[i] ?? 0,
              serviceFee: service[i] ?? 0,
              shipping: shipping[i] ?? 0,
              tax: tax[i] ?? 0,
              total:
                (merch[i] ?? 0) +
                (service[i] ?? 0) +
                (shipping[i] ?? 0) +
                (tax[i] ?? 0),
            });
          });
        }
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
          session.status === "in_cart" ||
          session.status === "paid_pending_staff_purchase";

        return (
          <section
            key={session.id}
            className={dashItemsTableFilterPanel}
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
                  {adminBundle ?
                    <p className="text-xs text-muted-foreground">
                      Customer{" "}
                      <span className="font-medium text-foreground">
                        {adminCustomerDisplayLabel({
                          clerkUserId: adminBundle.session.clerkUserId,
                          fullName: adminBundle.userFullName,
                          email: adminBundle.userEmail,
                        })}
                      </span>
                    </p>
                  : null}
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
                      Checkout completed —{" "}
                      {variant === "admin" ?
                        "purchase this bundle from "
                      : "staff will purchase this bundle. Open "}
                      <Link
                        href={routes.orders}
                        className="font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        {variant === "admin" ? "Orders" : "Orders"}
                      </Link>
                      {variant === "admin" ?
                        " when ready."
                      : " for payment details and updates."}
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
                      requests={requests}
                      quotesByRequestId={quotesByRequestId}
                    />
                  </div>
                  {session.status === "estimated" && !inCart ?
                    variant === "admin" ?
                      <p className="text-right text-xs text-muted-foreground">
                        Shopper accepts bundled checkout from their Batch Quotes (Active)
                        tab after reviewing this estimate.
                      </p>
                    : <p className="text-right text-xs text-muted-foreground">
                        Bundled checkout only after you accept staff&apos;s estimate on{" "}
                        <Link
                          href={routes.batchQuotesActive}
                          className="font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          Batch Quotes
                        </Link>{" "}
                        (Active).
                      </p>
                  : null}
                  {session.status === "estimated" && inCart ?
                    variant === "admin" ?
                      <p className="text-right text-xs text-muted-foreground">
                        This batch is in the customer&apos;s cart awaiting checkout.
                      </p>
                    : <p className="text-right text-xs text-muted-foreground">
                        This batch is in your{" "}
                        <Link
                          href={routes.cart}
                          className="font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          Cart
                        </Link>{" "}
                        as a combined bundle. Remove it there if you need to undo acceptance.
                      </p>
                  : null}
                </div>
              ) : session.status === "submitted" ?
                variant === "admin" ?
                  <p className="max-w-xs text-xs text-muted-foreground sm:text-right">
                    Awaiting staff bundled estimate — save from{" "}
                    <Link
                      href={routes.batchQuotesActive}
                      className="font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      Submitted batches
                    </Link>
                    .
                  </p>
                : <p className="max-w-xs text-xs text-muted-foreground sm:text-right">
                    Staff will bundle every line listed below before you receive a quoted
                    subtotal—when it arrives, preview here and accept the estimate under{" "}
                    <Link
                      href={routes.batchQuotesActive}
                      className="font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      Batch Quotes
                    </Link>{" "}
                    (Active).
                  </p>
              : null}
            </div>

            <div
              id={`batch-history-${session.id}-body`}
              role="region"
              aria-labelledby={`batch-history-${session.id}-toggle`}
              hidden={!bodyOpen}
              className={cn(bodyOpen && "space-y-3")}
            >
              <FloatingHorizontalScroll viewportClassName={dashItemsTableScroll}>
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className={dashItemsTableHeadPlain}>
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
                <div className={dashItemsTableStatusPanel}>
                  <p className="text-xs font-medium text-foreground">
                    Quote history — each stage is a snapshot from when your bundle changed
                    state
                  </p>
                  <ul className="space-y-3">
                    {[...statusEvents]
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() -
                          new Date(a.createdAt).getTime(),
                      )
                      .map((ev) => {
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
                          className="rounded-md border border-border/80 bg-card p-2"
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
                                        href={routes.orders}
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
                              : <FloatingHorizontalScroll viewportClassName={dashItemsTableScroll}>
                                  <table className="w-full min-w-[36rem] text-left text-sm">
                                    <thead className={dashItemsTableHeadPlain}>
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
                                            <div className="flex items-center gap-3">
                                              <a
                                                href={line.productUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                                              >
                                                Product url
                                              </a>
                                              {(() => {
                                                const req = requestByUrl.get(
                                                  line.productUrl,
                                                );
                                                if (!req) return null;

                                                if (ev.kind === "new_batch_request") {
                                                  const quote =
                                                    latestOperationalQuoteForRequest(
                                                      req.id,
                                                    );
                                                  if (!quote) return null;
                                                  return (
                                                    <SingleEstimatePreviewDialog
                                                      quote={quote}
                                                      request={req}
                                                    />
                                                  );
                                                }

                                                const share = shareByRequestId.get(
                                                  req.id,
                                                );
                                                if (!share) return null;
                                                const note =
                                                  latestEstimate?.staffNote ??
                                                  null;
                                                return (
                                                  <ProductChargesPreviewDialog
                                                    productLabel={
                                                      line.productName ?? ""
                                                    }
                                                    merchandise={
                                                      share.merchandise
                                                    }
                                                    serviceFee={share.serviceFee}
                                                    shipping={share.shipping}
                                                    tax={share.tax}
                                                    total={share.total}
                                                    note={note}
                                                    isOutsidePurchase={
                                                      isOutsidePurchaseRequest(
                                                        req,
                                                      )
                                                    }
                                                  />
                                                );
                                              })()}
                                            </div>
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
                  Line retention may be unavailable for legacy batches—open{" "}
                  {variant === "admin" ? "Submitted batches" : "Batch Quotes"} if the
                  product grid is incomplete.
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
