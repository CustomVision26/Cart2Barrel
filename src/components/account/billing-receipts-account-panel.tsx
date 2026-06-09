"use client";

import { Download, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { getCustomerBillingReceiptsAction } from "@/actions/get-customer-billing-receipts";
import type {
  BillingReceiptScope,
  CustomerBillingReceiptRecord,
} from "@/lib/billing-receipt-types";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

/** Self-contained dark surface — Clerk modal does not reliably inherit app theme tokens. */
const panelClass = {
  root: "billing-receipts-account-panel space-y-4 text-zinc-100",
  heading: "text-base font-semibold text-zinc-50",
  description: "mt-1 text-sm text-zinc-400",
  label: "text-xs font-medium text-zinc-200",
  field:
    "h-8 w-full min-w-0 rounded-lg border border-zinc-600 bg-zinc-800 px-2.5 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus-visible:border-sky-500 focus-visible:ring-3 focus-visible:ring-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50",
  select:
    "h-8 w-full min-w-0 appearance-none rounded-lg border border-zinc-600 bg-zinc-800 px-2.5 pr-8 text-sm text-zinc-100 outline-none transition-colors focus-visible:border-sky-500 focus-visible:ring-3 focus-visible:ring-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50",
  muted: "text-sm text-zinc-400",
  mutedXs: "text-xs text-zinc-400",
  badge:
    "inline-flex rounded-full border border-zinc-600 bg-zinc-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-100",
  list: "max-h-[min(52vh,28rem)] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900/60",
  row: "flex flex-col gap-2 border-b border-zinc-700/80 px-3 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between",
  title: "text-sm font-medium text-zinc-50",
  meta: "font-mono text-[11px] text-zinc-400",
  amount: "text-sm font-semibold tabular-nums text-zinc-50",
  link: "inline-flex items-center gap-1 rounded-md border border-sky-500/50 bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-300 underline-offset-2 transition-colors hover:border-sky-400/60 hover:bg-sky-500/25 hover:text-sky-200",
  linkSecondary:
    "inline-flex items-center gap-1 rounded-md border border-zinc-600 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-700 hover:text-zinc-50",
  empty:
    "rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-6 text-center text-sm text-zinc-400",
  error:
    "rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-4 text-sm text-red-300",
} as const;

type ScopeFilter = "all" | BillingReceiptScope;

function paymentInvoiceHref(
  orderId: string,
  disposition: "inline" | "attachment",
): string {
  const params = new URLSearchParams({
    orderId,
    format: "pdf",
    disposition,
  });
  return `/api/dashboard/payment-invoice?${params.toString()}`;
}

function paymentInvoiceHtmlHref(orderId: string): string {
  const params = new URLSearchParams({
    orderId,
    format: "html",
  });
  return `/api/dashboard/payment-invoice?${params.toString()}`;
}

function prorationReceiptHref(stripeRefundId: string): string {
  return `/api/dashboard/stripe-refund-receipt?stripeRefundId=${encodeURIComponent(stripeRefundId)}`;
}

function prorationReceiptHrefForRecord(
  record: CustomerBillingReceiptRecord,
): string | null {
  if (record.category === "proration" && record.stripeRefundId?.trim()) {
    return prorationReceiptHref(record.stripeRefundId.trim());
  }
  return null;
}

function scopeLabel(scope: BillingReceiptScope): string {
  switch (scope) {
    case "order":
      return "Order";
    case "single":
      return "Single product";
    case "batch":
      return "Batch";
  }
}

function categoryLabel(category: CustomerBillingReceiptRecord["category"]): string {
  return category === "payment" ? "Checkout" : "Proration";
}

function matchesSearch(record: CustomerBillingReceiptRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return record.searchHaystack.includes(q);
}

function ReceiptBadge({ children }: { children: string }) {
  return <span className={panelClass.badge}>{children}</span>;
}

function BillingReceiptRow({ record }: { record: CustomerBillingReceiptRecord }) {
  const isPayment = record.category === "payment" && Boolean(record.orderId);
  const prorationHref = prorationReceiptHrefForRecord(record);

  return (
    <li className={panelClass.row}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={panelClass.title}>{record.label}</p>
          <ReceiptBadge>{scopeLabel(record.scope)}</ReceiptBadge>
          <ReceiptBadge>{categoryLabel(record.category)}</ReceiptBadge>
        </div>
        {record.subtitle ?
          <p className={panelClass.mutedXs}>{record.subtitle}</p>
        : null}
        <p className={panelClass.meta} title={record.orderId}>
          Order {record.orderId.slice(0, 8)}…
        </p>
        <time dateTime={record.createdAt} className={cn("block", panelClass.mutedXs)}>
          {new Date(record.createdAt).toLocaleString()}
        </time>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
        <p className={panelClass.amount}>{formatUsd(record.amountCents)}</p>
        {isPayment ?
          <div className="flex flex-wrap items-center justify-end gap-2">
            <a
              href={paymentInvoiceHref(record.orderId, "inline")}
              target="_blank"
              rel="noopener noreferrer"
              className={panelClass.link}
            >
              View PDF
              <ExternalLink className="size-3 shrink-0" aria-hidden />
            </a>
            <a
              href={paymentInvoiceHref(record.orderId, "attachment")}
              className={panelClass.linkSecondary}
            >
              Download PDF
              <Download className="size-3 shrink-0" aria-hidden />
            </a>
            <a
              href={paymentInvoiceHtmlHref(record.orderId)}
              target="_blank"
              rel="noopener noreferrer"
              className={panelClass.linkSecondary}
            >
              View invoice
            </a>
          </div>
        : prorationHref ?
          <a
            href={prorationHref}
            target="_blank"
            rel="noopener noreferrer"
            className={panelClass.link}
          >
            View Stripe receipt
            <ExternalLink className="size-3 shrink-0" aria-hidden />
          </a>
        : (
          <span className={panelClass.mutedXs}>Receipt unavailable</span>
        )}
      </div>
    </li>
  );
}

export function BillingReceiptsAccountPanel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [records, setRecords] = useState<CustomerBillingReceiptRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");

  useEffect(() => {
    const root = rootRef.current;
    if (!root || visible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || loaded) return;

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      const result = await getCustomerBillingReceiptsAction();
      if (cancelled) return;
      if (!result.ok) {
        setRecords([]);
        setError(result.message);
        setLoading(false);
        setLoaded(true);
        return;
      }
      setRecords(result.records);
      setLoading(false);
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, loaded]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (scopeFilter !== "all" && record.scope !== scopeFilter) {
        return false;
      }
      return matchesSearch(record, search);
    });
  }, [records, scopeFilter, search]);

  return (
    <div ref={rootRef} className={panelClass.root}>
      <div>
        <h2 className={panelClass.heading}>Billing receipts</h2>
        <p className={panelClass.description}>
          View or download PDF invoices for checkout payments. Proration refunds still open
          Stripe-hosted receipts when available.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="billing-receipts-search" className={panelClass.label}>
            Search
          </label>
          <input
            id="billing-receipts-search"
            type="search"
            className={panelClass.field}
            placeholder="Order id, product, batch #, Stripe ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="billing-receipts-scope" className={panelClass.label}>
            Show
          </label>
          <select
            id="billing-receipts-scope"
            className={panelClass.select}
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}
          >
            <option value="all">All receipts</option>
            <option value="order">Order checkout</option>
            <option value="single">Single product</option>
            <option value="batch">Batch</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="billing-receipts-sort" className={panelClass.label}>
            Sort
          </label>
          <select
            id="billing-receipts-sort"
            className={panelClass.select}
            value="newest"
            disabled
            aria-readonly
          >
            <option value="newest">Newest to oldest</option>
          </select>
        </div>
      </div>

      { !visible && !loaded ?
        <p className={panelClass.empty}>Receipts load when you open this tab.</p>
      : loading ?
        <p className={panelClass.empty}>Loading receipts…</p>
      : error ?
        <p className={panelClass.error}>{error}</p>
      : filteredRecords.length === 0 ?
        <p className={panelClass.empty}>
          {records.length === 0 ?
            "No billing receipts yet. Receipts appear here after you pay for an order or receive a proration refund."
          : "No receipts match your search or filter."}
        </p>
      : (
        <>
          <p className={panelClass.mutedXs}>
            {filteredRecords.length}{" "}
            {filteredRecords.length === 1 ? "receipt" : "receipts"} · sorted newest first
          </p>
          <ul className={panelClass.list}>
            {filteredRecords.map((record) => (
              <BillingReceiptRow key={record.id} record={record} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
