"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import { AcceptQuoteButton } from "@/components/dashboard/accept-quote-button";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { QuoteEstimatePreviewDialog } from "@/components/quote-estimate-preview-dialog";
import { SortableThCompact } from "@/components/sortable-th";
import type { ItemRequest, ItemRequestLineSnapshot } from "@/db/schema";
import { itemRequestStatusLabel } from "@/lib/item-request-status-label";
import { displaySiteName } from "@/lib/site-name";
import type { SortDir } from "@/lib/table-sort";
import {
  compareLocale,
  compareNum,
  nextSortState,
} from "@/lib/table-sort";
import { cn } from "@/lib/utils";

type ItemsNewTabsProps = {
  activeRequests: ItemRequest[];
  historyRequests: ItemRequest[];
  /** Frozen audit rows keyed by item request id (may be omitted during dev / serialization edge cases). */
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
  /** Checkout / fulfillment labels for Product history (override request status when set). */
  fulfillmentLabelByRequestId?: Record<string, string>;
};

type RowSortKey = "product" | "site" | "status" | "submitted";

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
          displaySiteName(a.siteName, a.productUrl),
          displaySiteName(b.siteName, b.productUrl),
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

export function ItemsNewTabs({
  activeRequests,
  historyRequests,
  snapshotsByRequestId = {},
  fulfillmentLabelByRequestId = {},
}: ItemsNewTabsProps) {
  const [tab, setTab] = useState<"requests" | "history">("requests");
  const [reqSortKey, setReqSortKey] = useState<RowSortKey>("submitted");
  const [reqSortDir, setReqSortDir] = useState<SortDir>("desc");
  const [histSortKey, setHistSortKey] = useState<RowSortKey>("submitted");
  const [histSortDir, setHistSortDir] = useState<SortDir>("desc");

  const cycleReqSort = useCallback((key: RowSortKey) => {
    const next = nextSortState(reqSortKey, reqSortDir, key);
    setReqSortKey(next.key);
    setReqSortDir(next.dir);
  }, [reqSortKey, reqSortDir]);

  const cycleHistSort = useCallback((key: RowSortKey) => {
    const next = nextSortState(histSortKey, histSortDir, key);
    setHistSortKey(next.key);
    setHistSortDir(next.dir);
  }, [histSortKey, histSortDir]);

  const sortedActive = useMemo(
    () => sortItemRequests(activeRequests, reqSortKey, reqSortDir),
    [activeRequests, reqSortKey, reqSortDir]
  );

  const sortedHistory = useMemo(
    () => sortItemRequests(historyRequests, histSortKey, histSortDir),
    [historyRequests, histSortKey, histSortDir]
  );

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Products and history"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "requests"}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            tab === "requests"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("requests")}
        >
          Products
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            tab === "history"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("history")}
        >
          Product history
        </button>
      </div>

      <div role="tabpanel" className="space-y-4" aria-live="polite">
        {tab === "requests" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Pending and quoted submissions. Items you accept appear in your cart
              only. Submit a new request from{" "}
              <Link
                href="/dashboard/items"
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                Requested items
              </Link>
              .
            </p>
            {activeRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active requests.{" "}
                <Link
                  href="/dashboard/items"
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  Submit your first item
                </Link>
                .
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
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
                    {sortedActive.map((r) => (
                      <tr key={r.id} className="align-top">
                        <td className="px-3 py-3 align-top">
                          <ProductRequestThumbnail
                            variant="list"
                            imageUrl={r.productImageUrl}
                            productLabel={r.productName}
                          />
                        </td>
                        <td className="max-w-[10rem] px-3 py-3 align-top font-medium text-foreground">
                          <span className="line-clamp-2">
                            {r.productName?.trim() || "Unnamed product"}
                          </span>
                        </td>
                        <td className="max-w-[8rem] px-3 py-3 align-top text-muted-foreground">
                          <span className="line-clamp-2 text-xs sm:text-sm">
                            {displaySiteName(r.siteName, r.productUrl)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top">
                          <a
                            href={r.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={r.productUrl}
                            aria-label={`Open product url: ${r.productUrl}`}
                            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Product url
                          </a>
                        </td>
                        <td className="max-w-[12rem] px-3 py-3 align-top text-xs text-muted-foreground">
                          Qty {r.quantity}
                          {r.productSize?.trim()
                            ? ` · Size ${r.productSize.trim()}`
                            : ""}
                          {r.productColor?.trim()
                            ? ` · Color ${r.productColor.trim()}`
                            : ""}
                          {r.note?.trim() ? ` · ${r.note.trim()}` : ""}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top">
                          <span
                            className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                            title={r.status}
                          >
                            {itemRequestStatusLabel(r.status)}
                          </span>
                        </td>
                        <td className="space-y-2 px-3 py-3 align-top">
                          {r.status === "quoted" ? (
                            <AcceptQuoteButton itemRequestId={r.id} />
                          ) : null}
                          <QuoteEstimatePreviewDialog
                            itemRequestId={r.id}
                            label="Preview estimate"
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-muted-foreground">
                          <time dateTime={r.createdAt}>
                            {new Date(r.createdAt).toLocaleString()}
                          </time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Items in your cart, rejected quotes, and lines you removed from your cart.
              Frozen copies of each change are stored for auditing — open{" "}
              <span className="font-medium text-foreground">Audit trail</span> on a row to
              review.
            </p>
            {historyRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No history yet. Closed requests will appear here.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th className="px-3 py-2.5 font-medium text-foreground">
                        Photo
                      </th>
                      <SortableThCompact
                        columnId="dash-hist-product"
                        label="Product"
                        active={histSortKey === "product"}
                        dir={histSortDir}
                        onSort={() => cycleHistSort("product")}
                      />
                      <SortableThCompact
                        columnId="dash-hist-site"
                        label="Site name"
                        active={histSortKey === "site"}
                        dir={histSortDir}
                        onSort={() => cycleHistSort("site")}
                      />
                      <th className="px-3 py-2.5 font-medium text-foreground">
                        Product url
                      </th>
                      <th className="px-3 py-2.5 font-medium text-foreground">
                        Details
                      </th>
                      <SortableThCompact
                        columnId="dash-hist-status"
                        label="Status"
                        active={histSortKey === "status"}
                        dir={histSortDir}
                        onSort={() => cycleHistSort("status")}
                      />
                      <th className="px-3 py-2.5 font-medium text-foreground">
                        Actions
                      </th>
                      <SortableThCompact
                        columnId="dash-hist-submitted"
                        label="Submitted"
                        active={histSortKey === "submitted"}
                        dir={histSortDir}
                        onSort={() => cycleHistSort("submitted")}
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedHistory.map((r) => (
                      <tr key={r.id} className="align-top">
                        <td className="px-3 py-3 align-top">
                          <ProductRequestThumbnail
                            variant="list"
                            imageUrl={r.productImageUrl}
                            productLabel={r.productName}
                          />
                        </td>
                        <td className="max-w-[10rem] px-3 py-3 align-top font-medium text-foreground">
                          <span className="line-clamp-2">
                            {r.productName?.trim() || "Unnamed product"}
                          </span>
                        </td>
                        <td className="max-w-[8rem] px-3 py-3 align-top text-muted-foreground">
                          <span className="line-clamp-2 text-xs sm:text-sm">
                            {displaySiteName(r.siteName, r.productUrl)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top">
                          <a
                            href={r.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={r.productUrl}
                            aria-label={`Open product url: ${r.productUrl}`}
                            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Product url
                          </a>
                        </td>
                        <td className="max-w-[12rem] px-3 py-3 align-top text-xs text-muted-foreground">
                          Qty {r.quantity}
                          {r.productSize?.trim()
                            ? ` · Size ${r.productSize.trim()}`
                            : ""}
                          {r.productColor?.trim()
                            ? ` · Color ${r.productColor.trim()}`
                            : ""}
                          {r.note?.trim() ? ` · ${r.note.trim()}` : ""}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top">
                          <span
                            className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                            title={
                              fulfillmentLabelByRequestId[r.id] ?? r.status
                            }
                          >
                            {fulfillmentLabelByRequestId[r.id] ??
                              itemRequestStatusLabel(r.status)}
                          </span>
                        </td>
                        <td className="space-y-2 px-3 py-3 align-top">
                          <QuoteEstimatePreviewDialog
                            itemRequestId={r.id}
                            label="View last estimate"
                          />
                          <ItemRequestLineAuditDialog
                            itemRequestId={r.id}
                            productLabel={r.productName?.trim() || ""}
                            snapshots={snapshotsByRequestId[r.id] ?? []}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-top text-xs text-muted-foreground">
                          <time dateTime={r.createdAt}>
                            Submitted {new Date(r.createdAt).toLocaleString()}
                          </time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
