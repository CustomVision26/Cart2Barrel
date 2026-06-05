"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { createCustomerBatchQuoteAction } from "@/actions/customer-batch-quote";
import { withdrawCustomerProductRequestsAction } from "@/actions/withdraw-customer-product-requests";
import { AcceptQuoteButton } from "@/components/dashboard/accept-quote-button";
import { useAddItemPayload } from "@/components/dashboard/add-item-payload-context";
import { CartLineUrlOrReceipt } from "@/components/dashboard/cart-line-url-or-receipt";
import { OutsidePurchaseReturnPreviewDialog } from "@/components/dashboard/outside-purchase-return-preview-dialog";
import { OutsidePurchaseMissingItemPreviewDialog } from "@/components/dashboard/outside-purchase-missing-item-preview-dialog";
import { OutsidePurchaseCancelReturnButton } from "@/components/dashboard/outside-purchase-cancel-return-button";
import { OutsidePurchaseReturnRequestDialog } from "@/components/dashboard/outside-purchase-return-request-dialog";
import { CollapsibleFieldSection } from "@/components/ui/collapsible-field-section";
import { HelpBalloon } from "@/components/ui/help-balloon";
import { ItemsNewProductHistoryPanel } from "@/components/dashboard/items-new-product-history-panel";
import { useBatchQuoteSelection } from "@/components/dashboard/batch-quote-selection-context";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { OutOfStockProductPreviewDialog } from "@/components/dashboard/out-of-stock-product-preview-dialog";
import { QuoteEstimatePreviewDialog } from "@/components/quote-estimate-preview-dialog";
import { SortableThCompact } from "@/components/sortable-th";
import {
  dashItemsTableCellNote,
  dashItemsTableCellNoteDashed,
  dashItemsTableHeadPlain,
  dashItemsTableRowBatchSelected,
  dashItemsTableRowInBatch,
  dashItemsTableScroll,
  dashItemsTableToolbar,
} from "@/lib/app-table-surfaces";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemRequest, OutsidePurchaseReturnRequest } from "@/db/schema";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
import { validateQuotedFullSiteSelection } from "@/lib/batch-quote-validation";
import { canonicalBatchSiteKey } from "@/lib/batch-site-key";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { DASHBOARD_REQUESTED_ITEMS_ROUTE } from "@/lib/dashboard-items-routes";
import {
  itemRequestStatusBadgeKindForDisplay,
  itemRequestStatusLabel,
  itemRequestStatusLabelForDisplay,
} from "@/lib/item-request-status-label";
import {
  isOutsidePurchaseMissingItem,
  isOutsidePurchaseProblemReceiptCondition,
  outsidePurchaseAllowsAcceptQuote,
  outsidePurchaseShowsCancelReturnAction,
  outsidePurchaseShowsPreviewEstimateInReturnWorkflow,
  outsidePurchaseShowsPreviewEstimateInTable,
  outsidePurchaseShowsReturnPreviewAction,
  outsidePurchaseShowsReturnToRetailerAction,
} from "@/lib/outside-purchase-display";
import { isOutsidePurchaseRequest, outsidePurchaseReferenceDisplay } from "@/lib/outside-purchase";
import { displayProductSiteName, displaySiteName } from "@/lib/site-name";
import { itemRequestWorkflowBadgeKind } from "@/lib/status-badge-map";
import type { SortDir } from "@/lib/table-sort";
import {
  compareLocale,
  compareNum,
  nextSortState,
} from "@/lib/table-sort";
import { cn } from "@/lib/utils";

type RowSortKey = "product" | "site" | "status" | "submitted";

type SiteGroupMeta = {
  key: string;
  label: string;
  rows: ItemRequest[];
};

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function rowMatchesProductsSearch(
  r: ItemRequest,
  query: string,
  returnRequestsByItemRequestId: Record<string, OutsidePurchaseReturnRequest>,
  orderContextByRequestId: Record<string, ItemRequestOrderContext>,
): boolean {
  if (!query) return true;
  const returnReq = returnRequestsByItemRequestId[r.id] ?? null;
  const statusLabel = itemRequestStatusLabelForDisplay(
    r,
    returnReq,
    orderContextByRequestId[r.id],
    "customer",
  );
  const site = displayProductSiteName(r);
  const outsideRef = outsidePurchaseReferenceDisplay(r);
  const haystack = [
    r.id,
    r.productName,
    r.siteName,
    site,
    outsideRef,
    r.productUrl,
    r.status,
    statusLabel,
    r.note,
    r.productSize,
    r.productColor,
    String(r.quantity),
    new Date(r.createdAt).toLocaleString(),
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" \n")
    .toLowerCase();
  return haystack.includes(query);
}

function requestStatusOrder(s: string): number {
  const o: Record<string, number> = {
    pending: 0,
    quoted: 1,
    out_of_stock: 2,
    approved: 3,
    rejected: 4,
    withdrawn: 5,
  };
  return o[s] ?? 99;
}

function sortItemRequests(
  rows: ItemRequest[],
  key: RowSortKey,
  dir: SortDir
): ItemRequest[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (key) {
      case "product":
        return compareLocale(
          a.productName?.trim() || "",
          b.productName?.trim() || "",
          dir
        );
      case "site":
        return compareLocale(
          displayProductSiteName(a),
          displayProductSiteName(b),
          dir
        );
      case "status":
        return compareNum(
          requestStatusOrder(a.status),
          requestStatusOrder(b.status),
          dir
        );
      case "submitted":
        return compareNum(
          new Date(a.createdAt).getTime(),
          new Date(b.createdAt).getTime(),
          dir
        );
      default:
        return 0;
    }
  });
  return copy;
}

type ProductsAvailabilityFilter = "all" | "active" | "in_batch";

type ItemsNewProductsPanelProps = {
  productsSubTab: "active" | "history";
};

export function ItemsNewProductsPanel({ productsSubTab }: ItemsNewProductsPanelProps) {
  const router = useRouter();

  const {
    activeRequests,
    batchBundles,
    returnRequestsByItemRequestId,
    orderContextByRequestId,
  } = useAddItemPayload();
  const { batchSelectedIds, setBatchSelectedIds } = useBatchQuoteSelection();

  const requestIdsInBatchQuotes = useMemo(() => {
    const s = new Set<string>();
    for (const b of batchBundles) {
      for (const req of b.requests) s.add(req.id);
    }
    return s;
  }, [batchBundles]);

  const batchSessionIdsFromBundles = useMemo(() => {
    const s = new Set<string>();
    for (const b of batchBundles) {
      s.add(b.session.id);
    }
    return s;
  }, [batchBundles]);

  const isInBatchQuote = useCallback(
    (r: ItemRequest) => {
      if (requestIdsInBatchQuotes.has(r.id)) return true;
      const sid = r.batchQuoteSessionId;
      return Boolean(sid) && batchSessionIdsFromBundles.has(sid ?? "");
    },
    [requestIdsInBatchQuotes, batchSessionIdsFromBundles],
  );

  const [reqSortKey, setReqSortKey] = useState<RowSortKey>("submitted");
  const [reqSortDir, setReqSortDir] = useState<SortDir>("desc");
  const [addingBatch, startAddBatch] = useTransition();
  const [removingRequests, startRemoveRequests] = useTransition();

  const [productsSearch, setProductsSearch] = useState("");
  const [productsAvailabilityFilter, setProductsAvailabilityFilter] =
    useState<ProductsAvailabilityFilter>("all");
  const [productsPage, setProductsPage] = useState(1);
  const [productsPageSize, setProductsPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25);
  const [removeCheckedDialogOpen, setRemoveCheckedDialogOpen] = useState(false);

  const normalizedProductsQuery = productsSearch.trim().toLowerCase();

  const cycleReqSort = useCallback((key: RowSortKey) => {
    const next = nextSortState(reqSortKey, reqSortDir, key);
    setReqSortKey(next.key);
    setReqSortDir(next.dir);
  }, [reqSortKey, reqSortDir]);

  const filteredActive = useMemo(() => {
    let rows = activeRequests;
    if (normalizedProductsQuery) {
      rows = rows.filter((r) =>
        rowMatchesProductsSearch(
          r,
          normalizedProductsQuery,
          returnRequestsByItemRequestId,
          orderContextByRequestId,
        ),
      );
    }
    if (productsAvailabilityFilter === "active") {
      rows = rows.filter((r) => !isInBatchQuote(r));
    } else if (productsAvailabilityFilter === "in_batch") {
      rows = rows.filter((r) => isInBatchQuote(r));
    }
    return rows;
  }, [
    activeRequests,
    normalizedProductsQuery,
    productsAvailabilityFilter,
    isInBatchQuote,
    returnRequestsByItemRequestId,
    orderContextByRequestId,
  ]);

  const sortedActive = useMemo(
    () => sortItemRequests(filteredActive, reqSortKey, reqSortDir),
    [filteredActive, reqSortKey, reqSortDir]
  );

  const productsTotalPages = Math.max(
    1,
    Math.ceil(sortedActive.length / productsPageSize)
  );
  const productsPageSafe = Math.min(productsPage, productsTotalPages);
  const productsSliceStart = (productsPageSafe - 1) * productsPageSize;
  const pagedActive = sortedActive.slice(
    productsSliceStart,
    productsSliceStart + productsPageSize
  );
  const productsRangeEnd =
    sortedActive.length === 0
      ? 0
      : Math.min(
          productsSliceStart + pagedActive.length,
          sortedActive.length
        );

  useEffect(() => {
    setProductsPage((p) => Math.min(p, productsTotalPages));
  }, [productsTotalPages]);

  useEffect(() => {
    setProductsPage(1);
  }, [
    normalizedProductsQuery,
    productsAvailabilityFilter,
    reqSortKey,
    reqSortDir,
    productsPageSize,
  ]);

  const quotedRows = useMemo(
    () =>
      sortedActive.filter(
        (r) => r.status === "quoted" && !isInBatchQuote(r)
      ),
    [sortedActive, isInBatchQuote]
  );

  const quotedSiteGroups = useMemo(() => {
    const map = new Map<string, ItemRequest[]>();
    for (const r of quotedRows) {
      const k = canonicalBatchSiteKey(r.siteName, r.productUrl);
      const list = map.get(k);
      if (list) list.push(r);
      else map.set(k, [r]);
    }
    const list: SiteGroupMeta[] = [];
    for (const [key, rows] of map) {
      rows.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      list.push({
        key,
        label: displaySiteName(rows[0]?.siteName, rows[0]?.productUrl ?? ""),
        rows,
      });
    }
    list.sort((a, b) => a.label.localeCompare(b.label));
    return list;
  }, [quotedRows]);

  const eligibleQuotedSites = useMemo(
    () => quotedSiteGroups.filter((g) => g.rows.length >= 2),
    [quotedSiteGroups]
  );

  const batchSelectionCheck = useMemo(
    () =>
      validateQuotedFullSiteSelection(quotedRows, [...batchSelectedIds]),
    [quotedRows, batchSelectedIds]
  );

  const showBatchSuggestion = eligibleQuotedSites.length > 0;

  const toggleBatchRow = (row: ItemRequest) => {
    if (row.status !== "quoted") return;
    if (isInBatchQuote(row)) return;

    const key = canonicalBatchSiteKey(row.siteName, row.productUrl);

    setBatchSelectedIds((prev) => {
      const next = new Set(prev);
      const had = next.has(row.id);
      if (had) {
        next.delete(row.id);
        return next;
      }

      if (prev.size > 0) {
        const firstId = [...prev][0];
        const firstRow = quotedRows.find((q) => q.id === firstId);
        const firstKey = firstRow
          ? canonicalBatchSiteKey(firstRow.siteName, firstRow.productUrl)
          : "";
        if (firstKey !== key) {
          toast.warning(
            "Batch quotes must stick to one retailer. Clear other selections or uncheck rows from a different site before adding more.",
            {
              duration: 6000,
            }
          );
          return prev;
        }
      }

      next.add(row.id);
      return next;
    });
  };

  const toggleSelectAllQuotedForSiteKey = (
    rows: ItemRequest[],
    checked: boolean
  ) => {
    const ids = rows.map((r) => r.id);

    const key =
      rows[0]
        ? canonicalBatchSiteKey(rows[0].siteName, rows[0].productUrl)
        : "";

    setBatchSelectedIds((prev) => {
      const next = new Set(prev);
      const firstSelected = [...next][0];
      if (
        checked &&
        firstSelected &&
        !ids.includes(firstSelected) &&
        next.size > 0
      ) {
        const firstRow = quotedRows.find((q) => q.id === firstSelected);
        const firstKey = firstRow
          ? canonicalBatchSiteKey(firstRow.siteName, firstRow.productUrl)
          : "";
        if (firstKey !== key) {
          toast.warning(
            "Batch quotes cannot mix retailers. Clear other selections before selecting everything on this site."
          );
          return prev;
        }
      }

      if (checked) {
        ids.forEach((id) => next.add(id));
      } else ids.forEach((id) => next.delete(id));

      return next;
    });
  };

  const onAddBatch = () => {
    if (!batchSelectionCheck.ok || batchSelectionCheck.siteKey === undefined)
      return;
    const ids = [...batchSelectedIds];

    startAddBatch(async () => {
      const res = await createCustomerBatchQuoteAction({ itemRequestIds: ids });
      if (!res.ok) {
        toast.error(res.message ?? "Unable to batch.");
        return;
      }
      toast.success(res.message ?? "Batch created.");
      setBatchSelectedIds(new Set());
      router.push(DASHBOARD_ADD_ITEM_ROUTES.batchQuotesActive);
      router.refresh();
    });
  };

  const siteAllCheckedFor = (rows: ItemRequest[]): boolean =>
    rows.length > 0 && rows.every((r) => batchSelectedIds.has(r.id));

  const removableCheckedIds = useMemo(() => {
    return [...batchSelectedIds].filter((id) => {
      const row = activeRequests.find((r) => r.id === id);
      return row ? !isInBatchQuote(row) : false;
    });
  }, [batchSelectedIds, activeRequests, isInBatchQuote]);

  const removableCheckedCount = removableCheckedIds.length;

  const confirmRemoveCheckedProducts = () => {
    if (removableCheckedIds.length === 0) return;

    startRemoveRequests(async () => {
      const res = await withdrawCustomerProductRequestsAction({
        itemRequestIds: removableCheckedIds,
      });
      if (!res.ok) {
        toast.error(res.message ?? "Could not remove.");
        return;
      }
      toast.success(res.message ?? "Removed.");
      setBatchSelectedIds(new Set());
      setRemoveCheckedDialogOpen(false);
      router.refresh();
    });
  };

  const performRemoveRequest = (id: string) => {
    startRemoveRequests(async () => {
      const res = await withdrawCustomerProductRequestsAction({ itemRequestIds: [id] });
      if (!res.ok) {
        toast.error(res.message ?? "Could not remove.");
        return;
      }
      toast.success(res.message ?? "Removed.");
      router.refresh();
    });
  };

  const subTabLinkClass = (tab: "active" | "history") =>
    cn(
      "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
      productsSubTab === tab
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    );

  return (
    <>
      <div
        role="tablist"
        aria-label="Active product requests and product history"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        <Link
          href={DASHBOARD_ADD_ITEM_ROUTES.productsActive}
          role="tab"
          aria-selected={productsSubTab === "active"}
          className={subTabLinkClass("active")}
          scroll={false}
        >
          Active
        </Link>
        <Link
          href={DASHBOARD_ADD_ITEM_ROUTES.productsHistory}
          role="tab"
          aria-selected={productsSubTab === "history"}
          className={subTabLinkClass("history")}
          scroll={false}
        >
          History
        </Link>
      </div>
      {productsSubTab === "history" ? (
        <ItemsNewProductHistoryPanel />
      ) : null}
      {productsSubTab === "active" ? (
        <>
      <p className="text-sm text-muted-foreground">
        Pending and quoted submissions. Items you accept appear in your cart only.
        Rows that belong to a batch quote are dimmed here — open{" "}
        <Link
          href={DASHBOARD_ADD_ITEM_ROUTES.batchQuotesActive}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          Batch Quotes
        </Link>{" "}
        to preview or accept the bundle. Submit a new request from{" "}
        <Link
          href={DASHBOARD_REQUESTED_ITEMS_ROUTE}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          Requested items
        </Link>
        .
      </p>
      {showBatchSuggestion ? (
        <div
          role="status"
          className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-foreground dark:border-amber-400/25 dark:bg-amber-400/10"
        >
          <p className="font-medium text-foreground">Same-site batch suggestion</p>
          <p className="mt-1 text-muted-foreground">
            You have quoted items from retailers with two or more open lines—check{" "}
            <span className="font-semibold text-foreground">
              two or more quoted products from the same site
            </span>{" "}
            to send a combined quote request. You can create another batch from the same site
            afterward with the remaining lines.
          </p>
        </div>
      ) : null}
      {quotedRows.length > 0 ? (
        <div className="space-y-2">
          {batchSelectedIds.size > 0 ? (
            <div
              role="alert"
              className="flex gap-2.5 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-xs leading-relaxed text-foreground dark:border-destructive/30 dark:bg-destructive/10"
            >
              <TriangleAlertIcon
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden
              />
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-foreground">Remove checked</p>
                <p className="text-muted-foreground">
                  {removableCheckedCount === 0 ?
                    "Checked rows that are in a batch quote cannot be removed here — use Batch Quotes or uncheck them first."
                  : removableCheckedCount === 1 ?
                    "Remove checked moves this product to Product history. You can reinstate it from the History tab later."
                  : `Remove checked moves ${removableCheckedCount} products to Product history. You can reinstate them from the History tab later.`}
                </p>
              </div>
            </div>
          ) : null}
          <div className={dashItemsTableToolbar}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Batch selection
            </span>
            {eligibleQuotedSites.map((site) => {
              const allChecked = siteAllCheckedFor(site.rows);
              return (
                <label
                  key={site.key}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    className="rounded border-input"
                    checked={allChecked}
                    onChange={(e) =>
                      toggleSelectAllQuotedForSiteKey(
                        site.rows,
                        e.target.checked
                      )
                    }
                  />
                  Select all on this site · {site.label} ({site.rows.length})
                </label>
              );
            })}
          </div>
          <div className="flex flex-col items-end gap-2 sm:shrink-0 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  batchSelectedIds.size === 0 ||
                  removableCheckedCount === 0 ||
                  removingRequests ||
                  addingBatch
                }
                className={cn(
                  batchSelectedIds.size > 0 &&
                    "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                )}
                onClick={() => setRemoveCheckedDialogOpen(true)}
              >
                Remove checked
              </Button>
              <HelpBalloon label="What does Remove checked do?">
                Moves all checked products to{" "}
                <span className="font-medium text-foreground">Product history</span> at
                once, so you stop tracking them here. Checked items already in a batch
                quote are skipped — uncheck them or use Batch Quotes. Nothing is deleted;
                you can reinstate items from the History tab anytime.
              </HelpBalloon>
            </div>
            <div className="flex flex-col items-end gap-2">
            {batchSelectedIds.size > 0 ? (
              <p className="max-w-[22rem] text-right text-xs text-muted-foreground">
                Checked products are dimmed and can&apos;t be accepted individually until you
                clear their checkboxes or finish Add Batch.
              </p>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={
                batchSelectedIds.size === 0 || !batchSelectionCheck.ok || addingBatch || removingRequests
              }
              onClick={onAddBatch}
            >
              {addingBatch ? (
                <>
                  <Loader2Icon className="mr-2 size-3.5 animate-spin" aria-hidden />
                  Adding batch…
                </>
              ) : (
                "Add Batch"
              )}
            </Button>
            </div>
          </div>
          </div>
        </div>
      ) : null}
      {batchSelectedIds.size > 0 && !batchSelectionCheck.ok ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {batchSelectionCheck.message}
        </p>
      ) : null}
      {batchSelectedIds.size > 0 && batchSelectionCheck.ok ? (
        <p className="text-xs text-muted-foreground">
          {batchSelectedIds.size}{" "}
          {batchSelectedIds.size === 1 ? "product" : "products"} on this retailer.
          Add Batch to send this group to staff; quoted lines you leave unchecked can form
          another batch from the same site afterward.
        </p>
      ) : null}
      {activeRequests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active requests.{" "}
          <Link
            href={DASHBOARD_REQUESTED_ITEMS_ROUTE}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Submit your first item
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="max-w-md flex-1 space-y-1.5">
              <Label htmlFor="dash-add-item-products-search">Search</Label>
              <div className="relative">
                <SearchIcon
                  aria-hidden
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="dash-add-item-products-search"
                  type="search"
                  placeholder="Product, site, URL, status, notes, date…"
                  value={productsSearch}
                  onChange={(e) => setProductsSearch(e.target.value)}
                  className="pl-8"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dash-add-item-products-availability">
                  Show products
                </Label>
                <select
                  id="dash-add-item-products-availability"
                  value={productsAvailabilityFilter}
                  onChange={(e) =>
                    setProductsAvailabilityFilter(
                      e.target.value as ProductsAvailabilityFilter
                    )
                  }
                  className={cn(
                    "h-8 min-w-[11rem] rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm",
                    "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    "dark:bg-input/30"
                  )}
                >
                  <option value="all">All</option>
                  <option value="active">Active (not in batch)</option>
                  <option value="in_batch">In batch (inactive here)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dash-add-item-products-page-size">
                  Rows per page
                </Label>
                <select
                  id="dash-add-item-products-page-size"
                  value={productsPageSize}
                  onChange={(e) =>
                    setProductsPageSize(
                      Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]
                    )
                  }
                  className={cn(
                    "h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm",
                    "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    "dark:bg-input/30"
                  )}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {filteredActive.length === 0 && activeRequests.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {normalizedProductsQuery
                ? productsAvailabilityFilter === "all"
                  ? "No rows match your search. Clear the search or try different keywords."
                  : "No rows match your search and the current “Show products” filter. Try All, or adjust the search."
                : productsAvailabilityFilter === "active"
                  ? "No products are outside a batch quote. Choose “All” or “In batch”, or manage bundles under Batch Quotes."
                  : "Nothing is in a batch quote yet. Choose “All” or “Active”."}
            </p>
          ) : null}
          {filteredActive.length > 0 ? (
            <>
              <FloatingHorizontalScroll viewportClassName={dashItemsTableScroll}>
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead className={dashItemsTableHeadPlain}>
                    <tr>
                      <th className="w-10 px-2 py-2.5 text-center text-xs font-medium text-foreground">
                        Batch
                      </th>
                      <th className="px-3 py-2.5 font-medium text-foreground">
                        Photo
                      </th>
                      <SortableThCompact
                        columnId="dash-req-product"
                        label="Product"
                        active={reqSortKey === "product"}
                        dir={reqSortDir}
                        onSort={() => cycleReqSort("product")}
                      />
                      <SortableThCompact
                        columnId="dash-req-site"
                        label="Site name"
                        active={reqSortKey === "site"}
                        dir={reqSortDir}
                        onSort={() => cycleReqSort("site")}
                      />
                      <th className="px-3 py-2.5 font-medium text-foreground">
                        Product url
                      </th>
                      <th className="px-3 py-2.5 font-medium text-foreground">
                        Details
                      </th>
                      <SortableThCompact
                        columnId="dash-req-status"
                        label="Status"
                        active={reqSortKey === "status"}
                        dir={reqSortDir}
                        onSort={() => cycleReqSort("status")}
                      />
                      <th className="px-3 py-2.5 font-medium text-foreground">
                        Actions
                      </th>
                      <SortableThCompact
                        columnId="dash-req-submitted"
                        label="Submitted"
                        active={reqSortKey === "submitted"}
                        dir={reqSortDir}
                        onSort={() => cycleReqSort("submitted")}
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pagedActive.map((r) => {
                      const inBatchSelection = batchSelectedIds.has(r.id);
                      const inBundledBatch = isInBatchQuote(r);
                      const isProblemOp =
                        isOutsidePurchaseRequest(r) &&
                        isOutsidePurchaseProblemReceiptCondition(r);
                      const isOpQuoted =
                        isOutsidePurchaseRequest(r) && r.status === "quoted";
                      const returnReqForRow =
                        returnRequestsByItemRequestId[r.id] ?? null;
                      const showTablePreviewEstimate =
                        (r.status === "quoted" &&
                          (outsidePurchaseShowsPreviewEstimateInTable(r) ||
                            outsidePurchaseShowsPreviewEstimateInReturnWorkflow(
                              r,
                              returnReqForRow,
                            ))) ||
                        (r.status !== "quoted" &&
                          r.status !== "pending" &&
                          r.status !== "out_of_stock");
                      return (
                        <tr
                          key={r.id}
                          className={cn(
                            "align-top transition-[background-color,box-shadow,color] duration-150",
                            inBundledBatch && dashItemsTableRowInBatch,
                            inBatchSelection && dashItemsTableRowBatchSelected
                          )}
                          data-batch-selected={
                            inBatchSelection ? "true" : undefined
                          }
                          data-in-batch-quote={inBundledBatch ? "true" : undefined}
                        >
                          <td className="px-2 py-3 text-center align-top">
                            <input
                              type="checkbox"
                              disabled={
                                r.status !== "quoted" || inBundledBatch
                              }
                              checked={inBatchSelection}
                              aria-label={`Select ${r.productName ?? "product"} for batch`}
                              title={
                                inBundledBatch
                                  ? "This product is in a batch quote — use Batch Quotes."
                                  : r.status !== "quoted"
                                    ? "Only quoted items can batch"
                                    : inBatchSelection
                                      ? "Uncheck to use this row as a single-quote line again."
                                      : "Include in retailer batch quote"
                              }
                              onChange={() => toggleBatchRow(r)}
                              className={cn(
                                "rounded border-input",
                                inBatchSelection &&
                                  r.status === "quoted" &&
                                  "border-primary/60 accent-primary"
                              )}
                            />
                          </td>
                          <td className="px-3 py-3 align-top">
                            <ProductRequestThumbnail
                              variant="list"
                              imageUrl={r.productImageUrl}
                              productLabel={r.productName}
                              className={cn(
                                inBatchSelection && "opacity-65 saturate-50"
                              )}
                            />
                          </td>
                          <td
                            className={cn(
                              "max-w-[10rem] px-3 py-3 align-top font-medium text-foreground",
                              inBatchSelection && "text-muted-foreground"
                            )}
                          >
                            <span className="line-clamp-2">
                              {r.productName?.trim() || "Unnamed product"}
                            </span>
                            {outsidePurchaseReferenceDisplay(r) ? (
                              <span className="mt-1 block font-mono text-[10px] text-primary">
                                {outsidePurchaseReferenceDisplay(r)}
                              </span>
                            ) : null}
                            {inBundledBatch ? (
                              <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                In batch quote — use Batch Quotes tab
                              </span>
                            ) : null}
                            {!inBundledBatch && inBatchSelection ? (
                              <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-primary/90">
                                In batch selection
                              </span>
                            ) : null}
                          </td>
                          <td
                            className={cn(
                              "max-w-[8rem] px-3 py-3 align-top text-muted-foreground",
                              inBatchSelection && "opacity-90"
                            )}
                          >
                            <span className="line-clamp-2 text-xs sm:text-sm">
                              {displayProductSiteName(r)}
                            </span>
                          </td>
                          <td
                            className={cn(
                              "whitespace-nowrap px-3 py-3 align-top",
                              inBatchSelection && "opacity-60"
                            )}
                          >
                            {isOutsidePurchaseRequest(r) ?
                              <CartLineUrlOrReceipt
                                lineId={r.id}
                                productUrl={r.productUrl}
                                outsidePurchaseReceiptImageUrl={
                                  r.outsidePurchaseReceiptImageUrl
                                }
                              />
                            : <a
                                href={r.productUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={r.productUrl}
                                aria-label={`Open product url: ${r.productUrl}`}
                                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                              >
                                Product url
                              </a>
                            }
                          </td>
                          <td
                            className={cn(
                              "max-w-[12rem] px-3 py-3 align-top text-xs text-muted-foreground",
                              inBatchSelection && "opacity-90"
                            )}
                          >
                            Qty {r.quantity}
                            {r.productSize?.trim()
                              ? ` · Size ${r.productSize.trim()}`
                              : ""}
                            {r.productColor?.trim()
                              ? ` · Color ${r.productColor.trim()}`
                              : ""}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 align-top">
                            {(() => {
                              const returnReq =
                                returnRequestsByItemRequestId[r.id] ?? null;
                              const orderContext = orderContextByRequestId[r.id];
                              const badgeKind = isOutsidePurchaseRequest(r) ?
                                itemRequestStatusBadgeKindForDisplay(
                                  r,
                                  returnReq,
                                  orderContext,
                                  "customer",
                                )
                              : itemRequestWorkflowBadgeKind(r.status);
                              return (
                                <StatusBadge kind={badgeKind} title={r.status}>
                                  {itemRequestStatusLabelForDisplay(
                                    r,
                                    returnReq,
                                    orderContext,
                                    "customer",
                                  )}
                                </StatusBadge>
                              );
                            })()}
                          </td>
                          <td
                            className={cn(
                              "space-y-2 px-3 py-3 align-top",
                              inBatchSelection && "opacity-90"
                            )}
                          >
                            {r.status === "quoted" ?
                              (() => {
                                const returnReq =
                                  returnRequestsByItemRequestId[r.id] ?? null;
                                const showReturnRequest =
                                  outsidePurchaseShowsReturnToRetailerAction(
                                    r,
                                    returnReq,
                                  );
                                const showReturnPreview =
                                  outsidePurchaseShowsReturnPreviewAction(
                                    r,
                                    returnReq,
                                  );
                                const showCancelReturn =
                                  outsidePurchaseShowsCancelReturnAction(r, returnReq);
                                const showReturnActions =
                                  showReturnRequest ||
                                  showReturnPreview ||
                                  showCancelReturn;
                                const showAccept =
                                  !inBundledBatch &&
                                  !inBatchSelection &&
                                  (outsidePurchaseAllowsAcceptQuote(r, returnReq) ||
                                    !isOutsidePurchaseRequest(r));
                                const returnEstimateAccepted =
                                  returnReq?.status === "estimate_accepted";

                                if (inBundledBatch) {
                                  return (
                                    <p
                                      className={dashItemsTableCellNote}
                                      title="Open Batch Quotes to accept or preview this bundle."
                                    >
                                      Manage in{" "}
                                      <span className="font-medium text-foreground">
                                        Batch Quotes
                                      </span>
                                    </p>
                                  );
                                }
                                if (inBatchSelection) {
                                  return (
                                    <p
                                      className={dashItemsTableCellNoteDashed}
                                      title="Uncheck Batch to accept this estimate on its own."
                                    >
                                      Accept estimate disabled while selected for a
                                      batch.
                                    </p>
                                  );
                                }
                                if (isOutsidePurchaseMissingItem(r)) {
                                  return (
                                    <OutsidePurchaseMissingItemPreviewDialog
                                      request={r}
                                    />
                                  );
                                }
                                if (isOpQuoted) {
                                  return (
                                    <CollapsibleFieldSection
                                      compact
                                      title="Actions"
                                      description={
                                        returnEstimateAccepted ?
                                          "Accept estimate, preview, or cancel return"
                                        : showReturnRequest ?
                                          "Return, preview, and accept"
                                        : showReturnPreview ?
                                          "Preview return while estimate is prepared"
                                        : "Preview and accept service estimate"
                                      }
                                      defaultOpen={
                                        showReturnActions || returnEstimateAccepted
                                      }
                                      className="min-w-[11.5rem] bg-card"
                                    >
                                      <div className="flex flex-col gap-2">
                                        {showReturnRequest ?
                                          <OutsidePurchaseReturnRequestDialog
                                            itemRequestId={r.id}
                                            productLabel={
                                              r.productName?.trim() || undefined
                                            }
                                            warning={isOutsidePurchaseProblemReceiptCondition(
                                              r,
                                            )}
                                          />
                                        : null}
                                        {showReturnPreview ?
                                          <OutsidePurchaseReturnPreviewDialog
                                            request={r}
                                            returnRequest={returnReq}
                                          />
                                        : null}
                                        {showAccept ?
                                          <AcceptQuoteButton itemRequestId={r.id} />
                                        : null}
                                        {showTablePreviewEstimate ?
                                          inBundledBatch ?
                                            <p className="text-center text-[11px] text-muted-foreground">
                                              Preview via Batch Quotes
                                            </p>
                                          : <QuoteEstimatePreviewDialog
                                              itemRequestId={r.id}
                                              label="Preview estimate"
                                            />
                                        : null}
                                        {showCancelReturn ?
                                          <OutsidePurchaseCancelReturnButton
                                            itemRequestId={r.id}
                                            productLabel={
                                              r.productName?.trim() || undefined
                                            }
                                          />
                                        : null}
                                      </div>
                                    </CollapsibleFieldSection>
                                  );
                                }

                                return showAccept ?
                                    <AcceptQuoteButton itemRequestId={r.id} />
                                  : null;
                              })()
                            : null}
                            {r.status === "pending" ? (
                              <div className="flex items-center gap-1.5">
                              <AlertDialog>
                                <AlertDialogTrigger
                                  render={
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={removingRequests || inBundledBatch}
                                      title={
                                        inBundledBatch
                                          ? "This line is part of a batch quote."
                                          : undefined
                                      }
                                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    />
                                  }
                                >
                                  Remove request
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Remove this pending request?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      You will not receive a quote for it. This moves
                                      the product to Product history, and you can
                                      reinstate it from the History tab later.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel
                                      render={
                                        <Button type="button" variant="outline" />
                                      }
                                    >
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      render={
                                        <Button
                                          type="button"
                                          variant="destructive"
                                        />
                                      }
                                      onClick={() => performRemoveRequest(r.id)}
                                    >
                                      Remove request
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              <HelpBalloon
                                label="What does Remove request do?"
                                tooltipClassName="right-0 left-auto translate-x-0"
                              >
                                Cancels this pending request so it won&apos;t be quoted,
                                and moves the product to{" "}
                                <span className="font-medium text-foreground">
                                  Product history
                                </span>
                                . Nothing is deleted — you can reinstate it from the
                                History tab later.
                              </HelpBalloon>
                              </div>
                            ) : null}
                            {r.status === "out_of_stock" ? (
                              <>
                                <OutOfStockProductPreviewDialog request={r} />
                                <AlertDialog>
                                  <AlertDialogTrigger
                                    render={
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={removingRequests}
                                        className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                      />
                                    }
                                  >
                                    Remove from product record
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Remove this out-of-stock product?
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        It will move to Product history. You can
                                        reinstate it from the History tab later.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel
                                        render={
                                          <Button type="button" variant="outline" />
                                        }
                                      >
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        render={
                                          <Button
                                            type="button"
                                            variant="destructive"
                                          />
                                        }
                                        onClick={() => performRemoveRequest(r.id)}
                                      >
                                        Remove product
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            ) : showTablePreviewEstimate && !isOpQuoted ? (
                            <div
                              className={cn(inBatchSelection && "opacity-80")}
                              title={
                                inBundledBatch
                                  ? "Use Batch Quotes to preview the bundle."
                                  : inBatchSelection
                                    ? "Preview still available while you build your batch."
                                    : undefined
                              }
                            >
                              {inBundledBatch ? (
                                <p className="text-center text-[11px] text-muted-foreground">
                                  Preview via Batch Quotes
                                </p>
                              ) : (
                                <QuoteEstimatePreviewDialog
                                  itemRequestId={r.id}
                                  label="Preview estimate"
                                />
                              )}
                            </div>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-muted-foreground">
                            <time dateTime={r.createdAt}>
                              {new Date(r.createdAt).toLocaleString()}
                            </time>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </FloatingHorizontalScroll>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {`Showing ${productsSliceStart + 1}–${productsRangeEnd} of ${sortedActive.length}`}
                  {activeRequests.length !== sortedActive.length ? (
                    <span className="text-muted-foreground/80">
                      {" "}
                      ({activeRequests.length} total)
                    </span>
                  ) : null}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={productsPageSafe <= 1}
                    onClick={() =>
                      setProductsPage(Math.max(1, productsPageSafe - 1))
                    }
                    aria-label="Previous page"
                  >
                    <ChevronLeftIcon className="size-4" />
                    Previous
                  </Button>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    Page {productsPageSafe} of {productsTotalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={productsPageSafe >= productsTotalPages}
                    onClick={() =>
                      setProductsPage(
                        Math.min(productsTotalPages, productsPageSafe + 1)
                      )
                    }
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
        </>
      ) : null}

      <Dialog
        open={removeCheckedDialogOpen}
        onOpenChange={(open) => {
          if (!removingRequests) setRemoveCheckedDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!removingRequests}>
          <DialogHeader>
            <DialogTitle>
              {removableCheckedCount === 1 ?
                "Remove this product from Active?"
              : `Remove ${removableCheckedCount} products from Active?`}
            </DialogTitle>
            <DialogDescription>
              {removableCheckedCount === 1 ?
                "This moves the checked product to Product history. Staff can still see the record. You can reinstate it from the History tab later."
              : `This moves ${removableCheckedCount} checked products to Product history. Staff can still see the records. You can reinstate them from the History tab later.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={removingRequests}
              onClick={() => setRemoveCheckedDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={removingRequests}
              onClick={confirmRemoveCheckedProducts}
            >
              {removingRequests ? (
                <>
                  <Loader2Icon className="mr-2 size-3.5 animate-spin" aria-hidden />
                  Removing…
                </>
              ) : removableCheckedCount === 1 ?
                "Remove product"
              : "Remove products"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
