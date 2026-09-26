"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  SearchIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { createCustomerBatchQuoteAction } from "@/actions/customer-batch-quote";
import { withdrawCustomerProductRequestsAction } from "@/actions/withdraw-customer-product-requests";
import { AcceptQuoteButton } from "@/components/dashboard/accept-quote-button";
import { useAddItemPayload } from "@/components/dashboard/add-item-payload-context";
import { MerchandiseTopupAddonTableRows } from "@/components/dashboard/merchandise-topup-addon-table-rows";
import { CartLineUrlOrReceipt } from "@/components/dashboard/cart-line-url-or-receipt";
import { OutsidePurchaseReturnPreviewDialog } from "@/components/dashboard/outside-purchase-return-preview-dialog";
import { OutsidePurchaseMissingItemPreviewDialog } from "@/components/dashboard/outside-purchase-missing-item-preview-dialog";
import { OutsidePurchaseCancelReturnButton } from "@/components/dashboard/outside-purchase-cancel-return-button";
import { OutsidePurchaseReturnRequestDialog } from "@/components/dashboard/outside-purchase-return-request-dialog";
import { CollapsibleFieldSection } from "@/components/ui/collapsible-field-section";
import { HelpBalloon } from "@/components/ui/help-balloon";
import { ItemsNewProductHistoryPanel } from "@/components/dashboard/items-new-product-history-panel";
import { ItemsNewExpiredQuotesPanel } from "@/components/dashboard/items-new-expired-quotes-panel";
import { useBatchQuoteSelection } from "@/components/dashboard/batch-quote-selection-context";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { OutOfStockProductPreviewDialog } from "@/components/dashboard/out-of-stock-product-preview-dialog";
import { QuoteEstimatePreviewDialog } from "@/components/quote-estimate-preview-dialog";
import { SortableThCompact } from "@/components/sortable-th";
import {
  appTableStickyActionsCell,
  appTableStickyActionsHead,
  dashItemsTableCellNote,
  dashItemsTableCellNoteDashed,
  dashItemsTableHeadPlain,
  dashItemsTableRowBatchSelected,
  dashItemsTableRowInBatch,
  dashItemsTableFilterPanel,
  dashItemsTableScroll,
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
import type {
  ItemRequest,
  ItemRequestLineSnapshot,
  OutsidePurchaseReturnRequest,
} from "@/db/schema";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
import { validateQuotedFullSiteSelection } from "@/lib/batch-quote-validation";
import { canonicalBatchSiteKey } from "@/lib/batch-site-key";
import {
  DASHBOARD_ADD_ITEM_ROUTES,
  dashboardBatchQuotesActiveCreatedHref,
} from "@/lib/dashboard-add-item-routes";
import { DASHBOARD_REQUESTED_ITEMS_ROUTE } from "@/lib/dashboard-items-routes";
import {
  itemRequestStatusBadgeKindForDisplay,
  itemRequestStatusLabel,
  itemRequestStatusLabelForDisplay,
} from "@/lib/item-request-status-label";
import {
  effectiveQuoteExpiryMinutes,
  formatItemRequestProductNumber,
  formatQuoteExpiryWindowLabel,
  getLatestOperationalQuoteIssuedAt,
  isNeverExpireMinutes,
  resolveQuoteExpiryClockStart,
} from "@/lib/quote-expiry";
import { QuoteExpiryCountdownLabel } from "@/components/dashboard/quote-expiry-countdown-label";
import {
  isOutsidePurchaseMissingItem,
  isOutsidePurchaseProblemReceiptCondition,
  outsidePurchaseAllowsAcceptQuote,
  outsidePurchaseShowsCancelReturnAction,
  outsidePurchaseShowsPreviewEstimateInReturnWorkflow,
  outsidePurchaseShowsPreviewEstimateInTable,
  outsidePurchaseShowsReturnPreviewAction,
  outsidePurchaseShowsReturnToRetailerAction,
  parseOutsidePurchaseReceivedCondition,
} from "@/lib/outside-purchase-display";
import { isOutsidePurchaseRequest, outsidePurchaseReferenceDisplay } from "@/lib/outside-purchase";
import {
  displayProductSiteName,
  displaySiteName,
  retailerLabelFromProductUrl,
} from "@/lib/site-name";
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

/** Outside-purchase lines in an active return workflow use quoted actions even if status is stale. */
function outsidePurchaseUsesQuotedActions(
  request: ItemRequest,
  returnRequest: OutsidePurchaseReturnRequest | null,
): boolean {
  if (!isOutsidePurchaseRequest(request)) {
    return request.status === "quoted";
  }
  if (request.status === "quoted") {
    return true;
  }
  if (request.status !== "pending") {
    return false;
  }
  return (
    returnRequest?.status === "submitted" ||
    returnRequest?.status === "estimate_ready" ||
    returnRequest?.status === "estimate_accepted"
  );
}

function rowMatchesProductsSearch(
  r: ItemRequest,
  query: string,
  returnRequestsByItemRequestId: Record<string, OutsidePurchaseReturnRequest>,
  orderContextByRequestId: Record<string, ItemRequestOrderContext>,
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>,
): boolean {
  if (!query) return true;
  const returnReq = returnRequestsByItemRequestId[r.id] ?? null;
  const statusLabel = itemRequestStatusLabelForDisplay(
    r,
    returnReq,
    orderContextByRequestId[r.id],
    "customer",
    snapshotsByRequestId[r.id],
  );
  const site = displayProductSiteName(r);
  const outsideRef = outsidePurchaseReferenceDisplay(r);
  const haystack = [
    r.id,
    formatItemRequestProductNumber(r),
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
  productsSubTab: "active" | "history" | "expired";
};

export function ItemsNewProductsPanel({ productsSubTab }: ItemsNewProductsPanelProps) {
  const router = useRouter();

  const {
    activeRequests,
    batchBundles,
    returnRequestsByItemRequestId,
    orderContextByRequestId,
    snapshotsByRequestId,
    quotesByRequestId,
    quoteExpiryMinutes,
    expiredQuotedRequests,
    merchandiseTopupAddOnCharges,
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

  const filteredTopupCharges = useMemo(() => {
    if (!normalizedProductsQuery) return merchandiseTopupAddOnCharges;
    return merchandiseTopupAddOnCharges.filter((charge) => {
      const haystack = [
        charge.productName,
        ...charge.productNames,
        charge.productNumber,
        charge.batchNumber ?? "",
        charge.topupNumber,
        ...charge.lines.map((l) => l.productNumber),
        charge.siteLabel ?? "",
        charge.productUrl ?? "",
        "top-up",
        "topup",
        "add-on",
        "addon",
        "batch",
        charge.inCart ? "in cart" : "top-up due",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedProductsQuery);
    });
  }, [merchandiseTopupAddOnCharges, normalizedProductsQuery]);

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
          snapshotsByRequestId,
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
      activeRequests.filter(
        (r) =>
          r.status === "quoted" &&
          !isInBatchQuote(r) &&
          // Outside-purchase products are billed for service only and cannot
          // be combined into a same-retailer batch quote.
          !isOutsidePurchaseRequest(r)
      ),
    [activeRequests, isInBatchQuote]
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
      const productUrl = rows[0]?.productUrl ?? "";
      list.push({
        key,
        label:
          retailerLabelFromProductUrl(productUrl) ||
          displaySiteName(rows[0]?.siteName, productUrl),
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

  const toggleBatchRow = (row: ItemRequest) => {
    if (row.status !== "quoted") return;
    if (isInBatchQuote(row)) return;
    if (isOutsidePurchaseRequest(row)) return;

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
      try {
        const res = await createCustomerBatchQuoteAction({ itemRequestIds: ids });
        if (!res.ok) {
          toast.error(res.message ?? "Unable to batch.");
          return;
        }
        toast.success(res.message ?? "Batch created.");
        setBatchSelectedIds(new Set());
        router.push(
          res.batchSessionId
            ? dashboardBatchQuotesActiveCreatedHref(res.batchSessionId)
            : DASHBOARD_ADD_ITEM_ROUTES.batchQuotesActive,
        );
      } catch {
        toast.error(
          "The page did not update. Open Batch Quotes to continue if the batch was added.",
        );
        router.push(DASHBOARD_ADD_ITEM_ROUTES.batchQuotesActive);
      }
    });
  };

  const canAddBatch =
    batchSelectionCheck.ok && !addingBatch && !removingRequests;

  const addBatchDisabledReason = addingBatch
    ? "Creating the batch…"
    : removingRequests
      ? "Wait until remove finishes."
      : batchSelectedIds.size === 0
        ? "Select at least two quoted products from the same retailer, then Add Batch."
        : !batchSelectionCheck.ok
          ? batchSelectionCheck.message
          : undefined;

  const siteAllCheckedFor = (rows: ItemRequest[]): boolean =>
    rows.length > 0 && rows.every((r) => batchSelectedIds.has(r.id));

  const siteSomeCheckedFor = (rows: ItemRequest[]): boolean =>
    rows.some((r) => batchSelectedIds.has(r.id)) && !siteAllCheckedFor(rows);

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

  const subTabLinkClass = (tab: "active" | "history" | "expired") =>
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
        aria-label="Active product requests, expired quotes, and product history"
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
        <Link
          href={DASHBOARD_ADD_ITEM_ROUTES.productsExpiredQuotes}
          role="tab"
          aria-selected={productsSubTab === "expired"}
          className={subTabLinkClass("expired")}
          scroll={false}
        >
          Expired Quotes
          {expiredQuotedRequests.length > 0 ?
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {expiredQuotedRequests.length}
            </span>
          : null}
        </Link>
      </div>
      {productsSubTab === "history" ? (
        <ItemsNewProductHistoryPanel />
      ) : null}
      {productsSubTab === "expired" ? (
        <ItemsNewExpiredQuotesPanel />
      ) : null}
      {productsSubTab === "active" ? (
        <>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-foreground">Active products</p>
        <HelpBalloon
          label="About Active products"
          tooltipClassName="left-0 w-[min(22rem,calc(100vw-2rem))] -translate-x-0 sm:w-96"
        >
          Pending and quoted submissions. Purchase-price top-ups appear in this
          table as add-on rows (Top-up due) — add them to cart from Actions.
          {isNeverExpireMinutes(quoteExpiryMinutes) ?
            <>
              {" "}
              Quoted estimates{" "}
              <span className="font-medium text-foreground">do not expire</span>{" "}
              until staff change Quote Expiry Settings.
            </>
          : <>
              {" "}
              Because retailer prices can change quickly, each quoted estimate
              stays valid for{" "}
              <span className="font-medium text-foreground">
                {formatQuoteExpiryWindowLabel(quoteExpiryMinutes)}
              </span>{" "}
              (see Quote Expiry Settings). Accept and pay within that window to
              keep the locked price; after it expires the product moves to
              Expired Quotes so you can resubmit for a fresh estimate.
            </>
          }{" "}
          Items you accept appear in
          your cart only. Rows that belong to a batch quote are dimmed here —
          open Batch Quotes to preview or accept the bundle. Submit a new request
          from Requested items.
        </HelpBalloon>
      </div>
      {quotedRows.length > 0 ? (
        <section
          aria-labelledby="dash-batch-estimate-heading"
          className={cn(dashItemsTableFilterPanel, "space-y-4")}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <h2
                  id="dash-batch-estimate-heading"
                  className="text-sm font-semibold tracking-tight text-foreground"
                >
                  Batch estimate
                </h2>
                <HelpBalloon
                  label="About batch estimates"
                  tooltipClassName="w-80"
                >
                  Select two or more quoted products from one retailer in the
                  Batch column, then choose Add batch. Retailer shortcuts select
                  every quoted line from that store. Remaining products from the
                  same retailer may be submitted as a later batch. Remove moves
                  selected products to Product history; they can be reinstated
                  from the History tab.
                </HelpBalloon>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Combine quoted products from one retailer into a single staff
                estimate, or select individual lines in the table.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
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
                title={
                  removableCheckedCount === 0 && batchSelectedIds.size > 0
                    ? "Checked products in a batch quote cannot be removed here."
                    : "Move selected products to Product history."
                }
                onClick={() => setRemoveCheckedDialogOpen(true)}
              >
                Remove
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canAddBatch}
                title={addBatchDisabledReason}
                onClick={onAddBatch}
              >
                {addingBatch ?
                  <>
                    <Loader2Icon
                      className="size-3.5 animate-spin"
                      aria-hidden
                    />
                    Adding…
                  </>
                : "Add batch"}
              </Button>
            </div>
          </div>

          {eligibleQuotedSites.length > 0 ?
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Select all from retailer
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border/80 bg-background">
                {eligibleQuotedSites.map((site) => {
                  const allChecked = siteAllCheckedFor(site.rows);
                  const someChecked = siteSomeCheckedFor(site.rows);
                  const count = site.rows.length;
                  const batchSelectLabel = `Select all ${site.label} products for a batch estimate`;
                  return (
                    <li key={site.key}>
                      <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/70">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-input"
                            checked={allChecked}
                            ref={(el) => {
                              if (el) el.indeterminate = someChecked;
                            }}
                            aria-label={`${batchSelectLabel} (${count})`}
                            onChange={(e) =>
                              toggleSelectAllQuotedForSiteKey(
                                site.rows,
                                e.target.checked,
                              )
                            }
                          />
                          <span className="truncate font-medium text-foreground">
                            {site.label}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                          {count} {count === 1 ? "product" : "products"}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          : null}

          <p
            className={cn(
              "text-xs leading-relaxed",
              batchSelectedIds.size > 0 && !batchSelectionCheck.ok
                ? "text-amber-700 dark:text-amber-400"
                : "text-muted-foreground",
            )}
          >
            {batchSelectedIds.size === 0 ?
              "No products selected. Check two or more quoted lines from the same retailer, then add a batch."
            : !batchSelectionCheck.ok ?
              batchSelectionCheck.message
            : `${batchSelectedIds.size} ${batchSelectedIds.size === 1 ? "product" : "products"} selected for this batch estimate.`}
          </p>
        </section>
      ) : null}
      {activeRequests.length === 0 &&
      merchandiseTopupAddOnCharges.length === 0 ? (
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
          {filteredActive.length === 0 &&
          filteredTopupCharges.length === 0 &&
          (activeRequests.length > 0 ||
            merchandiseTopupAddOnCharges.length > 0) ? (
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
          {filteredActive.length > 0 || filteredTopupCharges.length > 0 ? (
            <>
              <FloatingHorizontalScroll viewportClassName={dashItemsTableScroll}>
                <table className="w-full min-w-[78rem] table-fixed border-separate border-spacing-0 text-left text-sm">
                  <thead className={dashItemsTableHeadPlain}>
                    <tr>
                      <th
                        className="w-12 px-2 py-2.5 text-center text-xs font-medium text-foreground"
                        title="Check quoted products to include in a batch estimate. You may select any two or more from the same retailer."
                      >
                        Batch
                      </th>
                      <th className="w-16 px-3 py-2.5 text-xs font-medium text-foreground">
                        Photo
                      </th>
                      <th className="w-[6.5rem] px-3 py-2.5 text-xs font-medium text-foreground">
                        Product #
                      </th>
                      <SortableThCompact
                        columnId="dash-req-product"
                        label="Product"
                        active={reqSortKey === "product"}
                        dir={reqSortDir}
                        onSort={() => cycleReqSort("product")}
                        className="w-[12rem]"
                      />
                      <SortableThCompact
                        columnId="dash-req-site"
                        label="Site"
                        active={reqSortKey === "site"}
                        dir={reqSortDir}
                        onSort={() => cycleReqSort("site")}
                        className="w-[7.5rem]"
                      />
                      <th className="w-[6.5rem] px-3 py-2.5 text-xs font-medium text-foreground">
                        URL
                      </th>
                      <th className="w-[7rem] px-3 py-2.5 text-xs font-medium text-foreground">
                        Details
                      </th>
                      <SortableThCompact
                        columnId="dash-req-status"
                        label="Status"
                        active={reqSortKey === "status"}
                        dir={reqSortDir}
                        onSort={() => cycleReqSort("status")}
                        className="w-[7.5rem]"
                      />
                      <th
                        className="w-[9.5rem] px-3 py-2.5 text-xs font-medium text-foreground"
                        title="Quoted prices expire because retailer listings change; pay within this window to keep the locked estimate."
                      >
                        Quote expiry
                      </th>
                      <SortableThCompact
                        columnId="dash-req-submitted"
                        label="Submitted"
                        active={reqSortKey === "submitted"}
                        dir={reqSortDir}
                        onSort={() => cycleReqSort("submitted")}
                        className="w-[7.5rem]"
                      />
                      <th className={appTableStickyActionsHead}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <MerchandiseTopupAddonTableRows
                      charges={filteredTopupCharges}
                    />
                    {pagedActive.map((r) => {
                      const inBatchSelection = batchSelectedIds.has(r.id);
                      const inBundledBatch = isInBatchQuote(r);
                      const isProblemOp =
                        isOutsidePurchaseRequest(r) &&
                        isOutsidePurchaseProblemReceiptCondition(r);
                      const returnReqForRow =
                        returnRequestsByItemRequestId[r.id] ?? null;
                      const isOpQuoted = outsidePurchaseUsesQuotedActions(
                        r,
                        returnReqForRow,
                      );
                      const showTablePreviewEstimate =
                        (isOpQuoted &&
                          (outsidePurchaseShowsPreviewEstimateInTable(
                            r,
                            returnReqForRow,
                          ) ||
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
                                r.status !== "quoted" ||
                                inBundledBatch ||
                                isOutsidePurchaseRequest(r)
                              }
                              checked={inBatchSelection}
                              aria-label={`Select ${r.productName ?? "product"} for batch`}
                              title={
                                isOutsidePurchaseRequest(r)
                                  ? "Outside purchase products can't be added to a batch quote."
                                  : inBundledBatch
                                    ? "This product is in a batch quote — use Batch Quotes."
                                    : r.status !== "quoted"
                                      ? "Only quoted items can batch"
                                      : inBatchSelection
                                        ? "Uncheck to leave this product out of the batch estimate."
                                        : "Select this product for a batch estimate with other items from the same retailer."
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
                              "px-3 py-3 align-top font-mono text-xs text-foreground",
                              inBatchSelection && "text-muted-foreground",
                            )}
                            title={formatItemRequestProductNumber(r)}
                          >
                            {formatItemRequestProductNumber(r)}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-3 align-top font-medium text-foreground",
                              inBatchSelection && "text-muted-foreground"
                            )}
                          >
                            <span className="line-clamp-2 break-words">
                              {r.productName?.trim() || "Unnamed product"}
                            </span>
                            {inBundledBatch ? (
                              <span className="mt-1.5 inline-flex rounded border border-border/70 bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                In batch quote
                              </span>
                            ) : null}
                            {!inBundledBatch && inBatchSelection ? (
                              <span className="mt-1.5 inline-flex rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                                Batch selected
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
                              const rowSnapshots = snapshotsByRequestId[r.id];
                              const badgeKind = isOutsidePurchaseRequest(r) ?
                                itemRequestStatusBadgeKindForDisplay(
                                  r,
                                  returnReq,
                                  orderContext,
                                  "customer",
                                  rowSnapshots,
                                )
                              : itemRequestWorkflowBadgeKind(r.status);
                              return (
                                <StatusBadge kind={badgeKind} title={r.status}>
                                  {itemRequestStatusLabelForDisplay(
                                    r,
                                    returnReq,
                                    orderContext,
                                    "customer",
                                    rowSnapshots,
                                  )}
                                </StatusBadge>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-3 align-top">
                            {r.status === "quoted" ?
                              (() => {
                                const issuedAt = getLatestOperationalQuoteIssuedAt(
                                  quotesByRequestId[r.id] ?? [],
                                );
                                const clockStart = resolveQuoteExpiryClockStart({
                                  quoteIssuedAt: issuedAt,
                                  productOverrideMinutes:
                                    r.quoteExpiryMinutesOverride,
                                  productOverrideAnchoredAt:
                                    r.quoteExpiryOverrideAnchoredAt,
                                });
                                if (!clockStart) {
                                  return (
                                    <span
                                      className="text-muted-foreground/70"
                                      title="Waiting for staff quote timestamp"
                                    >
                                      —
                                    </span>
                                  );
                                }
                                return (
                                  <QuoteExpiryCountdownLabel
                                    quotedAt={clockStart}
                                    expiryMinutes={
                                      effectiveQuoteExpiryMinutes(
                                        quoteExpiryMinutes,
                                        r.quoteExpiryMinutesOverride,
                                      ).expiryMinutes
                                    }
                                  />
                                );
                              })()
                            : (
                              <span className="text-xs text-muted-foreground/70">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-muted-foreground">
                            <time dateTime={r.createdAt}>
                              {new Date(r.createdAt).toLocaleString()}
                            </time>
                          </td>
                          <td
                            className={cn(
                              appTableStickyActionsCell,
                              inBatchSelection && "bg-accent opacity-90",
                              inBundledBatch && !inBatchSelection && "bg-secondary",
                            )}
                          >
                            {r.status === "quoted" || (isOutsidePurchaseRequest(r) && isOpQuoted) ?
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
                                const showPreview =
                                  !inBundledBatch &&
                                  (showTablePreviewEstimate ||
                                    r.status === "quoted");

                                if (inBundledBatch) {
                                  return (
                                    <p
                                      className={cn(
                                        dashItemsTableCellNote,
                                        "w-full max-w-[12.5rem]",
                                      )}
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
                                      className={cn(
                                        dashItemsTableCellNoteDashed,
                                        "w-full max-w-[12.5rem]",
                                      )}
                                      title="Uncheck Batch to accept this estimate on its own."
                                    >
                                      Uncheck Batch to accept alone
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
                                if (isOpQuoted && showReturnActions) {
                                  return (
                                    <CollapsibleFieldSection
                                      compact
                                      title="Actions"
                                      description={
                                        returnEstimateAccepted ?
                                          "Accept, preview, or cancel return"
                                        : showReturnRequest ?
                                          "Return, preview, accept"
                                        : "Preview return estimate"
                                      }
                                      defaultOpen={
                                        showReturnActions || returnEstimateAccepted
                                      }
                                      className="w-full max-w-[12.5rem] bg-card"
                                    >
                                      <div className="flex flex-col gap-2">
                                        {showReturnRequest ?
                                          <OutsidePurchaseReturnRequestDialog
                                            itemRequestId={r.id}
                                            productLabel={
                                              r.productName?.trim() || undefined
                                            }
                                            receivedCondition={
                                              parseOutsidePurchaseReceivedCondition(
                                                r.outsidePurchaseReceivedCondition,
                                              ) ?? undefined
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
                                        {showPreview ?
                                          <QuoteEstimatePreviewDialog
                                            itemRequestId={r.id}
                                            label="Preview"
                                          />
                                        : null}
                                        {showAccept ?
                                          <AcceptQuoteButton itemRequestId={r.id} />
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

                                return (
                                  <div className="flex w-full max-w-[12.5rem] flex-col gap-1.5">
                                    {showPreview ?
                                      <QuoteEstimatePreviewDialog
                                        itemRequestId={r.id}
                                        label="Preview"
                                      />
                                    : null}
                                    {showAccept ?
                                      <AcceptQuoteButton itemRequestId={r.id} />
                                    : null}
                                  </div>
                                );
                              })()
                            : null}
                            {r.status === "pending" &&
                            !(isOutsidePurchaseRequest(r) && isOpQuoted) ? (
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </FloatingHorizontalScroll>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {sortedActive.length > 0 ?
                    `Showing ${productsSliceStart + 1}–${productsRangeEnd} of ${sortedActive.length}`
                  : "No product rows on this page"}
                  {filteredTopupCharges.length > 0 ?
                    <span className="text-muted-foreground/80">
                      {` · ${filteredTopupCharges.length} add-on top-up${filteredTopupCharges.length === 1 ? "" : "s"}`}
                    </span>
                  : null}
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
