"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { AdminFindOrganizeVisibilityToggle } from "@/components/admin/admin-find-organize-visibility-toggle";
import { AdminNestedFindOrganizePanel } from "@/components/admin/admin-nested-find-organize-panel";
import { AdminProductUrlDialog } from "@/components/admin/admin-product-url-dialog";
import { AdminQuoteHistoryEditDialog } from "@/components/admin/admin-quote-history-edit-dialog";
import { AdminQuoteHistoryProductTimelineTable } from "@/components/admin/admin-quote-history-product-timeline-table";
import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import type { ReceivedProductPhoto } from "@/components/orders/received-photos-viewer";
import { outsidePurchaseConditionPhotosFromRequest } from "@/lib/outside-purchase-condition-images";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
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
import type { AdminQuoteHistoryGroup, AdminQuoteHistoryLine } from "@/data/admin-quote-history";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
import type { MerchantPricingEstimateSnapshot } from "@/data/merchant-pricing-settings";
import type { BatchQuoteEstimate, ItemQuote, ItemRequestLineSnapshot, OutsidePurchaseReturnRequest } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import type { BatchLineShare } from "@/lib/batch-line-share";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import {
  collapseQuoteHistoryToCurrentProducts,
  countQuoteHistoryProducts,
} from "@/lib/admin-quote-history-display";
import { isOperationalQuoteRow } from "@/lib/checkout-snapshot-kind";
import {
  itemRequestStatusBadgeKindForDisplay,
  itemRequestStatusLabelForDisplay,
} from "@/lib/item-request-status-label";
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

/** Received condition photo(s) captured at outside-purchase intake. */
function outsidePurchaseConditionPhotos(r: {
  outsidePurchaseConditionImageUrls?: string[] | null;
  outsidePurchaseConditionImageUrl?: string | null;
  productImageUrl?: string | null;
}): ReceivedProductPhoto[] {
  return outsidePurchaseConditionPhotosFromRequest({
    outsidePurchaseConditionImageUrls: r.outsidePurchaseConditionImageUrls ?? null,
    outsidePurchaseConditionImageUrl: r.outsidePurchaseConditionImageUrl ?? null,
    productImageUrl: r.productImageUrl ?? null,
  });
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
  | "total"
  | "quoted";

type QuoteHistoryStatusContext = {
  orderContextByRequestId: Record<string, ItemRequestOrderContext>;
  returnRequestsByItemRequestId: Record<string, OutsidePurchaseReturnRequest>;
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
};

function quoteHistoryLineStatusLabel(
  line: AdminQuoteHistoryLine,
  ctx: QuoteHistoryStatusContext,
): string {
  const { request: r } = line;
  return itemRequestStatusLabelForDisplay(
    r,
    ctx.returnRequestsByItemRequestId[r.id] ?? null,
    ctx.orderContextByRequestId[r.id],
    "admin",
    ctx.snapshotsByRequestId[r.id],
  );
}

function quoteHistoryLineStatusBadgeKind(
  line: AdminQuoteHistoryLine,
  ctx: QuoteHistoryStatusContext,
) {
  const { request: r } = line;
  return itemRequestStatusBadgeKindForDisplay(
    r,
    ctx.returnRequestsByItemRequestId[r.id] ?? null,
    ctx.orderContextByRequestId[r.id],
    "admin",
    ctx.snapshotsByRequestId[r.id],
  );
}

function normalizeSearchQ(raw: string): string {
  return raw.trim().toLowerCase();
}

function quoteHistoryLineMatchesQuery(
  line: AdminQuoteHistoryLine,
  q: string,
  ctx: QuoteHistoryStatusContext,
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
    quoteHistoryLineStatusLabel(line, ctx),
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
  qRaw: string,
  ctx: QuoteHistoryStatusContext,
): AdminQuoteHistoryGroup[] {
  const q = normalizeSearchQ(qRaw);
  if (!q) {
    return source.map((group) => ({
      ...group,
      lines: collapseQuoteHistoryToCurrentProducts(group.lines),
    }));
  }

  const next: AdminQuoteHistoryGroup[] = [];
  for (const g of source) {
    const name = submitterDisplayName(g.userFullName, g.userEmail).toLowerCase();
    const email = (g.userEmail ?? "").trim().toLowerCase();
    const uid = g.clerkUserId.toLowerCase();
    const headerMatch =
      name.includes(q) || email.includes(q) || uid.includes(q);
    const lineHits = g.lines.filter((l) =>
      quoteHistoryLineMatchesQuery(l, q, ctx),
    );

    if (headerMatch) {
      next.push({ ...g, lines: collapseQuoteHistoryToCurrentProducts(g.lines) });
    } else if (lineHits.length > 0) {
      const requestIds = new Set(lineHits.map((line) => line.request.id));
      next.push({
        ...g,
        lines: collapseQuoteHistoryToCurrentProducts(
          g.lines.filter((line) => requestIds.has(line.request.id)),
        ),
      });
    }
  }
  return next;
}

function sortQuoteHistoryLines(
  lines: AdminQuoteHistoryLine[],
  key: QhLineSortKey,
  dir: SortDir,
  ctx: QuoteHistoryStatusContext,
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
        return compareLocale(
          quoteHistoryLineStatusLabel(a, ctx),
          quoteHistoryLineStatusLabel(b, ctx),
          dir,
        );
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
  returnRequestsByItemRequestId?: Record<string, OutsidePurchaseReturnRequest>;
  quotesByRequestId?: Record<string, ItemQuote[]>;
  batchShareByRequestId?: Record<string, BatchLineShare>;
  batchEstimateNoteByRequestId?: Record<string, string>;
  batchNumberByRequestId?: Record<string, string>;
  batchEstimateByRequestId?: Record<string, BatchQuoteEstimate>;
  orderContextByRequestId?: Record<string, ItemRequestOrderContext>;
  merchantEstimateFees?: MerchantPricingEstimateSnapshot;
};

export function AdminQuoteHistoryGroupedTable({
  groups,
  snapshotsByRequestId,
  returnRequestsByItemRequestId = {},
  quotesByRequestId = {},
  batchShareByRequestId = {},
  batchEstimateNoteByRequestId = {},
  batchNumberByRequestId = {},
  batchEstimateByRequestId = {},
  orderContextByRequestId = {},
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
  const [lineSearch, setLineSearch] = useState("");
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [page, setPage] = useState(1);
  /** Per-customer quote-table page when a group is expanded (key = clerkUserId). */
  const [quoteLinePageByCustomerId, setQuoteLinePageByCustomerId] = useState<
    Record<string, number>
  >({});
  const [expandedProductKey, setExpandedProductKey] = useState<string | null>(null);
  const [findOrganizeVisible, setFindOrganizeVisible] = useState(true);
  const [lineFindOrganizeVisible, setLineFindOrganizeVisible] = useState(true);
  const baseId = useId();
  const findOrganizeSwitchId = `${baseId}-find-organize`;
  const lineFindOrganizeSwitchId = `${baseId}-line-find-organize`;

  const customerExpanded = openClerkUserId !== null;

  const statusContext = useMemo(
    (): QuoteHistoryStatusContext => ({
      orderContextByRequestId,
      returnRequestsByItemRequestId,
      snapshotsByRequestId,
    }),
    [orderContextByRequestId, returnRequestsByItemRequestId, snapshotsByRequestId],
  );

  const filteredGroups = useMemo(
    () => filterQuoteHistoryGroups(groups, search, statusContext),
    [groups, search, statusContext],
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
          return compareNum(
            countQuoteHistoryProducts(a.lines),
            countQuoteHistoryProducts(b.lines),
            dir,
          );
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
    setExpandedProductKey(null);
    setLineSearch("");
  }, [search, groupSortKey, groupSortDir, pageSize]);

  useEffect(() => {
    setQuoteLinePageByCustomerId({});
    setExpandedProductKey(null);
  }, [lineSortKey, lineSortDir]);

  useEffect(() => {
    if (!openClerkUserId) return;
    setQuoteLinePageByCustomerId((prev) => ({
      ...prev,
      [openClerkUserId]: 1,
    }));
    setExpandedProductKey(null);
  }, [lineSearch, pageSize, openClerkUserId]);

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

  const expandedGroup = useMemo(() => {
    if (!openClerkUserId) return null;
    return (
      sortedGroups.find((g) => g.clerkUserId === openClerkUserId) ??
      groups.find((g) => g.clerkUserId === openClerkUserId) ??
      null
    );
  }, [openClerkUserId, sortedGroups, groups]);

  const expandedLinePanel = useMemo(() => {
    if (!expandedGroup) return null;

    const lineFiltered = expandedGroup.lines.filter((line) =>
      quoteHistoryLineMatchesQuery(line, lineSearch, statusContext),
    );
    const sortedLines = sortQuoteHistoryLines(
      lineFiltered,
      lineSortKey,
      lineSortDir,
      statusContext,
    );
    const quoteLineCount = sortedLines.length;
    const qlTotalPages = Math.max(1, Math.ceil(quoteLineCount / pageSize));
    const rawQlPage = quoteLinePageByCustomerId[expandedGroup.clerkUserId] ?? 1;
    const qlPageSafe = Math.min(Math.max(1, rawQlPage), qlTotalPages);
    const qlStart = (qlPageSafe - 1) * pageSize;
    const quoteLineSlice = sortedLines.slice(qlStart, qlStart + pageSize);
    const qlShowFrom = quoteLineCount === 0 ? 0 : qlStart + 1;
    const qlShowTo = Math.min(qlStart + pageSize, quoteLineCount);

    return {
      lineFiltered,
      quoteLineCount,
      qlTotalPages,
      qlPageSafe,
      quoteLineSlice,
      qlShowFrom,
      qlShowTo,
    };
  }, [
    expandedGroup,
    lineSearch,
    lineSortKey,
    lineSortDir,
    statusContext,
    pageSize,
    quoteLinePageByCustomerId,
  ]);

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
    setOpenClerkUserId((prev) => {
      const next = prev === clerkUserId ? null : clerkUserId;
      if (next !== prev) {
        setLineSearch("");
        setQuoteLinePageByCustomerId({});
      }
      return next;
    });
    setSelectedQuoteId(null);
    setExpandedProductKey(null);
  }, []);

  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No saved quotes yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        One row per product with its current fulfillment status. Superseded estimates voided
        when a customer requests a new quote are omitted here; open{" "}
        <span className="font-medium text-foreground">Active requests</span> to see those
        lines.
      </p>

      {!customerExpanded ? (
        <div className="space-y-3 rounded-lg border border-border/80 bg-card p-4 ring-1 ring-foreground/5">
          <AdminFindOrganizeVisibilityToggle
            id={findOrganizeSwitchId}
            visible={findOrganizeVisible}
            onVisibleChange={setFindOrganizeVisible}
          />

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
                    Limits customer groups in the table below.
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
      ) : null}

      {sortedGroups.length === 0 ? null : (
        <>
          <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border/80 bg-card ring-1 ring-foreground/5">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-b border-border bg-muted">
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
                    label="Products"
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
                const linePanel = expanded ? expandedLinePanel : null;
                const quoteLineSlice = linePanel?.quoteLineSlice ?? [];
                const fullGroupLines =
                  groups.find((group) => group.clerkUserId === g.clerkUserId)?.lines ??
                  g.lines;

                return (
                  <tbody
                    key={g.clerkUserId}
                    className="border-b border-border last:border-b-0"
                  >
                    <tr
                      className={cn(
                        "bg-background transition-colors hover:bg-accent",
                        expanded && "bg-accent"
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
                        <td colSpan={4} className="bg-secondary p-0">
                          <div
                            id={panelId}
                            className="border-t border-border px-3 py-4"
                            role="region"
                            aria-label={`Quote history for ${name}`}
                          >
                            <p className="mb-3 text-xs text-muted-foreground">
                              One row per product with its{" "}
                              <span className="font-medium text-foreground">current status</span>.
                              Double-click a row to open the full status history (first event
                              through now).{" "}
                              <span className="font-medium text-foreground">Audit trail</span> is
                              only on the current row. Use{" "}
                              <span className="font-medium text-foreground">Edit quote</span> when
                              status is still Quoted (in-app requests only).
                            </p>

                            {linePanel ? (
                              <AdminNestedFindOrganizePanel
                                switchId={`${lineFindOrganizeSwitchId}-${g.clerkUserId}`}
                                searchInputId={`${baseId}-line-search-${g.clerkUserId}`}
                                pageSizeSelectId={`${baseId}-line-page-size-${g.clerkUserId}`}
                                visible={lineFindOrganizeVisible}
                                onVisibleChange={setLineFindOrganizeVisible}
                                search={lineSearch}
                                onSearchChange={setLineSearch}
                                searchLabel="Search products"
                                searchPlaceholder="Product, URL, site, status, request or quote id…"
                                searchDescription="Filters this customer's products only. Column headers below sort the filtered list."
                                pageSize={pageSize}
                                onPageSizeChange={setPageSize}
                                pageSizeLabel="Products per page"
                                pageSizeDescription="Paginates the product rows in this panel."
                                showFrom={linePanel.qlShowFrom}
                                showTo={linePanel.qlShowTo}
                                totalCount={linePanel.quoteLineCount}
                                totalLoaded={g.lines.length}
                                itemLabel="product"
                                emptyMessage="No products for this customer."
                                noMatchMessage="No products match the current search."
                              />
                            ) : null}

                            <FloatingHorizontalScroll viewportClassName="rounded-md border border-border bg-background">
                              <table className="w-full min-w-[44rem] text-left text-xs sm:text-sm">
                                <thead className="border-b border-border bg-muted">
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
                                      label="Status"
                                      active={lineSortKey === "status"}
                                      dir={lineSortDir}
                                      onSort={() => cycleLineSort("status")}
                                    />
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
                                  {quoteLineSlice.length === 0 ? (
                                    <tr>
                                      <td
                                        colSpan={8}
                                        className="px-4 py-8 text-center text-sm text-muted-foreground"
                                      >
                                        {lineSearch.trim() ?
                                          "No products match the current search."
                                        : "No products for this customer."}
                                      </td>
                                    </tr>
                                  ) : null}
                                  {quoteLineSlice.map((line) => {
                                    const { quote: q, request: r } = line;
                                    const canEditQuote =
                                      r.status === "quoted" &&
                                      isOperationalQuoteRow(q) &&
                                      !isOutsidePurchaseRequest(r);
                                    const productKey = `${g.clerkUserId}:${r.id}`;
                                    const historyOpen = expandedProductKey === productKey;
                                    return (
                                      <Fragment key={q.id}>
                                        <tr
                                          className={cn(
                                            "cursor-pointer align-top hover:bg-muted",
                                            historyOpen &&
                                              "bg-sky-500/[0.06] shadow-[inset_3px_0_0_rgb(56_189_248_/_0.65)]",
                                          )}
                                          title="Double-click to view full status history"
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedProductKey((prev) =>
                                              prev === productKey ? null : productKey,
                                            );
                                          }}
                                        >
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
                                        <td className="max-w-[14rem] px-2 py-2 text-muted-foreground">
                                          <StatusBadge
                                            kind={quoteHistoryLineStatusBadgeKind(
                                              line,
                                              statusContext,
                                            )}
                                            title={quoteHistoryLineStatusLabel(
                                              line,
                                              statusContext,
                                            )}
                                            className="whitespace-normal leading-snug"
                                          >
                                            {quoteHistoryLineStatusLabel(
                                              line,
                                              statusContext,
                                            )}
                                          </StatusBadge>
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
                                              isOutsidePurchase={isOutsidePurchaseRequest(r)}
                                              conditionPhotos={outsidePurchaseConditionPhotos(r)}
                                              quotes={quotesByRequestId[r.id] ?? []}
                                              estimateQuote={q}
                                              batchEstimateShare={
                                                batchShareByRequestId[r.id] ?? null
                                              }
                                              batchEstimateNote={
                                                batchEstimateNoteByRequestId[r.id] ?? null
                                              }
                                              batchNumber={
                                                batchNumberByRequestId[r.id] ?? null
                                              }
                                              batchEstimate={
                                                batchEstimateByRequestId[r.id] ?? null
                                              }
                                              receiptPhotoUrl={r.outsidePurchaseReceiptImageUrl}
                                              productImageUrl={r.productImageUrl}
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
                                        {historyOpen ?
                                          <tr className="bg-sky-500/[0.04]">
                                            <td
                                              colSpan={8}
                                              className="border-t border-sky-500/25 px-4 py-4 shadow-[inset_3px_0_0_rgb(56_189_248_/_0.65)]"
                                            >
                                              <AdminQuoteHistoryProductTimelineTable
                                                request={r}
                                                allGroupLines={fullGroupLines}
                                                snapshots={snapshotsByRequestId[r.id] ?? []}
                                                returnRequest={
                                                  returnRequestsByItemRequestId[r.id] ?? null
                                                }
                                                orderContext={orderContextByRequestId[r.id]}
                                              />
                                            </td>
                                          </tr>
                                        : null}
                                      </Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </FloatingHorizontalScroll>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                );
              })}
            </table>
          </FloatingHorizontalScroll>

          {!customerExpanded ? (
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
          ) : expandedLinePanel && expandedGroup &&
            expandedLinePanel.quoteLineCount > pageSize ? (
            <div className="flex flex-col items-stretch gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Products{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {expandedLinePanel.qlShowFrom}–{expandedLinePanel.qlShowTo}
                </span>{" "}
                of{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {expandedLinePanel.quoteLineCount}
                </span>
                {" · "}
                Page{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {expandedLinePanel.qlPageSafe}
                </span>{" "}
                of{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {expandedLinePanel.qlTotalPages}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={expandedLinePanel.qlPageSafe <= 1}
                  onClick={() =>
                    setQuoteLinePageByCustomerId((prev) => ({
                      ...prev,
                      [expandedGroup.clerkUserId]: Math.max(
                        1,
                        expandedLinePanel.qlPageSafe - 1,
                      ),
                    }))
                  }
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    expandedLinePanel.qlPageSafe >= expandedLinePanel.qlTotalPages
                  }
                  onClick={() =>
                    setQuoteLinePageByCustomerId((prev) => ({
                      ...prev,
                      [expandedGroup.clerkUserId]: Math.min(
                        expandedLinePanel.qlTotalPages,
                        expandedLinePanel.qlPageSafe + 1,
                      ),
                    }))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
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
