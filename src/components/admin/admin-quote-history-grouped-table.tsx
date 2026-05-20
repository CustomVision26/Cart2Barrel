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

import { AdminProductUrlDialog } from "@/components/admin/admin-product-url-dialog";
import { AdminQuoteHistoryEditDialog } from "@/components/admin/admin-quote-history-edit-dialog";
import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { QuoteEstimatePreviewDialog } from "@/components/quote-estimate-preview-dialog";
import { SortableTh, SortableThCompact } from "@/components/sortable-th";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AdminQuoteHistoryGroup, AdminQuoteHistoryLine } from "@/data/admin-quote-history";
import type { MerchantPricingEstimateSnapshot } from "@/data/merchant-pricing-settings";
import type { ItemQuote, ItemRequestLineSnapshot } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import {
  ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE,
  ITEM_QUOTE_CHECKOUT_SNAPSHOT_PAID,
  isOperationalQuoteRow,
} from "@/lib/checkout-snapshot-kind";
import { adminItemRequestStatusDisplay } from "@/lib/item-request-status-label";
import { ITEM_QUOTE_VOID_REASON_STAFF_OUT_OF_STOCK } from "@/lib/item-quote-void-reason";
import { adminItemRequestOrderBadgeKind } from "@/lib/status-badge-map";
import { displaySiteName } from "@/lib/site-name";
import type { SortDir } from "@/lib/table-sort";
import {
  compareLocale,
  compareNum,
  nextSortState,
} from "@/lib/table-sort";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

const SELECT_CLASS =
  "h-8 min-w-[9rem] rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function quoteRevisionLabel(q: ItemQuote): string {
  if (q.checkoutSnapshotKind === ITEM_QUOTE_CHECKOUT_SNAPSHOT_PAID) {
    return "Paid";
  }
  if (q.checkoutSnapshotKind === ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE) {
    return "Company Purchase";
  }
  if (q.voidedAt) {
    if (q.voidReason === ITEM_QUOTE_VOID_REASON_STAFF_OUT_OF_STOCK) {
      return "Out of stock";
    }
    return "Superseded";
  }
  return "Current";
}

function submitterDisplayName(
  fullName: string | null,
  email: string | null
): string {
  const name = fullName?.trim();
  if (name) return name;
  const mail = email?.trim();
  if (mail) return mail;
  return "Unknown user";
}

type QhGroupSortKey = "customer" | "email" | "quotes";

type QhLineSortKey =
  | "product"
  | "site"
  | "url"
  | "status"
  | "revision"
  | "total"
  | "quoted";

function requestStatusOrder(s: string): number {
  const o: Record<string, number> = {
    pending: 0,
    quoted: 1,
    approved: 2,
    rejected: 3,
    withdrawn: 4,
  };
  return o[s] ?? 99;
}

function normalizeSearchQ(raw: string): string {
  return raw.trim().toLowerCase();
}

function quoteHistoryLineMatchesQuery(
  line: AdminQuoteHistoryLine,
  q: string
): boolean {
  if (!q) return true;
  const { request: r, quote: quoteRow } = line;
  const chunks = [
    r.id,
    quoteRow.id,
    r.productName,
    r.productUrl,
    displaySiteName(r.siteName, r.productUrl),
    r.status,
    adminItemRequestStatusDisplay(r.status, line.orderStatus),
  ];
  return chunks.some(
    (chunk) =>
      chunk != null &&
      String(chunk).toLowerCase().includes(q)
  );
}

/**
 * Filters customer groups by search. Matching a customer header keeps all
 * quote lines; matching only line fields returns that subgroup for lookup.
 */
function filterQuoteHistoryGroups(
  source: AdminQuoteHistoryGroup[],
  qRaw: string
): AdminQuoteHistoryGroup[] {
  const q = normalizeSearchQ(qRaw);
  if (!q) return source;

  const next: AdminQuoteHistoryGroup[] = [];
  for (const g of source) {
    const name = submitterDisplayName(g.userFullName, g.userEmail).toLowerCase();
    const email = (g.userEmail ?? "").trim().toLowerCase();
    const uid = g.clerkUserId.toLowerCase();
    const headerMatch =
      name.includes(q) || email.includes(q) || uid.includes(q);
    const lineHits = g.lines.filter((l) => quoteHistoryLineMatchesQuery(l, q));

    if (headerMatch) {
      next.push(g);
    } else if (lineHits.length > 0) {
      next.push({ ...g, lines: lineHits });
    }
  }
  return next;
}

function sortQuoteHistoryLines(
  lines: AdminQuoteHistoryLine[],
  key: QhLineSortKey,
  dir: SortDir
): AdminQuoteHistoryLine[] {
  const copy = [...lines];
  copy.sort((a, b) => {
    const ra = a.request;
    const rb = b.request;
    const qa = a.quote;
    const qb = b.quote;
    switch (key) {
      case "product":
        return compareLocale(
          ra.productName?.trim() || "",
          rb.productName?.trim() || "",
          dir
        );
      case "site":
        return compareLocale(
          displaySiteName(ra.siteName, ra.productUrl),
          displaySiteName(rb.siteName, rb.productUrl),
          dir
        );
      case "url":
        return compareLocale(ra.productUrl, rb.productUrl, dir);
      case "status":
        return compareNum(
          requestStatusOrder(ra.status),
          requestStatusOrder(rb.status),
          dir
        );
      case "revision":
        return compareNum(qa.voidedAt ? 1 : 0, qb.voidedAt ? 1 : 0, dir);
      case "total":
        return compareNum(qa.totalPrice, qb.totalPrice, dir);
      case "quoted":
        return compareNum(
          new Date(qa.createdAt).getTime(),
          new Date(qb.createdAt).getTime(),
          dir
        );
      default:
        return 0;
    }
  });
  return copy;
}

type AdminQuoteHistoryGroupedTableProps = {
  groups: AdminQuoteHistoryGroup[];
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
  merchantEstimateFees?: MerchantPricingEstimateSnapshot;
};

export function AdminQuoteHistoryGroupedTable({
  groups,
  snapshotsByRequestId,
  merchantEstimateFees,
}: AdminQuoteHistoryGroupedTableProps) {
  const [openClerkUserId, setOpenClerkUserId] = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [groupSortKey, setGroupSortKey] = useState<QhGroupSortKey>("customer");
  const [groupSortDir, setGroupSortDir] = useState<SortDir>("asc");
  const [lineSortKey, setLineSortKey] = useState<QhLineSortKey>("quoted");
  const [lineSortDir, setLineSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [page, setPage] = useState(1);
  /** Per-customer quote-table page when a group is expanded (key = clerkUserId). */
  const [quoteLinePageByCustomerId, setQuoteLinePageByCustomerId] = useState<
    Record<string, number>
  >({});
  const [findOrganizeVisible, setFindOrganizeVisible] = useState(true);
  const baseId = useId();

  const filteredGroups = useMemo(
    () => filterQuoteHistoryGroups(groups, search),
    [groups, search]
  );

  const sortedGroups = useMemo(() => {
    const next = [...filteredGroups];
    const dir = groupSortDir;
    next.sort((a, b) => {
      switch (groupSortKey) {
        case "customer":
          return compareLocale(
            submitterDisplayName(a.userFullName, a.userEmail),
            submitterDisplayName(b.userFullName, b.userEmail),
            dir
          );
        case "email":
          return compareLocale(
            (a.userEmail ?? "").trim().toLowerCase(),
            (b.userEmail ?? "").trim().toLowerCase(),
            dir
          );
        case "quotes":
          return compareNum(a.lines.length, b.lines.length, dir);
        default:
          return 0;
      }
    });
    return next;
  }, [filteredGroups, groupSortKey, groupSortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedGroups.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  useEffect(() => {
    setPage(1);
    setQuoteLinePageByCustomerId({});
  }, [search, groupSortKey, groupSortDir, pageSize]);

  useEffect(() => {
    setQuoteLinePageByCustomerId({});
  }, [lineSortKey, lineSortDir]);

  useEffect(() => {
    if (page !== pageSafe) setPage(pageSafe);
  }, [page, pageSafe]);

  const pageSlice = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return sortedGroups.slice(start, start + pageSize);
  }, [sortedGroups, pageSafe, pageSize]);

  const showFrom =
    sortedGroups.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1;
  const showTo = Math.min(pageSafe * pageSize, sortedGroups.length);

  const cycleGroupSort = useCallback((key: QhGroupSortKey) => {
    const next = nextSortState(groupSortKey, groupSortDir, key);
    setGroupSortKey(next.key);
    setGroupSortDir(next.dir);
  }, [groupSortKey, groupSortDir]);

  const cycleLineSort = useCallback((key: QhLineSortKey) => {
    const next = nextSortState(lineSortKey, lineSortDir, key);
    setLineSortKey(next.key);
    setLineSortDir(next.dir);
  }, [lineSortKey, lineSortDir]);

  const selectedLine = useMemo((): AdminQuoteHistoryLine | null => {
    if (!selectedQuoteId) return null;
    for (const g of groups) {
      const hit = g.lines.find((l) => l.quote.id === selectedQuoteId);
      if (hit) return hit;
    }
    return null;
  }, [groups, selectedQuoteId]);

  const toggle = useCallback((clerkUserId: string) => {
    setOpenClerkUserId((prev) => (prev === clerkUserId ? null : clerkUserId));
    setSelectedQuoteId(null);
  }, []);

  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No saved quotes yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Superseded estimates voided when a customer requests a new quote are omitted here; open{" "}
        <span className="font-medium text-foreground">Active requests</span> to see those
        lines.
      </p>

      <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium text-foreground">Find & organize</p>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="admin-quote-history-find-organize"
              className="cursor-pointer text-xs font-normal text-muted-foreground"
            >
              Show filters and sort
            </Label>
            <Switch
              id="admin-quote-history-find-organize"
              checked={findOrganizeVisible}
              onCheckedChange={setFindOrganizeVisible}
            />
          </div>
        </div>

        {findOrganizeVisible ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field className="gap-1.5 sm:col-span-2 lg:col-span-2">
                <FieldLabel htmlFor="quote-history-search" className="text-xs">
                  Search
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="quote-history-search"
                    placeholder="Customer, email, product, URL, request or quote id…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoComplete="off"
                  />
                </FieldContent>
                <FieldDescription>
                  Case-insensitive substring match. Table columns sort the
                  current result set.
                </FieldDescription>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel htmlFor="quote-history-page-size" className="text-xs">
                  Rows per page
                </FieldLabel>
                <FieldContent>
                  <select
                    id="quote-history-page-size"
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
                <FieldDescription>
                  Limits customer groups in the table above. When you expand a customer, the
                  same number limits how many quote rows show at once (with its own
                  prev/next).
                </FieldDescription>
              </Field>
            </div>

            <p className="text-xs text-muted-foreground">
              {sortedGroups.length === 0 ? (
                <>No customers match the current search.</>
              ) : (
                <>
                  Showing{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {showFrom}–{showTo}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {sortedGroups.length}
                  </span>{" "}
                  customer group{sortedGroups.length === 1 ? "" : "s"}
                  {sortedGroups.length < groups.length ? (
                    <>
                      {" "}
                      (<span className="tabular-nums">{groups.length}</span>{" "}
                      total loaded)
                    </>
                  ) : null}
                </>
              )}
            </p>
          </>
        ) : null}
      </div>

      {sortedGroups.length === 0 ? null : (
        <>
          <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="w-10 px-2 py-2.5" aria-hidden />
                  <SortableTh
                    columnId="qh-customer"
                    label="Customer"
                    active={groupSortKey === "customer"}
                    dir={groupSortDir}
                    onSort={() => cycleGroupSort("customer")}
                  />
                  <SortableTh
                    columnId="qh-email"
                    label="Email"
                    active={groupSortKey === "email"}
                    dir={groupSortDir}
                    onSort={() => cycleGroupSort("email")}
                  />
                  <SortableTh
                    columnId="qh-quotes"
                    label="Quotes"
                    numeric
                    active={groupSortKey === "quotes"}
                    dir={groupSortDir}
                    onSort={() => cycleGroupSort("quotes")}
                  />
                </tr>
              </thead>
              {pageSlice.map((g) => {
                const expanded = openClerkUserId === g.clerkUserId;
                const panelId = `${baseId}-quotes-${g.clerkUserId}`;
                const name = submitterDisplayName(g.userFullName, g.userEmail);

                const sortedLinesForGroup = expanded
                  ? sortQuoteHistoryLines(g.lines, lineSortKey, lineSortDir)
                  : [];
                const quoteLineCount = sortedLinesForGroup.length;
                const qlTotalPages = Math.max(
                  1,
                  Math.ceil(quoteLineCount / pageSize)
                );
                const rawQlPage = quoteLinePageByCustomerId[g.clerkUserId] ?? 1;
                const qlPageSafe = Math.min(
                  Math.max(1, rawQlPage),
                  qlTotalPages
                );
                const qlStart = (qlPageSafe - 1) * pageSize;
                const quoteLineSlice = sortedLinesForGroup.slice(
                  qlStart,
                  qlStart + pageSize
                );
                const qlShowFrom =
                  quoteLineCount === 0 ? 0 : qlStart + 1;
                const qlShowTo = Math.min(qlStart + pageSize, quoteLineCount);

                return (
                  <tbody
                    key={g.clerkUserId}
                    className="border-b border-border last:border-b-0"
                  >
                    <tr
                      className={cn(
                        "bg-background transition-colors hover:bg-muted/40",
                        expanded && "bg-muted/25"
                      )}
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => toggle(g.clerkUserId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggle(g.clerkUserId);
                        }
                      }}
                    >
                      <td className="px-2 py-2.5 align-middle text-muted-foreground">
                        {expanded ? (
                          <ChevronDownIcon className="size-4" aria-hidden />
                        ) : (
                          <ChevronRightIcon className="size-4" aria-hidden />
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <div className="font-medium text-foreground">{name}</div>
                      </td>
                      <td className="max-w-[14rem] px-3 py-2.5 align-middle">
                        <span className="truncate text-muted-foreground">
                          {g.userEmail?.trim() || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-middle tabular-nums text-foreground">
                        {g.lines.length}
                      </td>
                    </tr>
                    {expanded ? (
                      <tr>
                        <td colSpan={4} className="bg-muted/15 p-0">
                          <div
                            id={panelId}
                            className="border-t border-border px-3 py-4"
                            role="region"
                            aria-label={`Quote history for ${name}`}
                          >
                            <p className="mb-3 text-xs text-muted-foreground">
                              On rows with{" "}
                              <span className="font-medium text-foreground">
                                request status Quoted
                              </span>
                              , use{" "}
                              <span className="font-medium text-foreground">Edit</span> under
                              Audit to change amounts or run AI assist.{" "}
                              <span className="font-medium text-foreground">In cart</span> means
                              the customer can see the line on their cart;{" "}
                              <span className="font-medium text-foreground">In order …</span>{" "}
                              means checkout created an order (cart hides it until the order is
                              removed).
                            </p>
                            <FloatingHorizontalScroll viewportClassName="rounded-md border border-border bg-background">
                              <table className="w-full min-w-[50rem] text-left text-xs sm:text-sm">
                                <thead className="border-b border-border bg-muted/50">
                                  <tr>
                                    <th className="px-2 py-2 font-medium text-foreground">
                                      Photo
                                    </th>
                                    <SortableThCompact
                                      columnId="qh-line-product"
                                      label="Product"
                                      active={lineSortKey === "product"}
                                      dir={lineSortDir}
                                      onSort={() => cycleLineSort("product")}
                                    />
                                    <SortableThCompact
                                      columnId="qh-line-site"
                                      label="Site name"
                                      active={lineSortKey === "site"}
                                      dir={lineSortDir}
                                      onSort={() => cycleLineSort("site")}
                                    />
                                    <SortableThCompact
                                      columnId="qh-line-url"
                                      label="URL"
                                      active={lineSortKey === "url"}
                                      dir={lineSortDir}
                                      onSort={() => cycleLineSort("url")}
                                    />
                                    <SortableThCompact
                                      columnId="qh-line-status"
                                      label="Request status"
                                      active={lineSortKey === "status"}
                                      dir={lineSortDir}
                                      onSort={() => cycleLineSort("status")}
                                    />
                                    <SortableThCompact
                                      columnId="qh-line-revision"
                                      label="Revision"
                                      active={lineSortKey === "revision"}
                                      dir={lineSortDir}
                                      onSort={() => cycleLineSort("revision")}
                                    />
                                    <th className="px-2 py-2 font-medium text-foreground">
                                      Preview
                                    </th>
                                    <SortableThCompact
                                      columnId="qh-line-total"
                                      label="Total"
                                      numeric
                                      active={lineSortKey === "total"}
                                      dir={lineSortDir}
                                      onSort={() => cycleLineSort("total")}
                                    />
                                    <SortableThCompact
                                      columnId="qh-line-quoted"
                                      label="Quoted"
                                      active={lineSortKey === "quoted"}
                                      dir={lineSortDir}
                                      onSort={() => cycleLineSort("quoted")}
                                    />
                                    <th className="px-2 py-2 font-medium text-foreground">
                                      Audit
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {quoteLineSlice.map((line) => {
                                    const { quote: q, request: r } = line;
                                    const canEditQuote =
                                      r.status === "quoted" && isOperationalQuoteRow(q);
                                    return (
                                      <tr key={q.id} className="align-top hover:bg-muted/30">
                                        <td className="px-2 py-2 align-top">
                                          <ProductRequestThumbnail
                                            variant="admin"
                                            imageUrl={r.productImageUrl}
                                            productLabel={r.productName}
                                          />
                                        </td>
                                        <td className="max-w-[10rem] px-2 py-2 text-foreground">
                                          <span className="line-clamp-2">
                                            {r.productName?.trim() || "—"}
                                          </span>
                                        </td>
                                        <td className="max-w-[8rem] px-2 py-2 text-muted-foreground">
                                          <span className="line-clamp-2">
                                            {displaySiteName(r.siteName, r.productUrl)}
                                          </span>
                                        </td>
                                        <td className="px-2 py-2">
                                          <AdminProductUrlDialog productUrl={r.productUrl} />
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                                          <StatusBadge
                                            kind={adminItemRequestOrderBadgeKind(
                                              r.status,
                                              line.orderStatus
                                            )}
                                          >
                                            {adminItemRequestStatusDisplay(
                                              r.status,
                                              line.orderStatus
                                            )}
                                          </StatusBadge>
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-2">
                                          <span
                                            className={cn(
                                              "rounded-md px-1.5 py-0.5 text-xs font-medium",
                                              q.checkoutSnapshotKind ===
                                                ITEM_QUOTE_CHECKOUT_SNAPSHOT_PAID &&
                                                "bg-sky-500/15 text-sky-900 dark:text-sky-300",
                                              q.checkoutSnapshotKind ===
                                                ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE &&
                                                "bg-violet-500/15 text-violet-900 dark:text-violet-300",
                                              !q.checkoutSnapshotKind &&
                                                q.voidedAt &&
                                                "bg-muted text-muted-foreground",
                                              !q.checkoutSnapshotKind &&
                                                !q.voidedAt &&
                                                "bg-primary/15 text-foreground"
                                            )}
                                            title={quoteRevisionLabel(q)}
                                          >
                                            {quoteRevisionLabel(q)}
                                          </span>
                                        </td>
                                        <td className="px-2 py-2">
                                          <QuoteEstimatePreviewDialog
                                            itemRequestId={r.id}
                                            label="Preview"
                                          />
                                        </td>
                                        <td className="px-2 py-2 font-medium tabular-nums text-foreground">
                                          {formatUsd(q.totalPrice)}
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                                          <time dateTime={q.createdAt}>
                                            {new Date(q.createdAt).toLocaleString()}
                                          </time>
                                        </td>
                                        <td className="px-2 py-2">
                                          <div className="flex flex-col items-start gap-2">
                                            <ItemRequestLineAuditDialog
                                              itemRequestId={r.id}
                                              productLabel={r.productName?.trim() || ""}
                                              snapshots={snapshotsByRequestId[r.id] ?? []}
                                            />
                                            {canEditQuote ? (
                                              <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                className="whitespace-nowrap"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSelectedQuoteId(q.id);
                                                  setEditOpen(true);
                                                }}
                                              >
                                                Edit quote
                                              </Button>
                                            ) : null}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </FloatingHorizontalScroll>
                            {quoteLineCount > pageSize ? (
                              <div className="mt-3 flex flex-col items-stretch gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs text-muted-foreground">
                                  Quotes{" "}
                                  <span className="font-medium tabular-nums text-foreground">
                                    {qlShowFrom}–{qlShowTo}
                                  </span>{" "}
                                  of{" "}
                                  <span className="font-medium tabular-nums text-foreground">
                                    {quoteLineCount}
                                  </span>
                                  {" · "}
                                  Page{" "}
                                  <span className="font-medium tabular-nums text-foreground">
                                    {qlPageSafe}
                                  </span>{" "}
                                  of{" "}
                                  <span className="font-medium tabular-nums text-foreground">
                                    {qlTotalPages}
                                  </span>
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={qlPageSafe <= 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setQuoteLinePageByCustomerId((prev) => ({
                                        ...prev,
                                        [g.clerkUserId]: Math.max(1, qlPageSafe - 1),
                                      }));
                                    }}
                                  >
                                    Previous quotes
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={qlPageSafe >= qlTotalPages}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setQuoteLinePageByCustomerId((prev) => ({
                                        ...prev,
                                        [g.clerkUserId]: Math.min(
                                          qlTotalPages,
                                          qlPageSafe + 1
                                        ),
                                      }));
                                    }}
                                  >
                                    Next quotes
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                );
              })}
            </table>
          </FloatingHorizontalScroll>

          <div className="flex flex-col items-stretch gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Customer groups — page{" "}
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
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pageSafe >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <AdminQuoteHistoryEditDialog
        open={editOpen && Boolean(selectedLine)}
        onOpenChange={(next) => {
          setEditOpen(next);
          if (!next) setSelectedQuoteId(null);
        }}
        line={selectedLine}
        merchantEstimateFees={merchantEstimateFees}
      />
    </div>
  );
}
