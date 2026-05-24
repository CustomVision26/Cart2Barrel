"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  Fragment,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import type { AdminSubmittedBatchBundle } from "@/data/batch-quote-sessions";
import { AdminBatchQuoteEstimateDialog } from "@/components/admin/admin-batch-quote-estimate-dialog";
import { AdminFindOrganizeVisibilityToggle } from "@/components/admin/admin-find-organize-visibility-toggle";
import { AdminCustomerRecordLabel } from "@/components/admin/admin-customer-record-label";
import { AdminUpdatedByCell } from "@/components/admin/admin-staff-record-label";
import type { AdminStaffProfilesByClerkUserId } from "@/lib/admin-staff-profiles";
import { batchEstimateRecordedByClerkUserId } from "@/lib/admin-staff-profiles";
import { AdminNestedFindOrganizePanel } from "@/components/admin/admin-nested-find-organize-panel";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ItemQuote } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import {
  adminCustomerDisplayLabel,
  adminCustomerSortKey,
} from "@/lib/admin-customer-group";
import { lineSaleTaxCentsFromQuote } from "@/lib/quote-line-tax";
import { displaySiteName } from "@/lib/site-name";
import { compareLocale, compareNum, type SortDir } from "@/lib/table-sort";
import { adminParentControlsDisabledClass } from "@/lib/admin-parent-controls-disabled";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

const SELECT_CLASS =
  "h-8 min-w-[9rem] rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type SortKey =
  | "submittedOrCreated"
  | "batchNumber"
  | "customer"
  | "subtotal"
  | "lineCount"
  | "estimateSaved";

function bundleCustomerSortKey(bundle: AdminSubmittedBatchBundle): string {
  const n = bundle.userFullName?.trim();
  if (n) return n;
  const e = bundle.userEmail?.trim();
  if (e) return e;
  return bundle.session.clerkUserId;
}

function bundleSentOrCreatedMs(bundle: AdminSubmittedBatchBundle): number {
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

function bundleSubtotalCents(bundle: AdminSubmittedBatchBundle): number {
  return bundle.latestEstimate?.subtotalCents ?? -1;
}

function bundleEstimateSavedMs(bundle: AdminSubmittedBatchBundle): number {
  const est = bundle.latestEstimate;
  if (!est) return -1;
  const t = new Date(est.createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

function bundleMatchesSearch(
  bundle: AdminSubmittedBatchBundle,
  q: string
): boolean {
  if (!q) return true;
  const parts: string[] = [
    bundle.session.batchNumber,
    bundle.session.siteKey,
    bundle.userFullName ?? "",
    bundle.userEmail ?? "",
  ];
  for (const r of bundle.requests) {
    parts.push(
      r.productName ?? "",
      r.productUrl ?? "",
      r.siteName ?? ""
    );
  }
  const haystack = parts.join(" ").toLowerCase();
  return haystack.includes(q);
}
function submitterDisplayName(
  fullName: string | null,
  email: string | null
): string {
  const name = fullName?.trim();
  if (name) return name;
  const mail = email?.trim();
  if (mail) return mail;
  return "Customer";
}

function trimOrNull(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

type AdminBatchQuoteHistoryPanelProps = {
  bundles: AdminSubmittedBatchBundle[];
  latestQuotesByRequestId: Record<string, ItemQuote>;
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
};

export function AdminBatchQuoteHistoryPanel({
  bundles,
  latestQuotesByRequestId,
  staffProfilesByClerkUserId = {},
}: AdminBatchQuoteHistoryPanelProps) {
  const router = useRouter();
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
  const [sortKey, setSortKey] =
    useState<SortKey>("submittedOrCreated");
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
  }, [search, sortKey, sortDir, pageSize]);

  const searchNorm = search.trim().toLowerCase();

  const filtered = useMemo(
    () => bundles.filter((b) => bundleMatchesSearch(b, searchNorm)),
    [bundles, searchNorm],
  );

  const filteredSorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      switch (sortKey) {
        case "batchNumber":
          return compareLocale(
            a.session.batchNumber,
            b.session.batchNumber,
            sortDir,
          );
        case "customer":
          return compareLocale(
            bundleCustomerSortKey(a),
            bundleCustomerSortKey(b),
            sortDir,
          );
        case "subtotal":
          return compareNum(
            bundleSubtotalCents(a),
            bundleSubtotalCents(b),
            sortDir,
          );
        case "lineCount":
          return compareNum(a.requests.length, b.requests.length, sortDir);
        case "estimateSaved":
          return compareNum(
            bundleEstimateSavedMs(a),
            bundleEstimateSavedMs(b),
            sortDir,
          );
        case "submittedOrCreated":
        default:
          return compareNum(
            bundleSentOrCreatedMs(a),
            bundleSentOrCreatedMs(b),
            sortDir,
          );
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

  const BATCH_ESTIMATES_TABLE_COL_SPAN = 6;

  const groupedPageSlice = useMemo(() => {
    const byClerk = new Map<string, AdminSubmittedBatchBundle[]>();
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
        displayLabel: adminCustomerDisplayLabel({
          fullName: first.userFullName,
          email: first.userEmail,
          clerkUserId,
        }),
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
    if (activeClerkUserId !== clerkUserId) {
      setLineSearch("");
      setLinePageByCustomerId({});
    }
  }, [activeClerkUserId]);

  const showFrom =
    filteredSorted.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1;
  const showTo = Math.min(pageSafe * pageSize, filteredSorted.length);

  const cycleSortDir = useCallback(() => {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }, []);

  if (bundles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Combined retailer quotes persist here with preview and bundled estimate edits.
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field className="gap-1.5 sm:col-span-2">
                <FieldLabel htmlFor="batch-estimates-search" className="text-xs">
                  Search
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="batch-estimates-search"
                    placeholder="Batch, customer, site, product…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoComplete="off"
                  />
                </FieldContent>
                <FieldDescription>
                  Case-insensitive match across batch number, site key, customer, and line
                  products.
                </FieldDescription>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel htmlFor="batch-estimates-sort" className="text-xs">
                  Sort by
                </FieldLabel>
                <FieldContent>
                  <div className="flex flex-wrap gap-2">
                    <select
                      id="batch-estimates-sort"
                      className={cn(SELECT_CLASS, "min-w-[11rem] flex-1")}
                      value={sortKey}
                      onChange={(e) =>
                        setSortKey(e.target.value as SortKey)
                      }
                    >
                      <option value="submittedOrCreated">Submitted / created</option>
                      <option value="batchNumber">Batch number</option>
                      <option value="customer">Customer</option>
                      <option value="subtotal">Estimate subtotal</option>
                      <option value="lineCount">Line count</option>
                      <option value="estimateSaved">Estimate saved</option>
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
                <FieldLabel htmlFor="batch-estimates-page-size" className="text-xs">
                  Per page
                </FieldLabel>
                <FieldContent>
                  <select
                    id="batch-estimates-page-size"
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
            </div>

            <p className="text-xs text-muted-foreground">
              {filteredSorted.length === 0 ? (
                <>No batches match the current search.</>
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
                      (<span className="tabular-nums">{bundles.length}</span> total)
                    </>
                  ) : null}
                </>
              )}
            </p>
          </>
        ) : null}
      </div>

      <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead
            className={cn(
              "border-b border-border bg-muted/40",
              adminParentControlsDisabledClass(customerExpanded),
            )}
            aria-hidden={customerExpanded || undefined}
          >
            <tr>
              <th className="px-3 py-2.5 font-medium">Batch</th>
              <th className="px-3 py-2.5 font-medium">Customer</th>
              <th className="px-3 py-2.5 font-medium">Subtotal</th>
              <th className="px-3 py-2.5 font-medium">Lines</th>
              <th className="min-w-[9rem] px-3 py-2.5 font-medium">Updated by</th>
              <th className="px-3 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groupedPageSlice.map(({ clerkUserId, displayLabel, bundles: customerBundles }) => {
              const first = customerBundles[0]!;
              const expanded = activeClerkUserId === clerkUserId;
              const searchNorm = lineSearch.trim().toLowerCase();
              const lineFiltered = customerBundles.filter((b) =>
                bundleMatchesSearch(b, searchNorm),
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
              const bundleSlice = lineFiltered.slice(
                lineStart,
                lineStart + linePageSize,
              );
              const lineShowFrom = lineCount === 0 ? 0 : lineStart + 1;
              const lineShowTo = Math.min(lineStart + linePageSize, lineCount);

              return (
              <Fragment key={clerkUserId}>
                <tr
                  className={cn(
                    "border-b border-border bg-muted/40 transition-colors hover:bg-muted/55",
                    expanded && "bg-muted/50",
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
                    colSpan={BATCH_ESTIMATES_TABLE_COL_SPAN}
                  >
                    <span className="inline-flex items-center gap-2">
                      {expanded ? (
                        <ChevronDownIcon className="size-4 shrink-0" aria-hidden />
                      ) : (
                        <ChevronRightIcon className="size-4 shrink-0" aria-hidden />
                      )}
                      <AdminCustomerRecordLabel
                        clerkUserId={clerkUserId}
                        fullName={first.userFullName}
                        email={first.userEmail}
                        className="inline-block align-middle"
                        primaryClassName="text-xs font-semibold"
                      />
                      <span className="font-normal normal-case text-muted-foreground">
                        ({customerBundles.length} batch
                        {customerBundles.length === 1 ? "" : "es"})
                      </span>
                    </span>
                  </td>
                </tr>
                {expanded ? (
                  <>
                    <tr className="bg-muted/15">
                      <td colSpan={BATCH_ESTIMATES_TABLE_COL_SPAN} className="p-0">
                        <div className="border-b border-border px-3 py-4">
                          <AdminNestedFindOrganizePanel
                            switchId={`${baseId}-line-find-organize-${clerkUserId}`}
                            searchInputId={`${baseId}-line-search-${clerkUserId}`}
                            pageSizeSelectId={`${baseId}-line-page-size-${clerkUserId}`}
                            visible={lineFindOrganizeVisible}
                            onVisibleChange={setLineFindOrganizeVisible}
                            search={lineSearch}
                            onSearchChange={setLineSearch}
                            searchLabel="Search batches"
                            searchPlaceholder="Batch, site, product…"
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
                                Previous batches
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
                                Next batches
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {bundleSlice.length === 0 ? (
                      <tr>
                        <td
                          colSpan={BATCH_ESTIMATES_TABLE_COL_SPAN}
                          className="px-4 py-8 text-center text-sm text-muted-foreground"
                        >
                          {lineSearch.trim()
                            ? "No batches match the current search."
                            : "No batches for this customer."}
                        </td>
                      </tr>
                    ) : null}
                    {bundleSlice.map((b) => {
              const estimate = b.latestEstimate;
              return (
                <tr key={b.session.id}>
                  <td className="px-3 py-3 font-mono text-xs">{b.session.batchNumber}</td>
                  <td className="max-w-[12rem] px-3 py-3 text-xs text-muted-foreground">
                    {submitterDisplayName(b.userFullName, b.userEmail)}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-xs">
                    {estimate ? formatUsd(estimate.subtotalCents) : "—"}
                  </td>
                  <td className="px-3 py-3 text-xs">{b.requests.length}</td>
                  <td className="min-w-[9rem] max-w-[11rem] px-3 py-3 align-top">
                    <AdminUpdatedByCell
                      clerkUserId={batchEstimateRecordedByClerkUserId(estimate)}
                      profilesByClerkUserId={staffProfilesByClerkUserId}
                    />
                  </td>
                  <td className="flex flex-wrap gap-2 px-3 py-3">
                    <Dialog>
                      <DialogTrigger
                        type="button"
                        className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted/60"
                      >
                        Preview bundle
                      </DialogTrigger>
                      <DialogContent className="max-h-[85vh] w-[min(96vw,40rem)] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Batch {b.session.batchNumber}</DialogTitle>
                          <DialogDescription>
                            Snapshot of shopper lines bundled for this retailer.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-5 pt-2">
                          <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Individual product estimates
                            </p>
                            <ul className="space-y-2 text-sm">
                              {b.requests.map((r) => {
                                const q = latestQuotesByRequestId[r.id];
                                const quantity =
                                  q?.requestQuantity != null
                                    ? q.requestQuantity
                                    : r.quantity;
                                const size = trimOrNull(
                                  q?.requestProductSize ?? r.productSize
                                );
                                const color = trimOrNull(
                                  q?.requestProductColor ?? r.productColor
                                );
                                return (
                                  <li
                                    key={r.id}
                                    className="rounded-md border border-border bg-muted/20 px-3 py-2.5"
                                  >
                                    <p className="font-medium text-foreground">
                                      {r.productName?.trim() || "Product"}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {displaySiteName(r.siteName, r.productUrl)}
                                    </p>
                                    <dl className="mt-2 grid gap-1 border-t border-border pt-2 text-xs tabular-nums">
                                      <div className="flex justify-between gap-2">
                                        <dt className="text-muted-foreground">Qty</dt>
                                        <dd className="text-foreground">{quantity}</dd>
                                      </div>
                                      {size ? (
                                        <div className="flex justify-between gap-2">
                                          <dt className="text-muted-foreground">Size</dt>
                                          <dd className="text-end text-foreground">{size}</dd>
                                        </div>
                                      ) : null}
                                      {color ? (
                                        <div className="flex justify-between gap-2">
                                          <dt className="text-muted-foreground">Color</dt>
                                          <dd className="text-end text-foreground">{color}</dd>
                                        </div>
                                      ) : null}
                                    </dl>
                                    {q ? (
                                      <div className="mt-3 rounded-md border border-border bg-muted/15 px-2.5 py-2.5">
                                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                          If purchased alone (saved quote)
                                        </p>
                                        <ul className="space-y-1.5 text-xs tabular-nums text-muted-foreground">
                                          {q.merchandiseSavingsCents != null &&
                                          q.merchandiseSavingsCents > 0 ? (
                                            <>
                                              <li className="flex justify-between gap-2">
                                                <span>Pack / bundle subtotal (listed)</span>
                                                <span className="text-foreground">
                                                  {formatUsd(
                                                    q.itemCost + q.merchandiseSavingsCents
                                                  )}
                                                </span>
                                              </li>
                                              <li className="flex justify-between gap-2">
                                                <span>Savings</span>
                                                <span className="text-foreground">
                                                  −{formatUsd(q.merchandiseSavingsCents)}
                                                </span>
                                              </li>
                                            </>
                                          ) : null}
                                          <li className="flex justify-between gap-2">
                                            <span>
                                              {q.merchandiseSavingsCents != null &&
                                              q.merchandiseSavingsCents > 0
                                                ? "Merchandise subtotal (pack line)"
                                                : "Merchandise"}
                                            </span>
                                            <span className="text-foreground">
                                              {formatUsd(q.itemCost)}
                                            </span>
                                          </li>
                                          <li className="flex justify-between gap-2">
                                            <span>Service &amp; handling</span>
                                            <span className="text-foreground">
                                              {formatUsd(q.serviceFee)}
                                            </span>
                                          </li>
                                          <li className="flex justify-between gap-2">
                                            <span>Shipping (est.)</span>
                                            <span className="text-foreground">
                                              {formatUsd(q.estimatedShipping)}
                                            </span>
                                          </li>
                                          <li className="flex justify-between gap-2">
                                            <span>Tax</span>
                                            <span className="text-foreground">
                                              {formatUsd(lineSaleTaxCentsFromQuote(q))}
                                            </span>
                                          </li>
                                          <li className="flex justify-between gap-2 border-t border-border pt-2 font-medium text-foreground">
                                            <span>Total</span>
                                            <span>{formatUsd(q.totalPrice)}</span>
                                          </li>
                                        </ul>
                                        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                                          Tax is the remainder of total minus merchandise, service,
                                          and shipping (as saved).
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="mt-2 text-xs text-muted-foreground">
                                        No saved line quote—single-line totals not available.
                                      </p>
                                    )}
                                    {q?.merchandiseIncludesSiteShippingTax ? (
                                      <p className="mt-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
                                        <span className="font-medium text-foreground">
                                          Shipping &amp; tax in merchandise:
                                        </span>{" "}
                                        Staff recorded that retailer-listed shipping and sale tax
                                        are rolled into merchandise above ($0 splits on this line).
                                      </p>
                                    ) : null}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>

                          <Separator />

                          {estimate ? (
                            <div className="space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Batch estimates
                              </p>
                              <div className="grid gap-2 rounded-md border border-border bg-muted/15 p-3 text-sm tabular-nums">
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">
                                    Service &amp; handling
                                  </span>
                                  <span className="text-foreground">
                                    {formatUsd(estimate.serviceHandlingTotalCents)}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="text-muted-foreground">Shipping</span>
                                  <span className="text-foreground">
                                    {formatUsd(estimate.siteShippingTotalCents)}
                                  </span>
                                </div>
                                {estimate.siteSaleTaxTotalCents > 0 ? (
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">Tax</span>
                                    <span className="text-foreground">
                                      {formatUsd(estimate.siteSaleTaxTotalCents)}
                                    </span>
                                  </div>
                                ) : null}
                                <div className="flex justify-between gap-2 border-t border-border pt-2 text-xs">
                                  <span className="text-muted-foreground">
                                    Saved subtotal (staff)
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {formatUsd(estimate.subtotalCents)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </DialogContent>
                    </Dialog>
                    {b.session.status === "estimated" ? (
                      <AdminBatchQuoteEstimateDialog
                        batchSessionId={b.session.id}
                        triggerLabel="Edit estimate"
                        onSaved={() => router.refresh()}
                      />
                    ) : null}
                  </td>
                </tr>
              );
                })}
                  </>
                ) : null}
              </Fragment>
              );
            })}
          </tbody>
        </table>
      </FloatingHorizontalScroll>

      {filteredSorted.length > 0 ? (
        <div
          className={cn(
            "flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between",
            adminParentControlsDisabledClass(customerExpanded),
          )}
          aria-hidden={customerExpanded || undefined}
        >
          <p className="text-xs text-muted-foreground">
            Page{" "}
            <span className="font-medium tabular-nums text-foreground">{pageSafe}</span>{" "}
            of{" "}
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

      <Separator />
    </div>
  );
}
