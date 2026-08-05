import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildSupportInboxHref,
  supportInboxFilterValues,
  type SupportInboxFilter,
  type SupportInboxQueryInput,
} from "@/lib/support-inbox-params";
import { cn } from "@/lib/utils";

const FILTER_LABELS: Record<SupportInboxFilter, string> = {
  all: "All",
  unread: "Unread",
  read: "Read",
  awaiting_customer: "Reply from hub",
  awaiting_staff: "With support",
  open: "Open",
  resolved: "Resolved",
  closed: "Closed",
};

export function UserSupportInboxTabNav({
  activeTab,
}: {
  activeTab: "inbox" | "history";
}) {
  const tabClass = (selected: boolean) =>
    cn(
      "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
      selected ?
        "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
    );

  return (
    <div
      role="tablist"
      aria-label="Messages views"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      <Link
        href={buildSupportInboxHref("inbox", {})}
        role="tab"
        aria-selected={activeTab === "inbox"}
        className={tabClass(activeTab === "inbox")}
      >
        Messages
      </Link>
      <Link
        href={buildSupportInboxHref("history", {})}
        role="tab"
        aria-selected={activeTab === "history"}
        className={tabClass(activeTab === "history")}
      >
        History
      </Link>
    </div>
  );
}

export function UserSupportInboxControls({
  mode,
  query,
}: {
  mode: "inbox" | "history";
  query: SupportInboxQueryInput;
}) {
  return (
    <form
      method="get"
      action={
        mode === "history" ?
          "/dashboard/support/history"
        : "/dashboard/support"
      }
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="min-w-[12rem] flex-1 space-y-1">
        <Label htmlFor="support-q" className="text-xs">
          Search
        </Label>
        <Input
          id="support-q"
          name="q"
          defaultValue={query.q}
          placeholder="Subject, preview, ticket #"
          className="h-9"
        />
      </div>
      <div className="w-full space-y-1 sm:w-44">
        <Label htmlFor="support-filter" className="text-xs">
          Filter
        </Label>
        <select
          id="support-filter"
          name="filter"
          defaultValue={query.filter}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {supportInboxFilterValues.map((value) => (
            <option key={value} value={value}>
              {FILTER_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full space-y-1 sm:w-28">
        <Label htmlFor="support-ps" className="text-xs">
          Per page
        </Label>
        <select
          id="support-ps"
          name="ps"
          defaultValue={String(query.ps)}
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {[5, 10, 25, 50].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <input type="hidden" name="page" value="1" />
      <Button type="submit" size="sm" className="h-9">
        Apply
      </Button>
    </form>
  );
}
