"use client";

import { ExternalLink, ReceiptText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getCustomerBillingReceiptsAction } from "@/actions/get-customer-billing-receipts";
import { Input } from "@/components/ui/input";
import type {
  BillingReceiptScope,
  CustomerBillingReceiptRecord,
} from "@/data/customer-billing-receipts";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "h-8 min-w-[9rem] rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type ScopeFilter = "all" | BillingReceiptScope;

function paymentReceiptHref(orderId: string): string {
  return `/api/dashboard/stripe-payment-receipt?orderId=${encodeURIComponent(orderId)}`;
}

function prorationReceiptHref(stripeRefundId: string): string {
  return `/api/dashboard/stripe-refund-receipt?stripeRefundId=${encodeURIComponent(stripeRefundId)}`;
}

function receiptHref(record: CustomerBillingReceiptRecord): string | null {
  if (record.category === "payment" && record.orderId) {
    return paymentReceiptHref(record.orderId);
  }
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

function BillingReceiptRow({ record }: { record: CustomerBillingReceiptRecord }) {
  const href = receiptHref(record);

  return (
    <li className="flex flex-col gap-2 border-b border-border px-1 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{record.label}</p>
          <span className="inline-flex rounded-full border border-border/80 bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {scopeLabel(record.scope)}
          </span>
          <span className="inline-flex rounded-full border border-border/80 bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {categoryLabel(record.category)}
          </span>
        </div>
        {record.subtitle ?
          <p className="text-xs text-muted-foreground">{record.subtitle}</p>
        : null}
        <p className="font-mono text-[10px] text-muted-foreground" title={record.orderId}>
          Order {record.orderId.slice(0, 8)}…
        </p>
        <time dateTime={record.createdAt} className="block text-xs text-muted-foreground">
          {new Date(record.createdAt).toLocaleString()}
        </time>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {formatUsd(record.amountCents)}
        </p>
        {href ?
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            View receipt
            <ExternalLink className="size-3 shrink-0" aria-hidden />
          </a>
        : (
          <span className="text-xs text-muted-foreground">Receipt unavailable</span>
        )}
      </div>
    </li>
  );
}

export function BillingReceiptsAccountPanel() {
  const [records, setRecords] = useState<CustomerBillingReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");

  useEffect(() => {
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
        return;
      }
      setRecords(result.records);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (scopeFilter !== "all" && record.scope !== scopeFilter) {
        return false;
      }
      return matchesSearch(record, search);
    });
  }, [records, scopeFilter, search]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Billing receipts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Download or view Stripe invoices for checkout payments and proration refunds.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="billing-receipts-search" className="text-xs font-medium text-foreground">
            Search
          </label>
          <Input
            id="billing-receipts-search"
            placeholder="Order id, product, batch #, Stripe ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="billing-receipts-scope" className="text-xs font-medium text-foreground">
            Show
          </label>
          <select
            id="billing-receipts-scope"
            className={cn(SELECT_CLASS, "w-full")}
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
          <label htmlFor="billing-receipts-sort" className="text-xs font-medium text-foreground">
            Sort
          </label>
          <select
            id="billing-receipts-sort"
            className={cn(SELECT_CLASS, "w-full")}
            value="newest"
            disabled
            aria-readonly
          >
            <option value="newest">Newest to oldest</option>
          </select>
        </div>
      </div>

      {loading ?
        <p className="rounded-lg border border-border bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
          Loading receipts…
        </p>
      : error ?
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-4 text-sm text-destructive">
          {error}
        </p>
      : filteredRecords.length === 0 ?
        <p className="rounded-lg border border-border bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
          {records.length === 0 ?
            "No billing receipts yet. Receipts appear here after you pay for an order or receive a proration refund."
          : "No receipts match your search or filter."}
        </p>
      : (
        <>
          <p className="text-xs text-muted-foreground">
            {filteredRecords.length}{" "}
            {filteredRecords.length === 1 ? "receipt" : "receipts"} · sorted newest first
          </p>
          <ul className="max-h-[min(52vh,28rem)] overflow-y-auto rounded-lg border border-border">
            {filteredRecords.map((record) => (
              <BillingReceiptRow key={record.id} record={record} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function BillingReceiptsAccountIcon() {
  return <ReceiptText className="size-4 shrink-0" aria-hidden />;
}
