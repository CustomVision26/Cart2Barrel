"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_ITEM_REQUESTS_ROUTES } from "@/lib/admin-item-requests-routes";
import { cn } from "@/lib/utils";

type AdminBatchItemsSubTabNavProps = {
  pendingSubmissionCount: number;
  estimateHistoryCount: number;
  batchHistoryCount: number;
};

export function AdminBatchItemsSubTabNav({
  pendingSubmissionCount,
  estimateHistoryCount,
  batchHistoryCount,
}: AdminBatchItemsSubTabNavProps) {
  const pathname = usePathname();

  const linkClass = (href: string) =>
    cn(
      "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
      pathname === href
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    );

  const rootPrefix = ADMIN_ITEM_REQUESTS_ROUTES.batchItems;

  return (
    <div
      role="tablist"
      aria-label="Batch items sections"
      className="flex flex-wrap gap-1 border-b border-border pb-px"
    >
      <Link
        href={ADMIN_ITEM_REQUESTS_ROUTES.batchItemsSubmitted}
        role="tab"
        aria-selected={
          pathname === ADMIN_ITEM_REQUESTS_ROUTES.batchItemsSubmitted ||
          pathname === rootPrefix
        }
        className={linkClass(ADMIN_ITEM_REQUESTS_ROUTES.batchItemsSubmitted)}
      >
        Submitted batches
        {pendingSubmissionCount > 0 ? (
          <span className="ml-2 inline-flex rounded bg-primary/15 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-primary">
            {pendingSubmissionCount}
          </span>
        ) : null}
      </Link>
      <Link
        href={ADMIN_ITEM_REQUESTS_ROUTES.batchItemsBatchEstimates}
        role="tab"
        aria-selected={
          pathname === ADMIN_ITEM_REQUESTS_ROUTES.batchItemsBatchEstimates
        }
        className={linkClass(ADMIN_ITEM_REQUESTS_ROUTES.batchItemsBatchEstimates)}
      >
        Batch estimates
        {estimateHistoryCount > 0 ? (
          <span className="ml-2 inline-flex rounded bg-muted px-1.5 py-0.5 align-middle font-mono text-[10px] text-muted-foreground">
            {estimateHistoryCount}
          </span>
        ) : null}
      </Link>
      <Link
        href={ADMIN_ITEM_REQUESTS_ROUTES.batchItemsBatchHistory}
        role="tab"
        aria-selected={pathname === ADMIN_ITEM_REQUESTS_ROUTES.batchItemsBatchHistory}
        className={linkClass(ADMIN_ITEM_REQUESTS_ROUTES.batchItemsBatchHistory)}
      >
        Batch history
        {batchHistoryCount > 0 ? (
          <span className="ml-2 inline-flex rounded bg-muted px-1.5 py-0.5 align-middle font-mono text-[10px] text-muted-foreground">
            {batchHistoryCount}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
