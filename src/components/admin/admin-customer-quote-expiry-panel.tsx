"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteCustomerQuoteExpirySettingsAction,
  upsertCustomerQuoteExpirySettingsAction,
} from "@/actions/customer-quote-expiry-settings";
import { AdminConfirmDialog } from "@/components/admin/admin-confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AdminProfilePickerRow } from "@/data/customer-pricing-packages";
import type { CustomerQuoteExpiryOverrideRow } from "@/data/quote-expiry-settings";
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

type AdminCustomerQuoteExpiryPanelProps = {
  users: AdminProfilePickerRow[];
  overrides: CustomerQuoteExpiryOverrideRow[];
  selectedClerkUserId?: string;
  globalExpiryMinutes: number;
  selectedOverrideMinutes: number | null;
};

export function AdminCustomerQuoteExpiryPanel({
  users,
  overrides,
  selectedClerkUserId,
  globalExpiryMinutes,
  selectedOverrideMinutes,
}: AdminCustomerQuoteExpiryPanelProps) {
  const router = useRouter();
  const [userFilter, setUserFilter] = useState("");
  const initialMinutes = selectedOverrideMinutes ?? globalExpiryMinutes;
  const initial = useMemo(
    () => preferredDurationUnit(initialMinutes),
    [initialMinutes],
  );
  const [amount, setAmount] = useState(String(initial.amount));
  const [unit, setUnit] = useState<QuoteExpiryDurationUnit>(initial.unit);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const next = preferredDurationUnit(initialMinutes);
    setAmount(String(next.amount));
    setUnit(next.unit);
  }, [initialMinutes, selectedClerkUserId]);

  const filteredUsers = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        u.clerkUserId.toLowerCase().includes(q),
    );
  }, [users, userFilter]);

  const selectedUser = users.find((u) => u.clerkUserId === selectedClerkUserId);
  const overrideUserIds = useMemo(
    () => new Set(overrides.map((o) => o.clerkUserId)),
    [overrides],
  );

  function selectUser(clerkUserId: string) {
    const params = new URLSearchParams();
    params.set("tab", "quote-expiry");
    params.set("expiryTab", "customer");
    if (clerkUserId) params.set("userId", clerkUserId);
    router.push(`/admin/overview?${params.toString()}`);
  }

  function syncFormFromMinutes(minutes: number) {
    const next = preferredDurationUnit(minutes);
    setAmount(String(next.amount));
    setUnit(next.unit);
  }

  function handlePublish() {
    if (!selectedClerkUserId) {
      toast.error("Select a customer first.");
      return;
    }
    startTransition(async () => {
      const res = await upsertCustomerQuoteExpirySettingsAction({
        clerkUserId: selectedClerkUserId,
        amount: Number.parseInt(amount, 10),
        unit,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      if (res.expiryMinutes != null) syncFormFromMinutes(res.expiryMinutes);
      router.refresh();
    });
  }

  function handleRemove() {
    if (!selectedClerkUserId) return;
    startTransition(async () => {
      const res = await deleteCustomerQuoteExpirySettingsAction({
        clerkUserId: selectedClerkUserId,
      });
      setRemoveOpen(false);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      syncFormFromMinutes(globalExpiryMinutes);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Customer override</CardTitle>
          <CardDescription>
            Assign a custom accept/pay window for one shopper. It applies to all
            of their open quoted products—single lines and batch quote lines—
            unless a product override is set on a specific line. Shoppers
            without an override use the hub default (
            {formatQuoteExpiryWindowLabel(globalExpiryMinutes)}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel htmlFor="quote-expiry-customer-override-filter">
              Find customer
            </FieldLabel>
            <FieldContent>
              <Input
                id="quote-expiry-customer-override-filter"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="Name, email, or Clerk id…"
                className="max-w-md"
                disabled={pending}
              />
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="quote-expiry-customer-override-select">
              Customer
            </FieldLabel>
            <FieldContent>
              <select
                id="quote-expiry-customer-override-select"
                className={cn(SELECT_CLASS, "max-w-md min-w-[16rem]")}
                value={selectedClerkUserId ?? ""}
                disabled={pending}
                onChange={(e) => {
                  const id = e.target.value;
                  selectUser(id);
                  const ov = overrides.find((o) => o.clerkUserId === id);
                  syncFormFromMinutes(ov?.expiryMinutes ?? globalExpiryMinutes);
                }}
              >
                <option value="">Select a customer…</option>
                {filteredUsers.map((u) => (
                  <option key={u.clerkUserId} value={u.clerkUserId}>
                    {u.displayName}
                    {u.email ? ` (${u.email})` : ""}
                    {overrideUserIds.has(u.clerkUserId) ? " · override" : ""}
                  </option>
                ))}
              </select>
              {selectedUser ?
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {selectedOverrideMinutes != null ?
                    <>
                      Active override:{" "}
                      <span className="font-medium text-foreground">
                        {formatQuoteExpiryWindowLabel(selectedOverrideMinutes)}
                      </span>
                      .
                    </>
                  : <>
                      No override — using hub default (
                      {formatQuoteExpiryWindowLabel(globalExpiryMinutes)}).
                    </>
                  }
                </p>
              : null}
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="quote-expiry-customer-override-amount">
              Time until quote expires
            </FieldLabel>
            <FieldContent>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="quote-expiry-customer-override-amount"
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="max-w-[10rem] tabular-nums"
                  disabled={pending || !selectedClerkUserId}
                />
                <select
                  aria-label="Customer expiry duration unit"
                  className={SELECT_CLASS}
                  value={unit}
                  disabled={pending || !selectedClerkUserId}
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
                {MAX_QUOTE_EXPIRY_MINUTES.toLocaleString()} minutes).
              </p>
            </FieldContent>
          </Field>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 border-t border-border/50 bg-muted/30">
          <Button
            type="button"
            disabled={pending || !selectedClerkUserId}
            onClick={handlePublish}
          >
            {pending ? "Saving…" : "Publish customer override"}
          </Button>
          {selectedClerkUserId && selectedOverrideMinutes != null ?
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setRemoveOpen(true)}
            >
              Remove override
            </Button>
          : null}
        </CardFooter>
      </Card>

      {overrides.length > 0 ?
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-base">Saved customer overrides</CardTitle>
            <CardDescription>
              These shoppers use a custom window for every open quoted product
              (unless a product override applies).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Customer</th>
                    <th className="px-2 py-2 font-medium">Window</th>
                    <th className="px-2 py-2 font-medium">Updated</th>
                    <th className="px-2 py-2 font-medium"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {overrides.map((row) => (
                    <tr key={row.clerkUserId}>
                      <td className="px-2 py-2">
                        <p className="font-medium text-foreground">
                          {row.displayName}
                        </p>
                        {row.email ?
                          <p className="text-xs text-muted-foreground">
                            {row.email}
                          </p>
                        : null}
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {formatQuoteExpiryWindowLabel(row.expiryMinutes)}
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {new Date(row.updatedAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => {
                            selectUser(row.clerkUserId);
                            syncFormFromMinutes(row.expiryMinutes);
                          }}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      : null}

      <AdminConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove customer quote expiry override?"
        description="This shopper’s quoted products will use the hub default window again (unless a product override applies)."
        confirmLabel="Remove override"
        pending={pending}
        destructive
        onConfirm={handleRemove}
      />
    </div>
  );
}
