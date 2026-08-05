"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  clearProductQuoteExpirySettingsAction,
  searchQuotedProductsForExpiryAction,
  upsertProductQuoteExpirySettingsAction,
} from "@/actions/product-quote-expiry-settings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AdminProfilePickerRow } from "@/data/customer-pricing-packages";
import type { AdminQuotedProductExpiryRow } from "@/data/quote-expiry-settings";
import {
  formatQuoteExpiryWindowLabel,
  MAX_QUOTE_EXPIRY_MINUTES,
  MIN_QUOTE_EXPIRY_MINUTES,
  preferredDurationUnit,
  type QuoteExpiryDurationUnit,
} from "@/lib/quote-expiry";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type AdminProductQuoteExpiryPanelProps = {
  users: AdminProfilePickerRow[];
  initialOverrides: AdminQuotedProductExpiryRow[];
  globalExpiryMinutes: number;
  selectedClerkUserId?: string;
};

function sourceLabel(source: AdminQuotedProductExpiryRow["effectiveSource"]) {
  if (source === "product") return "Product override";
  if (source === "customer") return "Customer override";
  return "Hub default";
}

export function AdminProductQuoteExpiryPanel({
  users,
  initialOverrides,
  globalExpiryMinutes,
  selectedClerkUserId,
}: AdminProductQuoteExpiryPanelProps) {
  const router = useRouter();
  const [customerFilter, setCustomerFilter] = useState("");
  const [clerkUserId, setClerkUserId] = useState(selectedClerkUserId ?? "");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminQuotedProductExpiryRow[]>(initialOverrides);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Local unlock after Revive — form enabled until Publish restores the window. */
  const [revivedIds, setRevivedIds] = useState<Set<string>>(() => new Set());
  const [amount, setAmount] = useState("7");
  const [unit, setUnit] = useState<QuoteExpiryDurationUnit>("days");
  const [pending, startTransition] = useTransition();
  const [searching, startSearch] = useTransition();

  const selected = rows.find((r) => r.itemRequestId === selectedId) ?? null;
  const selectedExpired = Boolean(selected?.quoteExpired);
  const selectedRevived =
    selected != null && revivedIds.has(selected.itemRequestId);
  const selectedLocked = selectedExpired && !selectedRevived;

  const filteredUsers = useMemo(() => {
    const q = customerFilter.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        u.clerkUserId.toLowerCase().includes(q),
    );
  }, [users, customerFilter]);

  useEffect(() => {
    setClerkUserId(selectedClerkUserId ?? "");
  }, [selectedClerkUserId]);

  useEffect(() => {
    setRows(initialOverrides);
    setRevivedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        const row = initialOverrides.find((r) => r.itemRequestId === id);
        if (row?.quoteExpired) next.add(id);
      }
      return next;
    });
  }, [initialOverrides]);

  useEffect(() => {
    if (!selected) return;
    const next = preferredDurationUnit(
      selected.productOverrideMinutes ?? selected.effectiveExpiryMinutes,
    );
    setAmount(String(next.amount));
    setUnit(next.unit);
  }, [selectedId, selected?.productOverrideMinutes, selected?.effectiveExpiryMinutes]);

  function selectCustomer(nextClerkUserId: string) {
    setClerkUserId(nextClerkUserId);
    const params = new URLSearchParams();
    params.set("tab", "quote-expiry");
    params.set("expiryTab", "product");
    if (nextClerkUserId) params.set("userId", nextClerkUserId);
    router.push(`/admin/overview?${params.toString()}`);
  }

  function runSearch(nextQuery = query, nextClerkUserId = clerkUserId) {
    startSearch(async () => {
      const res = await searchQuotedProductsForExpiryAction({
        query: nextQuery,
        clerkUserId: nextClerkUserId || null,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setRows(res.rows);
      setRevivedIds((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          const row = res.rows.find((r) => r.itemRequestId === id);
          if (row?.quoteExpired) next.add(id);
        }
        return next;
      });
      if (
        selectedId &&
        !res.rows.some((r) => r.itemRequestId === selectedId)
      ) {
        setSelectedId(null);
      }
    });
  }

  function handleRevive(itemRequestId: string) {
    setSelectedId(itemRequestId);
    setRevivedIds((prev) => new Set(prev).add(itemRequestId));
    toast.message("Revived in this table. Set the window, then Publish to restore Active.");
  }

  function handlePublish(itemRequestId?: string) {
    // onClick may pass a MouseEvent — only treat real UUID strings as ids.
    const targetId =
      typeof itemRequestId === "string" && itemRequestId.length > 0
        ? itemRequestId
        : selectedId;
    if (!targetId) {
      toast.error("Select a quoted product first.");
      return;
    }
    const row = rows.find((r) => r.itemRequestId === targetId);
    if (!row) {
      toast.error("Select a quoted product first.");
      return;
    }
    const wasExpired = row.quoteExpired;
    const useFormValues = selectedId === targetId;
    const fromRow = preferredDurationUnit(
      row.productOverrideMinutes ?? row.effectiveExpiryMinutes,
    );
    const publishAmount = useFormValues
      ? Number.parseInt(amount, 10)
      : fromRow.amount;
    const publishUnit = useFormValues ? unit : fromRow.unit;
    startTransition(async () => {
      const res = await upsertProductQuoteExpirySettingsAction({
        itemRequestId: targetId,
        amount: publishAmount,
        unit: publishUnit,
        restoreToActive: wasExpired,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setRevivedIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      runSearch(query, clerkUserId);
      router.refresh();
    });
  }

  function handleClear() {
    if (!selectedId) return;
    startTransition(async () => {
      const res = await clearProductQuoteExpirySettingsAction({
        itemRequestId: selectedId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setRevivedIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedId);
        return next;
      });
      runSearch(query, clerkUserId);
      router.refresh();
    });
  }

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle>Product override</CardTitle>
        <CardDescription>
          Find a customer and/or search their quoted products, then set a custom
          accept/pay window for that line. The countdown starts when you publish
          (not from the original quote time). Expired rows turn red — Revive to
          edit the window, then Publish to move the product from Expired Quotes
          back to Active. Hub default is{" "}
          {formatQuoteExpiryWindowLabel(globalExpiryMinutes)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="quote-expiry-customer-filter">
              Find customer
            </FieldLabel>
            <FieldContent>
              <Input
                id="quote-expiry-customer-filter"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                placeholder="Name, email, or Clerk id…"
                disabled={pending || searching}
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="quote-expiry-customer-select">
              Customer
            </FieldLabel>
            <FieldContent>
              <select
                id="quote-expiry-customer-select"
                className={cn(SELECT_CLASS, "w-full min-w-0")}
                value={clerkUserId}
                disabled={pending || searching}
                onChange={(e) => {
                  const id = e.target.value;
                  selectCustomer(id);
                  runSearch(query, id);
                }}
              >
                <option value="">All customers</option>
                {filteredUsers.map((u) => (
                  <option key={u.clerkUserId} value={u.clerkUserId}>
                    {u.displayName}
                    {u.email ? ` (${u.email})` : ""}
                  </option>
                ))}
              </select>
            </FieldContent>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="quote-expiry-product-search">
            Search quoted products
          </FieldLabel>
          <FieldContent>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="quote-expiry-product-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runSearch();
                  }
                }}
                placeholder="Product name, URL, site, OP ref…"
                className="max-w-md"
                disabled={pending || searching}
              />
              <Button
                type="button"
                variant="outline"
                disabled={pending || searching}
                onClick={() => runSearch()}
              >
                {searching ? "Searching…" : "Search"}
              </Button>
              {clerkUserId || query ?
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending || searching}
                  onClick={() => {
                    setQuery("");
                    setCustomerFilter("");
                    selectCustomer("");
                    runSearch("", "");
                  }}
                >
                  Clear filters
                </Button>
              : null}
            </div>
          </FieldContent>
        </Field>

        <div className="overflow-x-auto rounded-md border border-border/70">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                <th className="px-2 py-2 font-medium">Product</th>
                <th className="px-2 py-2 font-medium">Customer</th>
                <th className="px-2 py-2 font-medium">Effective window</th>
                <th className="px-2 py-2 font-medium">Source</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ?
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No quoted products matched. Try another customer or search.
                  </td>
                </tr>
              : rows.map((row) => {
                  const active = row.itemRequestId === selectedId;
                  const revived = revivedIds.has(row.itemRequestId);
                  const showExpired = row.quoteExpired && !revived;
                  return (
                    <tr
                      key={row.itemRequestId}
                      className={cn(
                        "cursor-pointer hover:bg-muted/40",
                        active && !showExpired && "bg-primary/10",
                        showExpired &&
                          "bg-destructive/15 hover:bg-destructive/20",
                        showExpired && active && "bg-destructive/25",
                        revived && row.quoteExpired && "bg-muted/50",
                      )}
                      onClick={() => setSelectedId(row.itemRequestId)}
                    >
                      <td className="px-2 py-2 align-top">
                        <p
                          className={cn(
                            "font-medium line-clamp-2",
                            showExpired ? "text-destructive" : "text-foreground",
                          )}
                        >
                          {row.productName?.trim() || "Unnamed product"}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {row.siteName || row.productUrl}
                        </p>
                        {showExpired ?
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                            Expired
                          </p>
                        : null}
                        {revived && row.quoteExpired ?
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Revived — publish to restore Active
                          </p>
                        : null}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <p className="text-foreground">{row.customerDisplayName}</p>
                        {row.customerEmail ?
                          <p className="text-xs text-muted-foreground">
                            {row.customerEmail}
                          </p>
                        : null}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-2 align-top tabular-nums",
                          showExpired &&
                            "text-muted-foreground/50 line-through opacity-60",
                        )}
                      >
                        {formatQuoteExpiryWindowLabel(row.effectiveExpiryMinutes)}
                        {showExpired ?
                          <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-destructive/80 no-underline">
                            Window ended
                          </span>
                        : null}
                      </td>
                      <td className="px-2 py-2 align-top text-xs text-muted-foreground">
                        {sourceLabel(row.effectiveSource)}
                      </td>
                      <td className="px-2 py-2 align-top">
                        {row.quoteExpired && !revived ?
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRevive(row.itemRequestId);
                            }}
                          >
                            Revive
                          </Button>
                        : null}
                        {row.quoteExpired && revived ?
                          <Button
                            type="button"
                            size="sm"
                            disabled={pending}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(row.itemRequestId);
                              handlePublish(row.itemRequestId);
                            }}
                          >
                            Publish
                          </Button>
                        : null}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {selected ?
          <div
            className={cn(
              "space-y-3 rounded-md border p-3",
              selectedLocked
                ? "border-destructive/40 bg-destructive/5"
                : "border-border/70 bg-muted/20",
            )}
          >
            <p className="text-sm font-medium text-foreground">
              Set window for{" "}
              <span className="text-primary">
                {selected.productName?.trim() || "Unnamed product"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Fallback without product override:{" "}
              {formatQuoteExpiryWindowLabel(selected.accountExpiryMinutes)} (
              {selected.accountSource === "customer"
                ? "customer override"
                : "hub default"}
              ).
              {selected.productOverrideMinutes != null ?
                <>
                  {" "}
                  Current product override:{" "}
                  {formatQuoteExpiryWindowLabel(selected.productOverrideMinutes)}.
                </>
              : null}
              {selectedLocked ?
                <> This quote window has expired. Revive to edit, then Publish to restore Active.</>
              : null}
              {selectedRevived ?
                <> Revived here — adjust the window if needed, then Publish to move it from Expired Quotes to Active.</>
              : null}
            </p>
            <Field
              className={cn("gap-1.5", selectedLocked && "pointer-events-none opacity-45")}
            >
              <FieldLabel htmlFor="quote-expiry-product-amount">
                Time until quote expires
              </FieldLabel>
              <FieldContent>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="quote-expiry-product-amount"
                    type="number"
                    min={1}
                    step={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="max-w-[10rem] tabular-nums"
                    disabled={pending || selectedLocked}
                    aria-disabled={selectedLocked}
                  />
                  <select
                    aria-label="Product expiry duration unit"
                    className={SELECT_CLASS}
                    value={unit}
                    disabled={pending || selectedLocked}
                    onChange={(e) =>
                      setUnit(e.target.value as QuoteExpiryDurationUnit)
                    }
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  From {MIN_QUOTE_EXPIRY_MINUTES} minute to 90 days (
                  {MAX_QUOTE_EXPIRY_MINUTES.toLocaleString()} minutes). Starts
                  when you publish this override.
                </p>
              </FieldContent>
            </Field>
            <div className="flex flex-wrap gap-2">
              {selectedLocked ?
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => handleRevive(selected.itemRequestId)}
                >
                  Revive
                </Button>
              : (
                <Button type="button" disabled={pending} onClick={handlePublish}>
                  {pending
                    ? "Saving…"
                    : selectedRevived
                      ? "Publish to Active"
                      : "Publish product override"}
                </Button>
              )}
              {selected.productOverrideMinutes != null && !selectedLocked ?
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleClear}
                >
                  Clear product override
                </Button>
              : null}
            </div>
          </div>
        : (
          <p className="text-xs text-muted-foreground">
            Select a row above to assign a per-product expiry window.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
