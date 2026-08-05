"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateQuoteExpirySettingsAction } from "@/actions/update-quote-expiry-settings";
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
import {
  formatQuoteExpiryWindowLabel,
  MAX_QUOTE_EXPIRY_MINUTES,
  MIN_QUOTE_EXPIRY_MINUTES,
  preferredDurationUnit,
  type QuoteExpiryDurationUnit,
} from "@/lib/quote-expiry";

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type AdminQuoteExpirySettingsPanelProps = {
  initialExpiryMinutes: number;
  updatedAt: string | null;
};

export function AdminQuoteExpirySettingsPanel({
  initialExpiryMinutes,
  updatedAt,
}: AdminQuoteExpirySettingsPanelProps) {
  const router = useRouter();
  const initial = useMemo(
    () => preferredDurationUnit(initialExpiryMinutes),
    [initialExpiryMinutes],
  );
  const [amount, setAmount] = useState(String(initial.amount));
  const [unit, setUnit] = useState<QuoteExpiryDurationUnit>(initial.unit);
  const [pending, startTransition] = useTransition();

  function handlePublish() {
    startTransition(async () => {
      const res = await updateQuoteExpirySettingsAction({
        amount: Number.parseInt(amount, 10),
        unit,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      const next = preferredDurationUnit(res.expiryMinutes);
      setAmount(String(next.amount));
      setUnit(next.unit);
      router.refresh();
    });
  }

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle>Hub default window</CardTitle>
        <CardDescription>
          Retailer prices change often. This hub default applies unless a
          customer or product override is set. After staff saves an estimate
          (single line or batch), the customer has this long to accept it and
          pay. Expired quotes leave Active and appear under{" "}
          <span className="font-medium text-foreground">
            Add item → Expired Quotes
          </span>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field>
          <FieldLabel htmlFor="quote-expiry-amount">
            Time until quote expires
          </FieldLabel>
          <FieldContent>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="quote-expiry-amount"
                type="number"
                min={1}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="max-w-[10rem] tabular-nums"
                disabled={pending}
              />
              <select
                aria-label="Expiry duration unit"
                className={SELECT_CLASS}
                value={unit}
                disabled={pending}
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
              {MAX_QUOTE_EXPIRY_MINUTES.toLocaleString()} minutes). Default is 7
              days. Currently published:{" "}
              {formatQuoteExpiryWindowLabel(initialExpiryMinutes)}.
            </p>
          </FieldContent>
        </Field>
        {updatedAt ?
          <p className="text-xs text-muted-foreground">
            Last published{" "}
            {new Date(updatedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            .
          </p>
        : null}
      </CardContent>
      <CardFooter className="border-t border-border/50 bg-muted/30">
        <Button type="button" disabled={pending} onClick={handlePublish}>
          {pending ? "Publishing…" : "Publish expiry window"}
        </Button>
      </CardFooter>
    </Card>
  );
}
