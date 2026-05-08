"use client";

import { useState } from "react";

import { AdminItemRequestsGroupedTable } from "@/components/admin/admin-item-requests-grouped-table";
import { AdminQuoteHistoryGroupedTable } from "@/components/admin/admin-quote-history-grouped-table";
import type { AdminQuoteHistoryGroup } from "@/data/admin-quote-history";
import type { AdminItemRequestGroup } from "@/lib/admin-item-requests-group";
import { cn } from "@/lib/utils";

import type { ItemRequestLineSnapshot } from "@/db/schema";

type AdminItemRequestsTabsProps = {
  groups: AdminItemRequestGroup[];
  quoteHistoryGroups: AdminQuoteHistoryGroup[];
  hasActiveQueue: boolean;
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
};

export function AdminItemRequestsTabs({
  groups,
  quoteHistoryGroups,
  hasActiveQueue,
  snapshotsByRequestId,
}: AdminItemRequestsTabsProps) {
  const [tab, setTab] = useState<"requests" | "quotes">("requests");

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Item requests views"
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
          Active requests
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "quotes"}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            tab === "quotes"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("quotes")}
        >
          Quote history
        </button>
      </div>

      <div role="tabpanel" aria-live="polite">
        {tab === "requests" ? (
          hasActiveQueue ? (
            <AdminItemRequestsGroupedTable
              groups={groups}
              snapshotsByRequestId={snapshotsByRequestId}
            />
          ) : (
            <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing in the active queue right now (no pending, resend, or quoted items).
            </p>
          )
        ) : (
          <AdminQuoteHistoryGroupedTable
            groups={quoteHistoryGroups}
            snapshotsByRequestId={snapshotsByRequestId}
          />
        )}
      </div>
    </div>
  );
}
