"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Loader2Icon } from "lucide-react";
import { useCallback, useMemo, useState, useTransition } from "react";

import { toast } from "sonner";

import {
  removeDraftBatchProductsAction,
  submitCustomerBatchQuoteAction,
  withdrawQuotedBatchSessionAction,
} from "@/actions/customer-batch-quote";
import { AcceptBatchQuoteButton } from "@/components/dashboard/accept-batch-quote-button";
import { BatchEstimatePreviewDialog } from "@/components/dashboard/batch-estimate-preview-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Field,
  FieldContent,
  FieldLabel,
} from "@/components/ui/field";
import { FieldLabelWithHelp } from "@/components/ui/field-label-with-help";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { OwnerBatchQuoteSessionBundle } from "@/data/batch-quote-sessions";
import type { ItemRequest } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import {
  batchQuoteSessionEventKindLabel,
  ownerBatchQuoteSessionStatusBadge,
} from "@/lib/batch-quote-session-status-labels";
import {
  dashItemsTableFilterPanel,
  dashItemsTableHeadPlain,
  dashItemsTableScroll,
  dashItemsTableStatusPanel,
} from "@/lib/app-table-surfaces";
import { displaySiteName } from "@/lib/site-name";
import { batchQuoteSessionBadgeKind } from "@/lib/status-badge-map";
import { compareLocale, compareNum, type SortDir } from "@/lib/table-sort";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

type StatusFilter = "all" | "draft" | "submitted" | "estimated" | "in_cart";
type SortKey = "activity" | "batchNumber" | "status" | "subtotal";

const SELECT_CLASS =
  "h-8 min-w-[9rem] rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type DashboardBatchQuotesSectionProps = {
  bundles: OwnerBatchQuoteSessionBundle[];
};

function ownerBundleActivityMs(b: OwnerBatchQuoteSessionBundle): number {
  const submitted = b.session.submittedAt?.trim()
    ? new Date(b.session.submittedAt).getTime()
    : null;
  if (submitted != null && Number.isFinite(submitted)) return submitted;

  const est = b.latestEstimate?.createdAt?.trim()
    ? new Date(b.latestEstimate.createdAt).getTime()
    : null;
  if (est != null && Number.isFinite(est)) return est;

  return new Date(b.session.createdAt).getTime();
}

function ownerBundleSubtotalCents(b: OwnerBatchQuoteSessionBundle): number {
  return b.latestEstimate?.subtotalCents ?? -1;
}

function haystackForBundleSearch(b: OwnerBatchQuoteSessionBundle): string {
  const parts: string[] = [
    b.session.batchNumber,
    b.session.siteKey,
    b.session.status,
  ];
  for (const r of b.requests) {
    parts.push(
      r.productName ?? "",
      r.productUrl ?? "",
      r.siteName ?? "",
      r.note ?? "",
      r.productSize ?? "",
      r.productColor ?? "",
    );
  }
  for (const ev of b.statusEvents) {
    parts.push(ev.kind, batchQuoteSessionEventKindLabel(ev.kind));
  }
  return parts.join("\n").toLowerCase();
}

export function DashboardBatchQuotesSection({
  bundles,
}: DashboardBatchQuotesSectionProps) {
  const router = useRouter();
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [withdrawingSessionId, setWithdrawingSessionId] = useState<string | null>(
    null
  );
  const [draftSelection, setDraftSelection] = useState<Record<string, string[]>>(
    {}
  );
  const [submitPending, submitStart] = useTransition();
  const [removePending, removeStart] = useTransition();
  const [withdrawPending, withdrawStart] = useTransition();
  const [expandedBySessionId, setExpandedBySessionId] = useState<
    Record<string, boolean>
  >({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("activity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [page, setPage] = useState(1);
  const [findOrganizeVisible, setFindOrganizeVisible] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bundles.filter((b) => {
      if (b.session.status === "paid_pending_staff_purchase") {
        return false;
      }
      if (statusFilter !== "all" && b.session.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return haystackForBundleSearch(b).includes(q);
    });
  }, [bundles, search, statusFilter]);

  const filteredSorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      switch (sortKey) {
        case "batchNumber":
          return compareLocale(
            a.session.batchNumber,
            b.session.batchNumber,
            sortDir
          );
        case "status":
          return compareLocale(a.session.status, b.session.status, sortDir);
        case "subtotal": {
          const ca = ownerBundleSubtotalCents(a);
          const cb = ownerBundleSubtotalCents(b);
          return compareNum(ca, cb, sortDir);
        }
        case "activity":
        default:
          return compareNum(
            ownerBundleActivityMs(a),
            ownerBundleActivityMs(b),
            sortDir
          );
      }
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const pageSlice = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, pageSafe, pageSize]);

  const showFrom =
    filteredSorted.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1;
  const showTo = Math.min(pageSafe * pageSize, filteredSorted.length);

  const cycleSortDir = useCallback(() => {
    setPage(1);
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }, []);

  const isBodyExpanded = (sessionId: string) =>
    expandedBySessionId[sessionId] !== false;

  const toggleBody = (sessionId: string) => {
    setExpandedBySessionId((prev) => {
      const open = prev[sessionId] !== false;
      return { ...prev, [sessionId]: !open };
    });
  };

  const toggleDraftRow = useCallback((sessionId: string, requestId: string) => {
    setDraftSelection((prev) => {
      const cur = new Set(prev[sessionId] ?? []);
      if (cur.has(requestId)) cur.delete(requestId);
      else cur.add(requestId);
      return { ...prev, [sessionId]: [...cur] };
    });
  }, []);

  const setAllDraftRows = useCallback(
    (sessionId: string, requestIds: string[], checked: boolean) => {
      setDraftSelection((prev) => ({
        ...prev,
        [sessionId]: checked ? [...requestIds] : [],
      }));
    },
    []
  );

  const onSubmit = (sessionId: string) => {
    setSubmittingId(sessionId);
    submitStart(async () => {
      const res = await submitCustomerBatchQuoteAction({ batchSessionId: sessionId });
      setSubmittingId(null);
      if (!res.ok) {
        toast.error(res.message ?? "Could not submit batch.");
        return;
      }
      toast.success(res.message ?? "Submitted.");
      router.refresh();
    });
  };

  const onRemoveFromDraft = (
    sessionId: string,
    requestIds: string[]
  ) => {
    if (requestIds.length === 0) return;
    setRemovingId(sessionId);
    removeStart(async () => {
      const res = await removeDraftBatchProductsAction({
        batchSessionId: sessionId,
        itemRequestIds: requestIds,
      });
      setRemovingId(null);
      if (!res.ok) {
        toast.error(res.message ?? "Could not remove from batch.");
        return;
      }
      toast.success(res.message ?? "Updated.");
      setDraftSelection((p) => {
        const next = { ...p, [sessionId]: [] };
        return next;
      });
      router.refresh();
    });
  };

  const withdrawQuotedBatch = (sessionId: string) => {
    setWithdrawingSessionId(sessionId);
    withdrawStart(async () => {
      const finish = () => setWithdrawingSessionId(null);

      const first = await withdrawQuotedBatchSessionAction({
        batchSessionId: sessionId,
      });

      if (first.ok) {
        finish();
        toast.success(first.message ?? "Batch withdrawn.");
        router.refresh();
        return;
      }

      if (first.needsAcknowledgment) {
        const paragraphs: string[] = [];
        if (first.emptyBatch) {
          paragraphs.push(
            "This batch no longer lists any linked products. It will still be deleted."
          );
        }
        if (first.missingQuotesForProducts?.length) {
          const names = first.missingQuotesForProducts;
          const head = names.slice(0, 4).join(", ");
          const tail =
            names.length > 4 ? ` and ${names.length - 4} more product(s)` : "";
          paragraphs.push(
            `Some rows have no staff quote on file (${head}${tail}). You can remove the batch anyway.`
          );
        }
        paragraphs.push(
          "Remove this batch from Batch Quotes and keep working with your lines on the Products tab?"
        );
        if (!window.confirm(paragraphs.join("\n\n"))) {
          finish();
          return;
        }

        const second = await withdrawQuotedBatchSessionAction({
          batchSessionId: sessionId,
          acknowledgeWithdrawalAnomalies: true,
        });

        if (second.ok) {
          finish();
          toast.success(second.message ?? "Batch withdrawn.");
          router.refresh();
          return;
        }
        finish();
        toast.error(second.message ?? "Could not withdraw batch.");
        return;
      }

      finish();
      toast.error(first.message ?? "Could not withdraw batch.");
    });
  };

  if (bundles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No batch quotes yet. On the Products tab, choose two or more quoted items from the
        same retailer, then use Add Batch (you can repeat for another batch from the same site).
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className={dashItemsTableFilterPanel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium text-foreground">Find & organize</p>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="dashboard-batch-quotes-find-organize"
              className="cursor-pointer text-xs font-normal text-muted-foreground"
            >
              Show filters and sort
            </Label>
            <Switch
              id="dashboard-batch-quotes-find-organize"
              checked={findOrganizeVisible}
              onCheckedChange={setFindOrganizeVisible}
            />
          </div>
        </div>

        {findOrganizeVisible ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field className="gap-1.5">
                <FieldLabelWithHelp
                  htmlFor="dashboard-batch-quotes-search"
                  label="Search"
                  help="Matches batch number, site, status, and any line item fields."
                  helpLabel="About Search"
                />
                <FieldContent>
                  <Input
                    id="dashboard-batch-quotes-search"
                    placeholder="Batch #, site key, product name…"
                    value={search}
                    onChange={(e) => {
                      setPage(1);
                      setSearch(e.target.value);
                    }}
                    autoComplete="off"
                  />
                </FieldContent>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel
                  htmlFor="dashboard-batch-quotes-status"
                  className="text-xs"
                >
                  Status
                </FieldLabel>
                <FieldContent>
                  <select
                    id="dashboard-batch-quotes-status"
                    className={SELECT_CLASS}
                    value={statusFilter}
                    onChange={(e) => {
                      setPage(1);
                      setStatusFilter(e.target.value as StatusFilter);
                    }}
                  >
                    <option value="all">All</option>
                    <option value="draft">Draft</option>
                    <option value="submitted">New batch request</option>
                    <option value="estimated">Quoted (batch)</option>
                    <option value="in_cart">In Cart</option>
                  </select>
                </FieldContent>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel
                  htmlFor="dashboard-batch-quotes-sort"
                  className="text-xs"
                >
                  Sort by
                </FieldLabel>
                <FieldContent>
                  <div className="flex flex-wrap gap-2">
                    <select
                      id="dashboard-batch-quotes-sort"
                      className={cn(SELECT_CLASS, "min-w-[11rem] flex-1")}
                      value={sortKey}
                      onChange={(e) => {
                        setPage(1);
                        setSortKey(e.target.value as SortKey);
                      }}
                    >
                      <option value="activity">Last activity</option>
                      <option value="batchNumber">Batch number</option>
                      <option value="status">Status</option>
                      <option value="subtotal">Estimate subtotal</option>
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={cycleSortDir}
                      aria-label={
                        sortDir === "asc"
                          ? "Sort ascending; click for descending"
                          : "Sort descending; click for ascending"
                      }
                    >
                      {sortDir === "asc" ? "Asc ↑" : "Desc ↓"}
                    </Button>
                  </div>
                </FieldContent>
              </Field>

              <Field className="gap-1.5 sm:col-span-2 lg:col-span-1">
                <FieldLabel
                  htmlFor="dashboard-batch-quotes-page-size"
                  className="text-xs"
                >
                  Per page
                </FieldLabel>
                <FieldContent>
                  <select
                    id="dashboard-batch-quotes-page-size"
                    className={SELECT_CLASS}
                    value={pageSize}
                    onChange={(e) => {
                      setPage(1);
                      setPageSize(
                        Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]
                      );
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </FieldContent>
              </Field>
            </div>

            <p className="text-xs text-muted-foreground">
              {filteredSorted.length === 0 ? (
                <>No batches match the current search or filters.</>
              ) : (
                <>
                  Showing{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {showFrom}–{showTo}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {filteredSorted.length}
                  </span>{" "}
                  batch{filteredSorted.length === 1 ? "" : "es"}
                  {filteredSorted.length < bundles.length ? (
                    <>
                      {" "}
                      (<span className="tabular-nums">{bundles.length}</span>{" "}
                      total)
                    </>
                  ) : null}
                </>
              )}
            </p>
          </>
        ) : null}
      </div>

      {filteredSorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Try clearing the search box or setting status to{" "}
          <span className="font-medium text-foreground">All</span>.
        </p>
      ) : null}

      {pageSlice.map(({ session, requests, latestEstimate, statusEvents }) => {
        const isDraft = session.status === "draft";
        const ids = requests.map((r) => r.id);
        const inCart =
          session.status === "in_cart" ||
          Boolean(session.cartAcceptanceAcceptedAt);
        const quotedLike =
          session.status === "estimated" || session.status === "in_cart";
        const selected = draftSelection[session.id] ?? [];
        const selSet = new Set(selected);
        const allSelected =
          isDraft &&
          ids.length > 0 &&
          ids.every((id) => selSet.has(id));
        const someSelected = selected.length > 0;
        const bodyOpen = isBodyExpanded(session.id);

        return (
          <section
            key={session.id}
            className={dashItemsTableFilterPanel}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-1 sm:gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-expanded={bodyOpen}
                  aria-controls={`batch-${session.id}-body`}
                  aria-label={
                    bodyOpen ? "Collapse batch details" : "Expand batch details"
                  }
                  id={`batch-${session.id}-toggle`}
                  onClick={() => toggleBody(session.id)}
                >
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform duration-200",
                      bodyOpen ? "rotate-180" : "rotate-0",
                    )}
                    aria-hidden
                  />
                </Button>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Batch number:{" "}
                    <span className="font-mono text-primary">{session.batchNumber}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Site key:{" "}
                    <span className="font-medium text-foreground">{session.siteKey}</span>
                    {" · "}
                    <StatusBadge kind={batchQuoteSessionBadgeKind(session.status)}>
                      {ownerBatchQuoteSessionStatusBadge(session.status)}
                    </StatusBadge>
                  </p>
                  {latestEstimate ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Staff estimate subtotal:{" "}
                      <span className="font-medium text-foreground">
                        {formatUsd(latestEstimate.subtotalCents)}
                      </span>
                      {" · "}Saved{" "}
                      <time dateTime={latestEstimate.createdAt}>
                        {new Date(latestEstimate.createdAt).toLocaleString()}
                      </time>
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isDraft ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        !someSelected ||
                        removePending ||
                        submitPending
                      }
                      className={cn(someSelected && "border-destructive/45 text-destructive")}
                      onClick={() =>
                        onRemoveFromDraft(session.id, selected)
                      }
                    >
                      {removePending && removingId === session.id ? (
                        <>
                          <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                          Removing…
                        </>
                      ) : (
                        "Remove from batch"
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={removePending || submitPending}
                      onClick={() => onSubmit(session.id)}
                    >
                      {submitPending && submittingId === session.id ? (
                        <>
                          <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                          Sending…
                        </>
                      ) : (
                        "Submit batch request"
                      )}
                    </Button>
                  </>
                ) : null}
                {quotedLike ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {latestEstimate ? (
                      <>
                        <BatchEstimatePreviewDialog
                          batchSessionId={session.id}
                          batchNumber={session.batchNumber}
                          siteKey={session.siteKey}
                          estimate={latestEstimate}
                        />
                        {session.status === "estimated" && !inCart ? (
                          <AcceptBatchQuoteButton batchSessionId={session.id} />
                        ) : null}
                      </>
                    ) : null}
                    {session.status === "estimated" && !inCart ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          withdrawPending ||
                          submitPending ||
                          removePending
                        }
                        className="border-muted-foreground/35 text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() => withdrawQuotedBatch(session.id)}
                      >
                        {withdrawPending &&
                        withdrawingSessionId === session.id ? (
                          <>
                            <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                            Withdrawing…
                          </>
                        ) : (
                          "Withdraw batch"
                        )}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div
              id={`batch-${session.id}-body`}
              role="region"
              aria-labelledby={`batch-${session.id}-toggle`}
              hidden={!bodyOpen}
              className={cn(bodyOpen && "space-y-3")}
            >
            {isDraft ? (
              <p className="max-w-xl text-xs text-muted-foreground">
                Select rows and remove them to send those products back to the Products tab.
                If fewer than two products stay in this draft, the batch is closed
                automatically.
              </p>
            ) : null}

            <FloatingHorizontalScroll viewportClassName={dashItemsTableScroll}>
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className={dashItemsTableHeadPlain}>
                  <tr>
                    {isDraft ? (
                      <th className="w-10 px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-input"
                          checked={allSelected}
                          aria-label={`Select every product in batch ${session.batchNumber}`}
                          onChange={(e) =>
                            setAllDraftRows(session.id, ids, e.target.checked)
                          }
                        />
                      </th>
                    ) : null}
                    <th className="px-3 py-2 font-medium">Photo</th>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Site</th>
                    <th className="px-3 py-2 font-medium">Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requests.map((r: ItemRequest) => (
                    <tr key={r.id}>
                      {isDraft ? (
                        <td className="px-2 py-2 text-center align-top">
                          <input
                            type="checkbox"
                            className="rounded border-input"
                            checked={selSet.has(r.id)}
                            aria-label={`Select ${r.productName ?? "product"} to remove from batch`}
                            onChange={() => toggleDraftRow(session.id, r.id)}
                          />
                        </td>
                      ) : null}
                      <td className="px-3 py-2">
                        <ProductRequestThumbnail
                          variant="list"
                          imageUrl={r.productImageUrl}
                          productLabel={r.productName}
                        />
                      </td>
                      <td className="max-w-[12rem] px-3 py-2 font-medium text-foreground">
                        <span className="line-clamp-2">
                          {r.productName?.trim() || "Unnamed product"}
                        </span>
                      </td>
                      <td className="max-w-[8rem] px-3 py-2 text-xs text-muted-foreground">
                        {displaySiteName(r.siteName, r.productUrl)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <a
                          href={r.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Product url
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FloatingHorizontalScroll>

            {statusEvents.length > 0 ? (
              <div className={dashItemsTableStatusPanel}>
                <p className="mb-2 text-xs font-medium text-foreground">Status history</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {statusEvents.map((ev) => (
                    <li key={ev.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
                      <time
                        dateTime={ev.createdAt}
                        className="shrink-0 font-mono text-[11px] text-foreground/80"
                      >
                        {new Date(ev.createdAt).toLocaleString()}
                      </time>
                      <span className="text-foreground">
                        {batchQuoteSessionEventKindLabel(ev.kind)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {session.status === "submitted" ? (
              <p className="text-xs text-muted-foreground">
                Staff will review this batch under Admin → Item requests → Batch Items.
              </p>
            ) : null}

            {session.status === "estimated" && !inCart ? (
              <p className="text-xs text-muted-foreground">
                Use <span className="font-medium text-foreground">Preview estimate</span> for line
                items and totals, or <span className="font-medium text-foreground">Accept estimate</span>{" "}
                to add every quoted line to your cart.{" "}
                <span className="font-medium text-foreground">Withdraw batch</span> removes this
                bundle from Batch Quotes; your products stay listed on Products. Audit copies remain
                under Product history → Audit trail.
                {latestEstimate ? null : (
                  <>
                    {" "}
                    Preview and accept require a saved staff estimate row—contact support if this
                    batch looks stuck without one.
                  </>
                )}
              </p>
            ) : null}

            {quotedLike && latestEstimate && inCart ? (
              <p className="text-xs text-muted-foreground">
                This bundle is in your{" "}
                <Link
                  href="/dashboard/cart"
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  Cart
                </Link>
                {" "}with the combined staff total.
              </p>
            ) : null}
            </div>
          </section>
        );
      })}

      {filteredSorted.length > 0 ? (
        <div className="flex flex-col items-stretch gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Page{" "}
            <span className="font-medium tabular-nums text-foreground">
              {pageSafe}
            </span>{" "}
            of{" "}
            <span className="font-medium tabular-nums text-foreground">
              {totalPages}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageSafe <= 1}
              onClick={() => setPage(pageSafe - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage(pageSafe + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
