"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  AdminNestedFindOrganizePanel,
  type AdminNestedFindOrganizePageSize,
} from "@/components/admin/admin-nested-find-organize-panel";
import { SortableTh } from "@/components/sortable-th";
import { Button } from "@/components/ui/button";
import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import type { SerpApiUserUsageRow } from "@/data/serp-api-search-events";
import {
  compareLocale,
  compareNum,
  nextSortState,
  type SortDir,
} from "@/lib/table-sort";

type UsageSortKey = "user" | "hour" | "month";

function rowHaystack(row: SerpApiUserUsageRow): string {
  return [
    row.displayName,
    row.email ?? "",
    row.clerkUserId ?? "unattributed",
    String(row.searchesThisHour),
    String(row.searchesThisMonth),
  ]
    .join(" ")
    .toLowerCase();
}

function compareUsageRows(
  a: SerpApiUserUsageRow,
  b: SerpApiUserUsageRow,
  key: UsageSortKey,
  dir: SortDir,
): number {
  switch (key) {
    case "hour":
      return compareNum(a.searchesThisHour, b.searchesThisHour, dir);
    case "month":
      return compareNum(a.searchesThisMonth, b.searchesThisMonth, dir);
    case "user": {
      const byName = compareLocale(a.displayName, b.displayName, dir);
      if (byName !== 0) return byName;
      return compareLocale(a.email ?? "", b.email ?? "", dir);
    }
    default:
      return 0;
  }
}

export function AdminSerpApiUsageByUserTable({
  rows,
}: {
  rows: SerpApiUserUsageRow[];
}) {
  const [findOrganizeVisible, setFindOrganizeVisible] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] =
    useState<AdminNestedFindOrganizePageSize>(25);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<UsageSortKey>("month");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filteredSorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? rows.filter((row) => rowHaystack(row).includes(query))
      : rows;
    return [...filtered].sort((a, b) =>
      compareUsageRows(a, b, sortKey, sortDir),
    );
  }, [rows, search, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const sliceStart = (pageSafe - 1) * pageSize;
  const pageSlice = filteredSorted.slice(sliceStart, sliceStart + pageSize);
  const showFrom = filteredSorted.length === 0 ? 0 : sliceStart + 1;
  const showTo = Math.min(sliceStart + pageSize, filteredSorted.length);

  const cycleSort = (key: UsageSortKey) => {
    const next = nextSortState(sortKey, sortDir, key);
    setSortKey(next.key);
    setSortDir(next.dir);
  };

  const emptyTableMessage =
    rows.length === 0
      ? "No attributed SerpApi searches yet. Counts start when a signed-in customer or admin runs a product lookup, estimate, or Spotlight search."
      : "No users match the current search.";

  return (
    <div className="space-y-3">
      <AdminNestedFindOrganizePanel
        switchId="serp-api-usage-by-user-find"
        searchInputId="serp-api-usage-by-user-search"
        pageSizeSelectId="serp-api-usage-by-user-page-size"
        visible={findOrganizeVisible}
        onVisibleChange={setFindOrganizeVisible}
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search users"
        searchPlaceholder="Name, email, user id, search counts…"
        searchDescription="Filters this table only. Column headers below sort the filtered list by name, this hour, or this month."
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        pageSizeLabel="Rows per page"
        pageSizeDescription="Paginates the users shown in this table."
        showFrom={showFrom}
        showTo={showTo}
        totalCount={filteredSorted.length}
        totalLoaded={rows.length}
        totalLoadedLabel="users with searches"
        itemLabel="user"
        emptyMessage="No attributed SerpApi searches yet."
        noMatchMessage="No users match the current search."
        className="mb-0"
      />
      <FloatingHorizontalScroll className="rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <SortableTh
                label="User"
                columnId="serp-api-usage-user"
                active={sortKey === "user"}
                dir={sortDir}
                onSort={() => cycleSort("user")}
              />
              <SortableTh
                label="This hour"
                columnId="serp-api-usage-hour"
                active={sortKey === "hour"}
                dir={sortDir}
                onSort={() => cycleSort("hour")}
                numeric
              />
              <SortableTh
                label="This month"
                columnId="serp-api-usage-month"
                active={sortKey === "month"}
                dir={sortDir}
                onSort={() => cycleSort("month")}
                numeric
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageSlice.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyTableMessage}
                </td>
              </tr>
            ) : (
              pageSlice.map((row) => (
                <tr key={row.clerkUserId ?? "system"} className="bg-card">
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-foreground">
                      {row.displayName}
                    </span>
                    {row.email ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {row.email}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-foreground">
                    {row.searchesThisHour}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-foreground">
                    {row.searchesThisMonth}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </FloatingHorizontalScroll>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pageSafe <= 1}
          onClick={() => setPage(Math.max(1, pageSafe - 1))}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          Page {pageSafe} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pageSafe >= totalPages}
          onClick={() => setPage(Math.min(totalPages, pageSafe + 1))}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
