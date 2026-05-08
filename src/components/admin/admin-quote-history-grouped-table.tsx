"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { AdminProductUrlDialog } from "@/components/admin/admin-product-url-dialog";
import { AdminQuoteHistoryEditDialog } from "@/components/admin/admin-quote-history-edit-dialog";
import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { QuoteEstimatePreviewDialog } from "@/components/quote-estimate-preview-dialog";
import { SortableTh, SortableThCompact } from "@/components/sortable-th";
import { Button } from "@/components/ui/button";
import type { AdminQuoteHistoryGroup, AdminQuoteHistoryLine } from "@/data/admin-quote-history";
import type { ItemQuote, ItemRequestLineSnapshot } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import {
  ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE,
  ITEM_QUOTE_CHECKOUT_SNAPSHOT_PAID,
  isOperationalQuoteRow,
} from "@/lib/checkout-snapshot-kind";
import { adminItemRequestStatusDisplay } from "@/lib/item-request-status-label";
import { displaySiteName } from "@/lib/site-name";
import type { SortDir } from "@/lib/table-sort";
import {
  compareLocale,
  compareNum,
  nextSortState,
} from "@/lib/table-sort";
import { cn } from "@/lib/utils";

function quoteRevisionLabel(q: ItemQuote): string {
  if (q.checkoutSnapshotKind === ITEM_QUOTE_CHECKOUT_SNAPSHOT_PAID) {
    return "Paid";
  }
  if (q.checkoutSnapshotKind === ITEM_QUOTE_CHECKOUT_SNAPSHOT_COMPANY_PURCHASE) {
    return "Company Purchase";
  }
  if (q.voidedAt) {
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
};

export function AdminQuoteHistoryGroupedTable({
  groups,
  snapshotsByRequestId,
}: AdminQuoteHistoryGroupedTableProps) {
  const [openClerkUserId, setOpenClerkUserId] = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [groupSortKey, setGroupSortKey] = useState<QhGroupSortKey>("customer");
  const [groupSortDir, setGroupSortDir] = useState<SortDir>("asc");
  const [lineSortKey, setLineSortKey] = useState<QhLineSortKey>("quoted");
  const [lineSortDir, setLineSortDir] = useState<SortDir>("desc");
  const baseId = useId();

  const sortedGroups = useMemo(() => {
    const next = [...groups];
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
  }, [groups, groupSortKey, groupSortDir]);

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
    <div className="overflow-x-auto rounded-lg border border-border">
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
        {sortedGroups.map((g) => {
          const expanded = openClerkUserId === g.clerkUserId;
          const panelId = `${baseId}-quotes-${g.clerkUserId}`;
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
                          <span className="font-medium text-foreground">request status Quoted</span>
                          , use <span className="font-medium text-foreground">Edit</span> under
                          Audit to change amounts or run AI assist.{" "}
                          <span className="font-medium text-foreground">In cart</span> means the
                          customer can see the line on their cart;{" "}
                          <span className="font-medium text-foreground">In order …</span> means
                          checkout created an order (cart hides it until the order is removed).
                        </p>
                      <div className="overflow-x-auto rounded-md border border-border bg-background">
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
                            {sortQuoteHistoryLines(
                              g.lines,
                              lineSortKey,
                              lineSortDir
                            ).map((line) => {
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
                                    {adminItemRequestStatusDisplay(
                                      r.status,
                                      line.orderStatus
                                    )}
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
                                          Edit
                                        </Button>
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          );
        })}
      </table>
    </div>

    <AdminQuoteHistoryEditDialog
      open={editOpen && Boolean(selectedLine)}
      onOpenChange={(next) => {
        setEditOpen(next);
        if (!next) setSelectedQuoteId(null);
      }}
      line={selectedLine}
    />
    </div>
  );
}
