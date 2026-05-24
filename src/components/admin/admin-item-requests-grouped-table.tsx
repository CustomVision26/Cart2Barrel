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

import { AdminAiEstimateDialog } from "@/components/admin/admin-ai-estimate-dialog";
import { AdminMarkOutOfStockButton } from "@/components/admin/admin-mark-out-of-stock-button";
import { AdminOutsidePurchaseReturnEstimateDialog } from "@/components/admin/admin-outside-purchase-return-estimate-dialog";
import { AdminItemRequestUrlOrReceipt } from "@/components/admin/admin-item-request-url-or-receipt";
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
import { AdminFindOrganizeVisibilityToggle } from "@/components/admin/admin-find-organize-visibility-toggle";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { displaySiteName } from "@/lib/site-name";
import type { SortDir } from "@/lib/table-sort";
import {
  compareLocale,
  compareNum,
  nextSortState,
} from "@/lib/table-sort";
import type {
  ItemQuote,
  ItemRequestLineSnapshot,
  OutsidePurchaseReturnRequest,
} from "@/db/schema";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import {
  itemRequestStatusBadgeKindForDisplay,
  itemRequestStatusLabelForDisplay,
} from "@/lib/item-request-status-label";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
import type { AdminQuoteHistoryLine } from "@/data/admin-quote-history";
import type { MerchantPricingEstimateSnapshot } from "@/data/merchant-pricing-settings";
import { isOperationalQuoteRow } from "@/lib/checkout-snapshot-kind";
import type { AdminItemRequestGroup } from "@/lib/admin-item-requests-group";
import { adminRequestQueueKindBadgeKind } from "@/lib/status-badge-map";
import type {
  AdminItemRequestWithUserRow,
  AdminRequestQueueKind,
} from "@/data/admin-item-requests";

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

type GroupSortKey =
  | "account"
  | "email"
  | "pending"
  | "quoted"
  | "activeQueue"
  | "total";

type LineSortKey = "kind" | "product" | "site" | "url" | "submitted";

function queueKindOrder(kind: AdminRequestQueueKind): number {
  if (kind === "resend") return 0;
  if (kind === "new") return 1;
  return 2;
}

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

/** Account table columns (expand + metrics). */
const ACTIVE_QUEUE_GROUP_COL_SPAN = 7;

/** Flat queue-line table columns (account + email + line cells). */
const ACTIVE_QUEUE_FLAT_COL_SPAN = 12;

const SELECT_CLASS =
  "h-8 min-w-[9rem] rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function normalizeSearchQ(raw: string): string {
  return raw.trim().toLowerCase();
}

function queueKindSearchTokens(kind: AdminRequestQueueKind): string[] {
  if (kind === "new") return ["new", "request", "first"];
  if (kind === "resend") return ["resend", "customer", "estimate"];
  return ["quoted", "acceptance"];
}

function activeQueueRowMatchesQuery(
  row: AdminItemRequestWithUserRow,
  q: string
): boolean {
  if (!q) return true;
  const { request: r, queueKind } = row;
  const chunks: Array<string | null | undefined> = [
    r.id,
    r.productName,
    r.productUrl,
    displaySiteName(r.siteName, r.productUrl),
    r.status,
    ...queueKindSearchTokens(queueKind),
  ];
  return chunks.some(
    (chunk) =>
      chunk != null && String(chunk).toLowerCase().includes(q)
  );
}

function narrowActiveQueueGroupToLines(
  g: AdminItemRequestGroup,
  lineHits: AdminItemRequestWithUserRow[]
): AdminItemRequestGroup {
  return {
    ...g,
    activeQueueRequests: lineHits,
    activeQueueCount: lineHits.length,
    pendingCount: lineHits.filter((r) => r.request.status === "pending").length,
    quotedCount: lineHits.filter((r) => r.request.status === "quoted").length,
  };
}

/**
 * Filters account groups by search. When the query matches queue-line fields,
 * visible rows are narrowed to those hits (including if the account header
 * also matched, so counts stay aligned with the table).
 */
function filterActiveQueueGroups(
  source: AdminItemRequestGroup[],
  qRaw: string
): AdminItemRequestGroup[] {
  const q = normalizeSearchQ(qRaw);
  if (!q) return source;

  const next: AdminItemRequestGroup[] = [];
  for (const g of source) {
    const name = submitterDisplayName(g.userFullName, g.userEmail).toLowerCase();
    const email = (g.userEmail ?? "").trim().toLowerCase();
    const uid = g.clerkUserId.toLowerCase();
    const headerMatch =
      name.includes(q) || email.includes(q) || uid.includes(q);
    const lineHits = g.activeQueueRequests.filter((row) =>
      activeQueueRowMatchesQuery(row, q)
    );

    if (headerMatch && lineHits.length === 0) {
      next.push(g);
    } else if (lineHits.length > 0) {
      next.push(narrowActiveQueueGroupToLines(g, lineHits));
    }
  }
  return next;
}

function compareActiveQueueRows(
  a: AdminItemRequestWithUserRow,
  b: AdminItemRequestWithUserRow,
  key: LineSortKey,
  dir: SortDir
): number {
  const ra = a.request;
  const rb = b.request;
  switch (key) {
    case "kind":
      return compareNum(
        queueKindOrder(a.queueKind),
        queueKindOrder(b.queueKind),
        dir
      );
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
    case "submitted":
      return compareNum(
        new Date(ra.createdAt).getTime(),
        new Date(rb.createdAt).getTime(),
        dir
      );
    default:
      return 0;
  }
}

function sortActiveQueueRows(
  rows: AdminItemRequestWithUserRow[],
  key: LineSortKey,
  dir: SortDir
): AdminItemRequestWithUserRow[] {
  const copy = [...rows];
  copy.sort((a, b) => compareActiveQueueRows(a, b, key, dir));
  return copy;
}

type ActiveQueuePaginationMode = "accounts" | "queue_lines";

type ActiveQueueLineEntry = {
  group: AdminItemRequestGroup;
  row: AdminItemRequestWithUserRow;
};

function sortActiveQueueLineEntries(
  entries: ActiveQueueLineEntry[],
  key: LineSortKey,
  dir: SortDir
): ActiveQueueLineEntry[] {
  const copy = [...entries];
  copy.sort((a, b) => compareActiveQueueRows(a.row, b.row, key, dir));
  return copy;
}

/** One active-queue line (shared by grouped expand panel and flat line view). */
function ActiveQueueLineTableRow({
  group,
  row,
  snapshotsByRequestId,
  latestQuotesByRequestId,
  returnRequestsByItemRequestId = {},
  orderContextByRequestId = {},
  onEditQuote,
  showAccountColumns = false,
  merchantEstimateFees,
}: {
  group: AdminItemRequestGroup;
  row: AdminItemRequestWithUserRow;
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
  latestQuotesByRequestId: Record<string, ItemQuote>;
  returnRequestsByItemRequestId?: Record<string, OutsidePurchaseReturnRequest>;
  orderContextByRequestId?: Record<string, ItemRequestOrderContext>;
  onEditQuote: (line: AdminQuoteHistoryLine) => void;
  /** When true, prepend Account and Email cells (flat paginated-by-line table). */
  showAccountColumns?: boolean;
  merchantEstimateFees?: MerchantPricingEstimateSnapshot;
}) {
  const { request: r, queueKind } = row;
  const isOutside = isOutsidePurchaseRequest(r);
  const returnReq = returnRequestsByItemRequestId[r.id] ?? null;
  const allowAiEstimate =
    !isOutside && (queueKind === "new" || queueKind === "resend");
  const latestQuote = latestQuotesByRequestId[r.id];
  const canEditQuote =
    !isOutside &&
    queueKind === "quoted" &&
    latestQuote != null &&
    isOperationalQuoteRow(latestQuote);
  const showGenerateReturnEstimate =
    isOutside &&
    returnReq?.status === "submitted" &&
    latestQuote != null;
  const accountName = submitterDisplayName(group.userFullName, group.userEmail);

  return (
    <tr className="hover:bg-muted/30">
      {showAccountColumns ? (
        <>
          <td className="px-3 py-2 align-top">
            <div className="font-medium text-foreground">{accountName}</div>
          </td>
          <td className="max-w-[14rem] px-3 py-2 align-top">
            <span className="truncate text-muted-foreground">
              {group.userEmail?.trim() || "—"}
            </span>
          </td>
        </>
      ) : null}
      <td className="whitespace-nowrap px-2 py-2 align-top">
        {isOutside ?
          <StatusBadge
            kind={itemRequestStatusBadgeKindForDisplay(
              r,
              returnReq,
              orderContextByRequestId[r.id],
              "admin",
            )}
            title={r.status}
          >
            {itemRequestStatusLabelForDisplay(
              r,
              returnReq,
              orderContextByRequestId[r.id],
              "admin",
            )}
          </StatusBadge>
        : <StatusBadge kind={adminRequestQueueKindBadgeKind(queueKind)}>
            {queueKind === "new" ?
              "New request"
            : queueKind === "resend" ?
              "Customer resend"
            : "Quoted"}
          </StatusBadge>
        }
      </td>
      <td className="px-2 py-2 align-top">
        <ProductRequestThumbnail
          variant="admin"
          imageUrl={r.productImageUrl}
          productLabel={r.productName}
        />
      </td>
      <td className="max-w-[9rem] px-2 py-2 align-top text-foreground">
        <span className="line-clamp-2">{r.productName?.trim() || "—"}</span>
      </td>
      <td className="max-w-[8rem] px-2 py-2 align-top text-muted-foreground">
        <span className="line-clamp-2">
          {displaySiteName(r.siteName, r.productUrl)}
        </span>
      </td>
      <td className="px-2 py-2 align-top">
        <AdminItemRequestUrlOrReceipt
          productUrl={r.productUrl}
          outsidePurchaseReceiptImageUrl={r.outsidePurchaseReceiptImageUrl}
        />
      </td>
      <td className="px-2 py-2 align-top">
        {allowAiEstimate ? (
          <AdminAiEstimateDialog
            itemRequestId={r.id}
            productUrl={r.productUrl}
            initialQuantity={r.quantity}
            initialProductSize={r.productSize}
            initialProductColor={r.productColor}
            initialProductImageUrl={r.productImageUrl}
            merchantEstimateFees={merchantEstimateFees}
          />
        ) : canEditQuote && latestQuote ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="whitespace-nowrap"
            onClick={() => {
              onEditQuote({
                quote: latestQuote,
                request: r,
                userFullName: group.userFullName,
                userEmail: group.userEmail,
                orderStatus: null,
              });
            }}
          >
            Edit quote
          </Button>
        ) : showGenerateReturnEstimate && returnReq ?
          <AdminOutsidePurchaseReturnEstimateDialog
            request={r}
            quote={latestQuote}
            returnRequest={returnReq}
            serviceTiers={merchantEstimateFees?.serviceTiers ?? []}
          />
        : queueKind === "quoted" ?
          <span className="text-xs text-muted-foreground">No quote</span>
        : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-2 py-2 align-top">
        {isOutside ?
          <span className="text-muted-foreground">—</span>
        : <AdminMarkOutOfStockButton
            itemRequestId={r.id}
            productLabel={r.productName?.trim() || undefined}
          />
        }
      </td>
      <td className="px-2 py-2 align-top">
        <QuoteEstimatePreviewDialog itemRequestId={r.id} />
      </td>
      <td className="px-2 py-2 align-top">
        <ItemRequestLineAuditDialog
          itemRequestId={r.id}
          productLabel={r.productName?.trim() || ""}
          snapshots={snapshotsByRequestId[r.id] ?? []}
        />
      </td>
      <td className="whitespace-nowrap px-2 py-2 align-top text-muted-foreground">
        <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleString()}</time>
      </td>
    </tr>
  );
}

type AdminItemRequestsGroupedTableProps = {
  groups: AdminItemRequestGroup[];
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
  /** Latest operational quote per request (for Edit quote on quoted queue rows). */
  latestQuotesByRequestId?: Record<string, ItemQuote>;
  returnRequestsByItemRequestId?: Record<string, OutsidePurchaseReturnRequest>;
  orderContextByRequestId?: Record<string, ItemRequestOrderContext>;
  merchantEstimateFees?: MerchantPricingEstimateSnapshot;
};

export function AdminItemRequestsGroupedTable({
  groups,
  snapshotsByRequestId,
  latestQuotesByRequestId = {},
  returnRequestsByItemRequestId = {},
  orderContextByRequestId = {},
  merchantEstimateFees,
}: AdminItemRequestsGroupedTableProps) {
  const [openClerkUserId, setOpenClerkUserId] = useState<string | null>(null);
  const [editQuoteOpen, setEditQuoteOpen] = useState(false);
  const [editQuoteLine, setEditQuoteLine] = useState<AdminQuoteHistoryLine | null>(
    null,
  );
  const [groupSortKey, setGroupSortKey] = useState<GroupSortKey>("account");
  const [groupSortDir, setGroupSortDir] = useState<SortDir>("asc");
  const [lineSortKey, setLineSortKey] = useState<LineSortKey>("submitted");
  const [lineSortDir, setLineSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [page, setPage] = useState(1);
  const [paginationMode, setPaginationMode] =
    useState<ActiveQueuePaginationMode>("accounts");
  const [findOrganizeVisible, setFindOrganizeVisible] = useState(true);
  const baseId = useId();
  const findOrganizeSwitchId = `${baseId}-find-organize`;

  const toggle = useCallback((clerkUserId: string) => {
    setOpenClerkUserId((prev) => (prev === clerkUserId ? null : clerkUserId));
  }, []);

  const cycleGroupSort = useCallback(
    (key: GroupSortKey) => {
      const next = nextSortState(groupSortKey, groupSortDir, key);
      setGroupSortKey(next.key);
      setGroupSortDir(next.dir);
    },
    [groupSortKey, groupSortDir]
  );

  const cycleLineSort = useCallback(
    (key: LineSortKey) => {
      const next = nextSortState(lineSortKey, lineSortDir, key);
      setLineSortKey(next.key);
      setLineSortDir(next.dir);
    },
    [lineSortKey, lineSortDir]
  );

  const filteredGroups = useMemo(
    () => filterActiveQueueGroups(groups, search),
    [groups, search]
  );

  const flatLineEntries = useMemo(() => {
    if (paginationMode !== "queue_lines") return [];
    const flat: ActiveQueueLineEntry[] = [];
    for (const g of filteredGroups) {
      for (const row of g.activeQueueRequests) {
        flat.push({ group: g, row });
      }
    }
    return sortActiveQueueLineEntries(flat, lineSortKey, lineSortDir);
  }, [filteredGroups, lineSortKey, lineSortDir, paginationMode]);

  const sortedGroups = useMemo(() => {
    const next = [...filteredGroups];
    const dir = groupSortDir;
    next.sort((a, b) => {
      switch (groupSortKey) {
        case "account":
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
        case "pending":
          return compareNum(a.pendingCount, b.pendingCount, dir);
        case "quoted":
          return compareNum(a.quotedCount, b.quotedCount, dir);
        case "activeQueue":
          return compareNum(a.activeQueueCount, b.activeQueueCount, dir);
        case "total":
          return compareNum(a.totalCount, b.totalCount, dir);
        default:
          return 0;
      }
    });
    return next;
  }, [filteredGroups, groupSortKey, groupSortDir]);

  const itemCount =
    paginationMode === "accounts"
      ? sortedGroups.length
      : flatLineEntries.length;

  const totalPages = Math.max(1, Math.ceil(itemCount / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const accountsInLineView = useMemo(() => {
    if (paginationMode !== "queue_lines" || flatLineEntries.length === 0) {
      return 0;
    }
    return new Set(flatLineEntries.map((e) => e.group.clerkUserId)).size;
  }, [flatLineEntries, paginationMode]);

  useEffect(() => {
    if (paginationMode !== "accounts") setOpenClerkUserId(null);
  }, [paginationMode]);

  useEffect(() => {
    setPage(1);
  }, [search, groupSortKey, groupSortDir, pageSize, paginationMode]);

  useEffect(() => {
    if (paginationMode !== "queue_lines") return;
    setPage(1);
  }, [lineSortKey, lineSortDir, paginationMode]);

  useEffect(() => {
    if (page !== pageSafe) setPage(pageSafe);
  }, [page, pageSafe]);

  const accountPageSlice = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return sortedGroups.slice(start, start + pageSize);
  }, [sortedGroups, pageSafe, pageSize]);

  const linePageSlice = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return flatLineEntries.slice(start, start + pageSize);
  }, [flatLineEntries, pageSafe, pageSize]);

  const showFrom = itemCount === 0 ? 0 : (pageSafe - 1) * pageSize + 1;
  const showTo = Math.min(pageSafe * pageSize, itemCount);

  const openEditQuote = useCallback((line: AdminQuoteHistoryLine) => {
    setEditQuoteLine(line);
    setEditQuoteOpen(true);
  }, []);

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
        <AdminFindOrganizeVisibilityToggle
          id={findOrganizeSwitchId}
          visible={findOrganizeVisible}
          onVisibleChange={setFindOrganizeVisible}
        />

        {findOrganizeVisible ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field className="gap-1.5 sm:col-span-2 lg:col-span-2">
                <FieldLabel htmlFor="active-queue-search" className="text-xs">
                  Search
                </FieldLabel>
                <FieldContent>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      id="active-queue-search"
                      placeholder="Customer, email, product, URL, request id, queue type…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      autoComplete="off"
                      className="min-w-0 flex-1"
                    />
                    {search.trim() ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0"
                        onClick={() => setSearch("")}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </FieldContent>
                <FieldDescription>
                  Case-insensitive substring match.{" "}
                  {paginationMode === "accounts" ?
                    "Account headers sort the account list; expand a row for line-level sort in the panel."
                  : "Column headers sort the flat queue lines."}
                </FieldDescription>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel htmlFor="active-queue-pagination-mode" className="text-xs">
                  Paginate by
                </FieldLabel>
                <FieldContent>
                  <select
                    id="active-queue-pagination-mode"
                    className={SELECT_CLASS}
                    value={paginationMode}
                    onChange={(e) =>
                      setPaginationMode(
                        e.target.value as ActiveQueuePaginationMode
                      )
                    }
                  >
                    <option value="accounts">Account groups</option>
                    <option value="queue_lines">Queue lines (flat)</option>
                  </select>
                </FieldContent>
                <FieldDescription>
                  Account groups: one table row per shopper; expand for lines. Queue
                  lines: one row per active-queue item with its own page size.
                </FieldDescription>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel htmlFor="active-queue-page-size" className="text-xs">
                  {paginationMode === "queue_lines" ?
                    "Queue lines per page"
                  : "Accounts per page"}
                </FieldLabel>
                <FieldContent>
                  <select
                    id="active-queue-page-size"
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
              {itemCount === 0 ? (
                paginationMode === "queue_lines" ?
                  <>No queue lines match the current search.</>
                : <>No accounts match the current search.</>
              ) : paginationMode === "queue_lines" ? (
                <>
                  Showing{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {showFrom}–{showTo}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {itemCount}
                  </span>{" "}
                  queue line{itemCount === 1 ? "" : "s"}
                  {accountsInLineView > 0 ? (
                    <>
                      {" "}
                      across{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {accountsInLineView}
                      </span>{" "}
                      account{accountsInLineView === 1 ? "" : "s"}
                    </>
                  ) : null}
                  {sortedGroups.length < groups.length ? (
                    <>
                      {" "}
                      (<span className="tabular-nums">{groups.length}</span>{" "}
                      accounts loaded)
                    </>
                  ) : null}
                </>
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
                  account{sortedGroups.length === 1 ? "" : "s"} with queue
                  activity
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

      {groups.length > 0 ? (
        <>
        {paginationMode === "accounts" ? (
          <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border">
            <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className="w-10 px-2 py-2.5" aria-hidden />
            <SortableTh
              columnId="grp-account"
              label="Account"
              active={groupSortKey === "account"}
              dir={groupSortDir}
              onSort={() => cycleGroupSort("account")}
            />
            <SortableTh
              columnId="grp-email"
              label="Email"
              active={groupSortKey === "email"}
              dir={groupSortDir}
              onSort={() => cycleGroupSort("email")}
            />
            <SortableTh
              columnId="grp-pending"
              label="Pending"
              numeric
              active={groupSortKey === "pending"}
              dir={groupSortDir}
              onSort={() => cycleGroupSort("pending")}
            />
            <SortableTh
              columnId="grp-quoted"
              label="Quoted"
              numeric
              active={groupSortKey === "quoted"}
              dir={groupSortDir}
              onSort={() => cycleGroupSort("quoted")}
            />
            <SortableTh
              columnId="grp-active"
              label="Active queue"
              numeric
              active={groupSortKey === "activeQueue"}
              dir={groupSortDir}
              onSort={() => cycleGroupSort("activeQueue")}
            />
            <SortableTh
              columnId="grp-total"
              label="All requests"
              numeric
              active={groupSortKey === "total"}
              dir={groupSortDir}
              onSort={() => cycleGroupSort("total")}
            />
          </tr>
        </thead>
        {accountPageSlice.length === 0 ? (
          <tbody>
            <tr>
              <td
                colSpan={ACTIVE_QUEUE_GROUP_COL_SPAN}
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                <p>No accounts match the current search.</p>
                {search.trim() ? (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="mt-2 h-auto px-0"
                    onClick={() => setSearch("")}
                  >
                    Clear search
                  </Button>
                ) : null}
              </td>
            </tr>
          </tbody>
        ) : null}
        {accountPageSlice.map((g) => {
          const expanded = openClerkUserId === g.clerkUserId;
          const panelId = `${baseId}-pending-${g.clerkUserId}`;
          const name = submitterDisplayName(g.userFullName, g.userEmail);

          return (
            <tbody key={g.clerkUserId} className="border-b border-border last:border-b-0">
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
                  {g.pendingCount}
                </td>
                <td className="px-3 py-2.5 align-middle tabular-nums text-foreground">
                  {g.quotedCount}
                </td>
                <td className="px-3 py-2.5 align-middle tabular-nums text-foreground">
                  {g.activeQueueCount}
                </td>
                <td className="px-3 py-2.5 align-middle tabular-nums text-muted-foreground">
                  {g.totalCount}
                </td>
              </tr>
              {expanded ? (
                <tr>
                  <td colSpan={7} className="bg-muted/15 p-0">
                    <div
                      id={panelId}
                      className="border-t border-border px-3 py-4"
                      role="region"
                      aria-label={`Active queue for ${name}`}
                    >
                      <p className="mb-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">New request</span>{" "}
                        = first-time pending.{" "}
                        <span className="font-medium text-foreground">Customer resend</span>{" "}
                        = pending after the shopper asked for a new estimate.{" "}
                        <span className="font-medium text-foreground">Quoted</span> = estimate
                        sent; awaiting acceptance.{" "}
                        <span className="font-medium text-foreground">AI estimate</span> is
                        available for new requests and customer resends only.
                      </p>
                      {g.activeQueueRequests.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No items in the active queue (nothing pending or awaiting
                          customer for this account).
                        </p>
                      ) : (
                        <FloatingHorizontalScroll viewportClassName="rounded-md border border-border bg-background">
                          <table className="w-full min-w-[52rem] text-left text-xs sm:text-sm">
                            <thead className="border-b border-border bg-muted/50">
                              <tr>
                                <SortableThCompact
                                  columnId="line-kind"
                                  label="Type"
                                  active={lineSortKey === "kind"}
                                  dir={lineSortDir}
                                  onSort={() => cycleLineSort("kind")}
                                />
                                <th className="px-2 py-2 font-medium text-foreground">
                                  Photo
                                </th>
                                <SortableThCompact
                                  columnId="line-product"
                                  label="Product"
                                  active={lineSortKey === "product"}
                                  dir={lineSortDir}
                                  onSort={() => cycleLineSort("product")}
                                />
                                <SortableThCompact
                                  columnId="line-site"
                                  label="Site name"
                                  active={lineSortKey === "site"}
                                  dir={lineSortDir}
                                  onSort={() => cycleLineSort("site")}
                                />
                                <SortableThCompact
                                  columnId="line-url"
                                  label="Product URL"
                                  active={lineSortKey === "url"}
                                  dir={lineSortDir}
                                  onSort={() => cycleLineSort("url")}
                                />
                                <th className="px-2 py-2 font-medium text-foreground">
                                  Quote actions
                                </th>
                                <th className="px-2 py-2 font-medium text-foreground">
                                  Out of stock
                                </th>
                                <th className="px-2 py-2 font-medium text-foreground">
                                  Quote preview
                                </th>
                                <th className="px-2 py-2 font-medium text-foreground">
                                  Audit
                                </th>
                                <SortableThCompact
                                  columnId="line-submitted"
                                  label="Submitted"
                                  active={lineSortKey === "submitted"}
                                  dir={lineSortDir}
                                  onSort={() => cycleLineSort("submitted")}
                                />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {sortActiveQueueRows(
                                g.activeQueueRequests,
                                lineSortKey,
                                lineSortDir
                              ).map((row) => (
                                <ActiveQueueLineTableRow
                                  key={row.request.id}
                                  group={g}
                                  row={row}
                                  snapshotsByRequestId={snapshotsByRequestId}
                                  latestQuotesByRequestId={latestQuotesByRequestId}
                                  returnRequestsByItemRequestId={
                                    returnRequestsByItemRequestId
                                  }
                                  orderContextByRequestId={orderContextByRequestId}
                                  onEditQuote={openEditQuote}
                                  merchantEstimateFees={merchantEstimateFees}
                                />
                              ))}
                            </tbody>
                          </table>
                        </FloatingHorizontalScroll>
                      )}
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          );
        })}
            </table>
          </FloatingHorizontalScroll>
        ) : (
          <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border">
            <table className="w-full min-w-[72rem] text-left text-xs sm:text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-foreground">
                    Account
                  </th>
                  <th className="max-w-[14rem] px-3 py-2.5 text-left text-xs font-medium text-foreground">
                    Email
                  </th>
                  <SortableThCompact
                    columnId="flat-line-kind"
                    label="Type"
                    active={lineSortKey === "kind"}
                    dir={lineSortDir}
                    onSort={() => cycleLineSort("kind")}
                  />
                  <th className="px-2 py-2.5 text-left text-xs font-medium text-foreground">
                    Photo
                  </th>
                  <SortableThCompact
                    columnId="flat-line-product"
                    label="Product"
                    active={lineSortKey === "product"}
                    dir={lineSortDir}
                    onSort={() => cycleLineSort("product")}
                  />
                  <SortableThCompact
                    columnId="flat-line-site"
                    label="Site name"
                    active={lineSortKey === "site"}
                    dir={lineSortDir}
                    onSort={() => cycleLineSort("site")}
                  />
                  <SortableThCompact
                    columnId="flat-line-url"
                    label="Product URL"
                    active={lineSortKey === "url"}
                    dir={lineSortDir}
                    onSort={() => cycleLineSort("url")}
                  />
                  <th className="px-2 py-2.5 text-left text-xs font-medium text-foreground">
                    Quote actions
                  </th>
                  <th className="px-2 py-2.5 text-left text-xs font-medium text-foreground">
                    Out of stock
                  </th>
                  <th className="px-2 py-2.5 text-left text-xs font-medium text-foreground">
                    Quote preview
                  </th>
                  <th className="px-2 py-2.5 text-left text-xs font-medium text-foreground">
                    Audit
                  </th>
                  <SortableThCompact
                    columnId="flat-line-submitted"
                    label="Submitted"
                    active={lineSortKey === "submitted"}
                    dir={lineSortDir}
                    onSort={() => cycleLineSort("submitted")}
                  />
                </tr>
              </thead>
              {linePageSlice.length === 0 ? (
                <tbody>
                  <tr>
                    <td
                      colSpan={ACTIVE_QUEUE_FLAT_COL_SPAN}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      <p>No queue lines match the current search.</p>
                      {search.trim() ? (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="mt-2 h-auto px-0"
                          onClick={() => setSearch("")}
                        >
                          Clear search
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody className="divide-y divide-border">
                  {linePageSlice.map(({ group: g, row }) => (
                    <ActiveQueueLineTableRow
                      key={row.request.id}
                      group={g}
                      row={row}
                      showAccountColumns
                      snapshotsByRequestId={snapshotsByRequestId}
                      latestQuotesByRequestId={latestQuotesByRequestId}
                      returnRequestsByItemRequestId={returnRequestsByItemRequestId}
                      orderContextByRequestId={orderContextByRequestId}
                      onEditQuote={openEditQuote}
                      merchantEstimateFees={merchantEstimateFees}
                    />
                  ))}
                </tbody>
              )}
            </table>
          </FloatingHorizontalScroll>
        )}

          {itemCount > 0 ? (
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
          ) : null}
        </>
      ) : null}

      <AdminQuoteHistoryEditDialog
        open={editQuoteOpen && Boolean(editQuoteLine)}
        onOpenChange={(next) => {
          setEditQuoteOpen(next);
          if (!next) setEditQuoteLine(null);
        }}
        line={editQuoteLine}
        merchantEstimateFees={merchantEstimateFees}
      />
    </div>
  );
}
