"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";

import {
  AdminNestedFindOrganizePanel,
  type AdminNestedFindOrganizePageSize,
} from "@/components/admin/admin-nested-find-organize-panel";
import { SortableTh } from "@/components/sortable-th";
import { Button, buttonVariants } from "@/components/ui/button";
import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import type {
  SiteTrafficPageRow,
  SiteTrafficRecentVisitRow,
  SiteTrafficSnapshot,
  SiteTrafficSummary,
  SiteTrafficVisitorKind,
  SiteTrafficVisitorRow,
} from "@/data/page-visits";
import { ADMIN_USERS_ROUTES } from "@/lib/admin-users-routes";
import {
  SITE_TRAFFIC_PERIODS,
  siteTrafficPeriodButtonLabel,
  siteTrafficPeriodRangeLabel,
  siteTrafficPeriodShortLabel,
  type SiteTrafficPeriod,
} from "@/lib/site-traffic";
import {
  compareLocale,
  compareNum,
  nextSortState,
  type SortDir,
} from "@/lib/table-sort";
import { cn } from "@/lib/utils";

type KindFilter = "all" | SiteTrafficVisitorKind;

function formatWhen(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function KindBadge({ kind }: { kind: SiteTrafficVisitorKind }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        kind === "registered"
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-muted text-muted-foreground",
      )}
    >
      {kind === "registered" ? "Registered" : "Unregistered"}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="font-heading text-sm font-medium text-muted-foreground">
        {label}
      </h2>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </section>
  );
}

function PeriodFilterButtons({ value }: { value: SiteTrafficPeriod }) {
  return (
    <div
      role="group"
      aria-label="Sort traffic by day, week, month, or year"
      className="flex flex-wrap items-center gap-1.5"
    >
      <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Sort by
      </span>
      {SITE_TRAFFIC_PERIODS.map((period) => (
        <Link
          key={period}
          href={`${ADMIN_USERS_ROUTES.siteTraffic}?period=${period}`}
          className={buttonVariants({
            variant: value === period ? "default" : "outline",
            size: "sm",
          })}
          aria-current={value === period ? "page" : undefined}
        >
          {siteTrafficPeriodButtonLabel(period)}
        </Link>
      ))}
    </div>
  );
}

function KindFilterButtons({
  value,
  onChange,
}: {
  value: KindFilter;
  onChange: (next: KindFilter) => void;
}) {
  const options: Array<{ id: KindFilter; label: string }> = [
    { id: "all", label: "All visitors" },
    { id: "registered", label: "Registered" },
    { id: "unregistered", label: "Unregistered" },
  ];
  return (
    <div
      role="group"
      aria-label="Filter visitors by account type"
      className="flex flex-wrap gap-1.5"
    >
      {options.map((option) => (
        <Button
          key={option.id}
          type="button"
          size="sm"
          variant={value === option.id ? "default" : "outline"}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function TablePager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPage(Math.max(1, page - 1))}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
        Previous
      </Button>
      <span className="text-xs tabular-nums text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

type VisitorSortKey = "visitor" | "kind" | "visits" | "pages" | "lastPath" | "lastSeen";

function visitorHaystack(row: SiteTrafficVisitorRow): string {
  return [
    row.displayName,
    row.email ?? "",
    row.clerkUserId ?? "",
    row.visitorId,
    row.kind,
    row.lastPath,
    ...row.pages.map((page) => page.path),
  ]
    .join(" ")
    .toLowerCase();
}

function compareVisitors(
  a: SiteTrafficVisitorRow,
  b: SiteTrafficVisitorRow,
  key: VisitorSortKey,
  dir: SortDir,
): number {
  switch (key) {
    case "visits":
      return compareNum(a.visitCount, b.visitCount, dir);
    case "pages":
      return compareNum(a.pageCount, b.pageCount, dir);
    case "kind":
      return compareLocale(a.kind, b.kind, dir);
    case "lastPath":
      return compareLocale(a.lastPath, b.lastPath, dir);
    case "lastSeen":
      return compareLocale(a.lastSeenAt, b.lastSeenAt, dir);
    case "visitor": {
      const byName = compareLocale(a.displayName, b.displayName, dir);
      if (byName !== 0) return byName;
      return compareLocale(a.email ?? "", b.email ?? "", dir);
    }
    default:
      return 0;
  }
}

function VisitorsTable({
  rows,
  kindFilter,
  period,
}: {
  rows: SiteTrafficVisitorRow[];
  kindFilter: KindFilter;
  period: SiteTrafficPeriod;
}) {
  const [findOrganizeVisible, setFindOrganizeVisible] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] =
    useState<AdminNestedFindOrganizePageSize>(25);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<VisitorSortKey>("lastSeen");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredSorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (kindFilter !== "all" && row.kind !== kindFilter) return false;
      if (query && !visitorHaystack(row).includes(query)) return false;
      return true;
    });
    return [...filtered].sort((a, b) =>
      compareVisitors(a, b, sortKey, sortDir),
    );
  }, [rows, search, sortKey, sortDir, kindFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, sortKey, sortDir, kindFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const sliceStart = (pageSafe - 1) * pageSize;
  const pageSlice = filteredSorted.slice(sliceStart, sliceStart + pageSize);
  const showFrom = filteredSorted.length === 0 ? 0 : sliceStart + 1;
  const showTo = Math.min(sliceStart + pageSize, filteredSorted.length);

  const cycleSort = (key: VisitorSortKey) => {
    const next = nextSortState(sortKey, sortDir, key);
    setSortKey(next.key);
    setSortDir(next.dir);
  };

  const emptyMessage =
    rows.length === 0
      ? "No page views recorded yet. Traffic appears after shoppers open public or dashboard pages."
      : "No visitors match the current filters.";

  return (
    <div className="space-y-3">
      <AdminNestedFindOrganizePanel
        switchId="site-traffic-visitors-find"
        searchInputId="site-traffic-visitors-search"
        pageSizeSelectId="site-traffic-visitors-page-size"
        visible={findOrganizeVisible}
        onVisibleChange={setFindOrganizeVisible}
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search visitors"
        searchPlaceholder="Name, email, guest id, page path…"
        searchDescription="Filters this visitor table. Expand a row to see every page that visitor opened."
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        pageSizeLabel="Rows per page"
        pageSizeDescription="Paginates visitors shown in this table."
        showFrom={showFrom}
        showTo={showTo}
        totalCount={filteredSorted.length}
        totalLoaded={rows.length}
        totalLoadedLabel={`visitors in ${siteTrafficPeriodRangeLabel(period)}`}
        itemLabel="visitor"
        emptyMessage="No visitors recorded yet."
        noMatchMessage="No visitors match the current search."
        className="mb-0"
      />
      <FloatingHorizontalScroll className="rounded-lg border border-border">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-2 py-2.5" aria-label="Expand pages" />
              <SortableTh
                label="Visitor"
                columnId="site-traffic-visitor"
                active={sortKey === "visitor"}
                dir={sortDir}
                onSort={() => cycleSort("visitor")}
              />
              <SortableTh
                label="Type"
                columnId="site-traffic-kind"
                active={sortKey === "kind"}
                dir={sortDir}
                onSort={() => cycleSort("kind")}
              />
              <SortableTh
                label="Visits"
                columnId="site-traffic-visits"
                active={sortKey === "visits"}
                dir={sortDir}
                onSort={() => cycleSort("visits")}
                numeric
              />
              <SortableTh
                label="Pages"
                columnId="site-traffic-page-count"
                active={sortKey === "pages"}
                dir={sortDir}
                onSort={() => cycleSort("pages")}
                numeric
              />
              <SortableTh
                label="Last page"
                columnId="site-traffic-last-path"
                active={sortKey === "lastPath"}
                dir={sortDir}
                onSort={() => cycleSort("lastPath")}
              />
              <SortableTh
                label="Last seen"
                columnId="site-traffic-last-seen"
                active={sortKey === "lastSeen"}
                dir={sortDir}
                onSort={() => cycleSort("lastSeen")}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageSlice.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageSlice.map((row) => {
                const open = expandedId === row.visitorId;
                return (
                  <VisitorRows
                    key={row.visitorId}
                    row={row}
                    open={open}
                    onToggle={() =>
                      setExpandedId(open ? null : row.visitorId)
                    }
                  />
                );
              })
            )}
          </tbody>
        </table>
      </FloatingHorizontalScroll>
      <TablePager page={pageSafe} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

function VisitorRows({
  row,
  open,
  onToggle,
}: {
  row: SiteTrafficVisitorRow;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="bg-card">
        <td className="px-2 py-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-expanded={open}
            aria-label={
              open
                ? `Hide pages visited by ${row.displayName}`
                : `Show pages visited by ${row.displayName}`
            }
            onClick={onToggle}
          >
            {open ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </Button>
        </td>
        <td className="px-3 py-2.5">
          <span className="font-medium text-foreground">{row.displayName}</span>
          {row.email ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {row.email}
            </span>
          ) : (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {row.kind === "unregistered"
                ? "Anonymous browser session"
                : row.clerkUserId}
            </span>
          )}
        </td>
        <td className="px-3 py-2.5">
          <KindBadge kind={row.kind} />
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-foreground">
          {row.visitCount}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-foreground">
          {row.pageCount}
        </td>
        <td className="max-w-[18rem] truncate px-3 py-2.5 font-mono text-xs text-foreground">
          {row.lastPath}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-foreground">
          {formatWhen(row.lastSeenAt)}
        </td>
      </tr>
      {open ? (
        <tr className="bg-muted/40">
          <td colSpan={7} className="px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pages visited
            </p>
            {row.pages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pages recorded for this visitor.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">Page</th>
                    <th className="py-1 pr-3 font-medium">Visits</th>
                    <th className="py-1 font-medium">Last visited</th>
                  </tr>
                </thead>
                <tbody>
                  {row.pages.map((page) => (
                    <tr key={page.path}>
                      <td className="py-1 pr-3 font-mono text-xs text-foreground">
                        {page.path}
                      </td>
                      <td className="py-1 pr-3 tabular-nums">{page.visitCount}</td>
                      <td className="py-1 text-muted-foreground">
                        {formatWhen(page.lastVisitedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

type PageSortKey =
  | "path"
  | "visits"
  | "visitors"
  | "registered"
  | "unregistered"
  | "lastVisited";

function pageHaystack(row: SiteTrafficPageRow): string {
  return row.path.toLowerCase();
}

function comparePages(
  a: SiteTrafficPageRow,
  b: SiteTrafficPageRow,
  key: PageSortKey,
  dir: SortDir,
): number {
  switch (key) {
    case "visits":
      return compareNum(a.visitCount, b.visitCount, dir);
    case "visitors":
      return compareNum(a.uniqueVisitorCount, b.uniqueVisitorCount, dir);
    case "registered":
      return compareNum(a.registeredVisitCount, b.registeredVisitCount, dir);
    case "unregistered":
      return compareNum(a.unregisteredVisitCount, b.unregisteredVisitCount, dir);
    case "lastVisited":
      return compareLocale(a.lastVisitedAt, b.lastVisitedAt, dir);
    case "path":
      return compareLocale(a.path, b.path, dir);
    default:
      return 0;
  }
}

function PagesTable({
  rows,
  period,
}: {
  rows: SiteTrafficPageRow[];
  period: SiteTrafficPeriod;
}) {
  const [findOrganizeVisible, setFindOrganizeVisible] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] =
    useState<AdminNestedFindOrganizePageSize>(25);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<PageSortKey>("visits");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filteredSorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? rows.filter((row) => pageHaystack(row).includes(query))
      : rows;
    return [...filtered].sort((a, b) => comparePages(a, b, sortKey, sortDir));
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

  const cycleSort = (key: PageSortKey) => {
    const next = nextSortState(sortKey, sortDir, key);
    setSortKey(next.key);
    setSortDir(next.dir);
  };

  return (
    <div className="space-y-3">
      <AdminNestedFindOrganizePanel
        switchId="site-traffic-pages-find"
        searchInputId="site-traffic-pages-search"
        pageSizeSelectId="site-traffic-pages-page-size"
        visible={findOrganizeVisible}
        onVisibleChange={setFindOrganizeVisible}
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search pages"
        searchPlaceholder="Path, such as / or /dashboard/cart…"
        searchDescription={`Filters this pages table. Counts cover ${siteTrafficPeriodRangeLabel(period)}.`}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        pageSizeLabel="Rows per page"
        pageSizeDescription="Paginates pages shown in this table."
        showFrom={showFrom}
        showTo={showTo}
        totalCount={filteredSorted.length}
        totalLoaded={rows.length}
        totalLoadedLabel="distinct pages"
        itemLabel="page"
        emptyMessage="No pages recorded yet."
        noMatchMessage="No pages match the current search."
        className="mb-0"
      />
      <FloatingHorizontalScroll className="rounded-lg border border-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <SortableTh
                label="Page"
                columnId="site-traffic-page-path"
                active={sortKey === "path"}
                dir={sortDir}
                onSort={() => cycleSort("path")}
              />
              <SortableTh
                label="Visits"
                columnId="site-traffic-page-visits"
                active={sortKey === "visits"}
                dir={sortDir}
                onSort={() => cycleSort("visits")}
                numeric
              />
              <SortableTh
                label="Unique visitors"
                columnId="site-traffic-page-visitors"
                active={sortKey === "visitors"}
                dir={sortDir}
                onSort={() => cycleSort("visitors")}
                numeric
              />
              <SortableTh
                label="Registered visits"
                columnId="site-traffic-page-registered"
                active={sortKey === "registered"}
                dir={sortDir}
                onSort={() => cycleSort("registered")}
                numeric
              />
              <SortableTh
                label="Unregistered visits"
                columnId="site-traffic-page-unregistered"
                active={sortKey === "unregistered"}
                dir={sortDir}
                onSort={() => cycleSort("unregistered")}
                numeric
              />
              <SortableTh
                label="Last visited"
                columnId="site-traffic-page-last"
                active={sortKey === "lastVisited"}
                dir={sortDir}
                onSort={() => cycleSort("lastVisited")}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageSlice.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {rows.length === 0
                    ? "No page views recorded yet."
                    : "No pages match the current search."}
                </td>
              </tr>
            ) : (
              pageSlice.map((row) => (
                <tr key={row.path} className="bg-card">
                  <td className="px-3 py-2.5 font-mono text-xs text-foreground">
                    {row.path}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                    {row.visitCount}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                    {row.uniqueVisitorCount}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                    {row.registeredVisitCount}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                    {row.unregisteredVisitCount}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {formatWhen(row.lastVisitedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </FloatingHorizontalScroll>
      <TablePager page={pageSafe} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

type RecentSortKey = "when" | "visitor" | "kind" | "path" | "visits";

type RecentVisitGroup = {
  visitorId: string;
  displayName: string;
  email: string | null;
  kind: SiteTrafficVisitorKind;
  lastSeenAt: string;
  lastPath: string;
  visitCount: number;
  visits: SiteTrafficRecentVisitRow[];
};

function recentHaystack(row: SiteTrafficRecentVisitRow): string {
  return [row.displayName, row.email ?? "", row.path, row.kind, row.visitorId]
    .join(" ")
    .toLowerCase();
}

function compareRecentGroups(
  a: RecentVisitGroup,
  b: RecentVisitGroup,
  key: RecentSortKey,
  dir: SortDir,
): number {
  switch (key) {
    case "when":
      return compareLocale(a.lastSeenAt, b.lastSeenAt, dir);
    case "kind":
      return compareLocale(a.kind, b.kind, dir);
    case "path":
      return compareLocale(a.lastPath, b.lastPath, dir);
    case "visits":
      return compareNum(a.visitCount, b.visitCount, dir);
    case "visitor":
      return compareLocale(a.displayName, b.displayName, dir);
    default:
      return 0;
  }
}

function groupRecentVisits(
  rows: SiteTrafficRecentVisitRow[],
): RecentVisitGroup[] {
  const byVisitor = new Map<string, SiteTrafficRecentVisitRow[]>();
  for (const row of rows) {
    const list = byVisitor.get(row.visitorId) ?? [];
    list.push(row);
    byVisitor.set(row.visitorId, list);
  }

  const groups: RecentVisitGroup[] = [];
  for (const [visitorId, visits] of byVisitor) {
    const sorted = [...visits].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    const latest = sorted[0];
    if (!latest) continue;
    groups.push({
      visitorId,
      displayName: latest.displayName,
      email: latest.email,
      kind: latest.kind,
      lastSeenAt: latest.createdAt,
      lastPath: latest.path,
      visitCount: sorted.length,
      visits: sorted,
    });
  }
  return groups;
}

function RecentVisitsTable({
  rows,
  kindFilter,
  period,
}: {
  rows: SiteTrafficRecentVisitRow[];
  kindFilter: KindFilter;
  period: SiteTrafficPeriod;
}) {
  const [findOrganizeVisible, setFindOrganizeVisible] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] =
    useState<AdminNestedFindOrganizePageSize>(25);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<RecentSortKey>("when");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadedGroupCount = useMemo(
    () => groupRecentVisits(rows).length,
    [rows],
  );

  const filteredSorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (kindFilter !== "all" && row.kind !== kindFilter) return false;
      if (query && !recentHaystack(row).includes(query)) return false;
      return true;
    });
    return groupRecentVisits(filtered).sort((a, b) =>
      compareRecentGroups(a, b, sortKey, sortDir),
    );
  }, [rows, search, sortKey, sortDir, kindFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, sortKey, sortDir, kindFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const sliceStart = (pageSafe - 1) * pageSize;
  const pageSlice = filteredSorted.slice(sliceStart, sliceStart + pageSize);
  const showFrom = filteredSorted.length === 0 ? 0 : sliceStart + 1;
  const showTo = Math.min(sliceStart + pageSize, filteredSorted.length);

  const cycleSort = (key: RecentSortKey) => {
    const next = nextSortState(sortKey, sortDir, key);
    setSortKey(next.key);
    setSortDir(next.dir);
  };

  return (
    <div className="space-y-3">
      <AdminNestedFindOrganizePanel
        switchId="site-traffic-recent-find"
        searchInputId="site-traffic-recent-search"
        pageSizeSelectId="site-traffic-recent-page-size"
        visible={findOrganizeVisible}
        onVisibleChange={setFindOrganizeVisible}
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search visits"
        searchPlaceholder="Visitor, email, or page path…"
        searchDescription="Groups repeat views by the same visitor. Use the up/down control to open the page list for that visitor."
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        pageSizeLabel="Rows per page"
        pageSizeDescription="Paginates visitor groups shown in this table."
        showFrom={showFrom}
        showTo={showTo}
        totalCount={filteredSorted.length}
        totalLoaded={loadedGroupCount}
        totalLoadedLabel={`visitors in ${siteTrafficPeriodRangeLabel(period)}`}
        itemLabel="visitor"
        emptyMessage="No recent visits yet."
        noMatchMessage="No visits match the current search."
        className="mb-0"
      />
      <FloatingHorizontalScroll className="rounded-lg border border-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-2 py-2.5" aria-label="Expand visits" />
              <SortableTh
                label="When"
                columnId="site-traffic-recent-when"
                active={sortKey === "when"}
                dir={sortDir}
                onSort={() => cycleSort("when")}
              />
              <SortableTh
                label="Visitor"
                columnId="site-traffic-recent-visitor"
                active={sortKey === "visitor"}
                dir={sortDir}
                onSort={() => cycleSort("visitor")}
              />
              <SortableTh
                label="Type"
                columnId="site-traffic-recent-kind"
                active={sortKey === "kind"}
                dir={sortDir}
                onSort={() => cycleSort("kind")}
              />
              <SortableTh
                label="Last page"
                columnId="site-traffic-recent-path"
                active={sortKey === "path"}
                dir={sortDir}
                onSort={() => cycleSort("path")}
              />
              <SortableTh
                label="Visits"
                columnId="site-traffic-recent-visits"
                active={sortKey === "visits"}
                dir={sortDir}
                onSort={() => cycleSort("visits")}
                numeric
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageSlice.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {rows.length === 0
                    ? "No recent page views yet."
                    : "No visits match the current filters."}
                </td>
              </tr>
            ) : (
              pageSlice.map((group) => {
                const open = expandedId === group.visitorId;
                return (
                  <RecentVisitGroupRows
                    key={group.visitorId}
                    group={group}
                    open={open}
                    onToggle={() =>
                      setExpandedId(open ? null : group.visitorId)
                    }
                  />
                );
              })
            )}
          </tbody>
        </table>
      </FloatingHorizontalScroll>
      <TablePager page={pageSafe} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

function RecentVisitGroupRows({
  group,
  open,
  onToggle,
}: {
  group: RecentVisitGroup;
  open: boolean;
  onToggle: () => void;
}) {
  const canExpand = group.visitCount > 1;

  return (
    <>
      <tr className="bg-card">
        <td className="px-2 py-2">
          {canExpand ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-expanded={open}
              aria-label={
                open
                  ? `Hide pages visited by ${group.displayName}`
                  : `Show pages visited by ${group.displayName}`
              }
              onClick={onToggle}
            >
              {open ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </Button>
          ) : null}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5">
          {formatWhen(group.lastSeenAt)}
        </td>
        <td className="px-3 py-2.5">
          <span className="font-medium text-foreground">
            {group.displayName}
          </span>
          {group.email ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {group.email}
            </span>
          ) : null}
        </td>
        <td className="px-3 py-2.5">
          <KindBadge kind={group.kind} />
        </td>
        <td className="px-3 py-2.5 font-mono text-xs text-foreground">
          {group.lastPath}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
          {group.visitCount}
        </td>
      </tr>
      {open && canExpand ? (
        <tr className="bg-muted/40">
          <td colSpan={6} className="px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pages visited
            </p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">When</th>
                  <th className="py-1 pr-3 font-medium">Page</th>
                  <th className="py-1 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {group.visits.map((visit) => (
                  <tr key={visit.id}>
                    <td className="whitespace-nowrap py-1 pr-3 text-muted-foreground">
                      {formatWhen(visit.createdAt)}
                    </td>
                    <td className="py-1 pr-3 font-mono text-xs text-foreground">
                      {visit.path}
                    </td>
                    <td className="py-1">
                      <KindBadge kind={visit.kind} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function AdminSiteTrafficPanel({
  snapshot,
}: {
  snapshot: SiteTrafficSnapshot;
}) {
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const summary: SiteTrafficSummary = snapshot.summary;
  const period = snapshot.period;
  const range = siteTrafficPeriodRangeLabel(period);
  const periodShort = siteTrafficPeriodShortLabel(period);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {period === "day" ? null : (
          <SummaryCard
            label="Visits · 24h"
            value={summary.visits24h}
            hint="Page views in the last 24 hours."
          />
        )}
        <SummaryCard
          label={`Visits · ${periodShort}`}
          value={summary.visitsInPeriod}
          hint={`Page views in ${range}.`}
        />
        <SummaryCard
          label="Unique visitors"
          value={summary.uniqueVisitors}
          hint={`Distinct browsers (cookie) in ${range}.`}
        />
        <SummaryCard
          label="Registered"
          value={summary.registeredVisitors}
          hint="Visitors who were signed in for at least one view."
        />
        <SummaryCard
          label="Unregistered"
          value={summary.unregisteredVisitors}
          hint="Visitors with no signed-in page view."
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <PeriodFilterButtons value={period} />
        <KindFilterButtons value={kindFilter} onChange={setKindFilter} />
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-medium text-foreground">
          Visitors
        </h2>
        <p className="text-sm text-muted-foreground">
          Expand a row to list every page that visitor opened in {range}. Guests
          share a browser cookie until they sign in; later signed-in views stay
          on the same visitor.
        </p>
        <VisitorsTable
          rows={snapshot.visitors}
          kindFilter={kindFilter}
          period={period}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-medium text-foreground">
          Pages
        </h2>
        <p className="text-sm text-muted-foreground">
          How often each route was opened in {range}, split between signed-in
          and guest views.
        </p>
        <PagesTable rows={snapshot.pages} period={period} />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-medium text-foreground">
          Recent visits
        </h2>
        <p className="text-sm text-muted-foreground">
          Repeat views from the same guest or signed-in account are grouped.
          Use the up/down control to open a subtable of every page they
          opened.
        </p>
        <RecentVisitsTable
          rows={snapshot.recentVisits}
          kindFilter={kindFilter}
          period={period}
        />
      </section>
    </div>
  );
}
