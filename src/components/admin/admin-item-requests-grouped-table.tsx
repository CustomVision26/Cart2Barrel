"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { AdminAiEstimateDialog } from "@/components/admin/admin-ai-estimate-dialog";
import { AdminProductUrlDialog } from "@/components/admin/admin-product-url-dialog";
import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { QuoteEstimatePreviewDialog } from "@/components/quote-estimate-preview-dialog";
import { SortableTh, SortableThCompact } from "@/components/sortable-th";
import { cn } from "@/lib/utils";
import { displaySiteName } from "@/lib/site-name";
import type { SortDir } from "@/lib/table-sort";
import {
  compareLocale,
  compareNum,
  nextSortState,
} from "@/lib/table-sort";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import type { AdminItemRequestGroup } from "@/lib/admin-item-requests-group";
import type {
  AdminItemRequestWithUserRow,
  AdminRequestQueueKind,
} from "@/data/admin-item-requests";

function QueueKindBadge({ kind }: { kind: AdminRequestQueueKind }) {
  if (kind === "new") {
    return (
      <span className="inline-flex rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-400">
        New request
      </span>
    );
  }
  if (kind === "resend") {
    return (
      <span className="inline-flex rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-400">
        Customer resend
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-foreground">
      Quoted
    </span>
  );
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

function sortActiveQueueRows(
  rows: AdminItemRequestWithUserRow[],
  key: LineSortKey,
  dir: SortDir
): AdminItemRequestWithUserRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
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
  });
  return copy;
}

type AdminItemRequestsGroupedTableProps = {
  groups: AdminItemRequestGroup[];
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
};

export function AdminItemRequestsGroupedTable({
  groups,
  snapshotsByRequestId,
}: AdminItemRequestsGroupedTableProps) {
  const [openClerkUserId, setOpenClerkUserId] = useState<string | null>(null);
  const [groupSortKey, setGroupSortKey] = useState<GroupSortKey>("account");
  const [groupSortDir, setGroupSortDir] = useState<SortDir>("asc");
  const [lineSortKey, setLineSortKey] = useState<LineSortKey>("submitted");
  const [lineSortDir, setLineSortDir] = useState<SortDir>("desc");
  const baseId = useId();

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

  const sortedGroups = useMemo(() => {
    const next = [...groups];
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
  }, [groups, groupSortKey, groupSortDir]);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
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
        {sortedGroups.map((g) => {
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
                        <div className="overflow-x-auto rounded-md border border-border bg-background">
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
                                  AI estimate
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
                              ).map(({ request: r, queueKind }) => {
                                const allowAiEstimate =
                                  queueKind === "new" || queueKind === "resend";
                                return (
                                <tr key={r.id} className="hover:bg-muted/30">
                                  <td className="whitespace-nowrap px-2 py-2 align-top">
                                    <QueueKindBadge kind={queueKind} />
                                  </td>
                                  <td className="px-2 py-2 align-top">
                                    <ProductRequestThumbnail
                                      variant="admin"
                                      imageUrl={r.productImageUrl}
                                      productLabel={r.productName}
                                    />
                                  </td>
                                  <td className="max-w-[9rem] px-2 py-2 align-top text-foreground">
                                    <span className="line-clamp-2">
                                      {r.productName?.trim() || "—"}
                                    </span>
                                  </td>
                                  <td className="max-w-[8rem] px-2 py-2 align-top text-muted-foreground">
                                    <span className="line-clamp-2">
                                      {displaySiteName(r.siteName, r.productUrl)}
                                    </span>
                                  </td>
                                  <td className="px-2 py-2 align-top">
                                    <AdminProductUrlDialog productUrl={r.productUrl} />
                                  </td>
                                  <td className="px-2 py-2 align-top">
                                    {allowAiEstimate ? (
                                      <AdminAiEstimateDialog
                                        itemRequestId={r.id}
                                        productUrl={r.productUrl}
                                        initialQuantity={r.quantity}
                                        initialProductSize={r.productSize}
                                        initialProductColor={r.productColor}
                                      />
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
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
                                    <time dateTime={r.createdAt}>
                                      {new Date(r.createdAt).toLocaleString()}
                                    </time>
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
