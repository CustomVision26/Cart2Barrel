"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateQuoteExpirySettingsAction } from "@/actions/update-quote-expiry-settings";
import { AdminQuoteExpiryDurationFields } from "@/components/admin/admin-quote-expiry-duration-fields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatQuoteExpiryWindowLabel,
  isNeverExpireMinutes,
  MAX_QUOTE_EXPIRY_MINUTES,
  MIN_QUOTE_EXPIRY_MINUTES,
  preferredDurationUnit,
  type QuoteExpiryDurationUnit,
} from "@/lib/quote-expiry";

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
  const [neverExpires, setNeverExpires] = useState(
    isNeverExpireMinutes(initialExpiryMinutes),
  );
  const [amount, setAmount] = useState(String(initial.amount));
  const [unit, setUnit] = useState<QuoteExpiryDurationUnit>(initial.unit);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setNeverExpires(isNeverExpireMinutes(initialExpiryMinutes));
    const next = preferredDurationUnit(initialExpiryMinutes);
    setAmount(String(next.amount));
    setUnit(next.unit);
  }, [initialExpiryMinutes]);

  function handlePublish() {
    startTransition(async () => {
      const res = await updateQuoteExpirySettingsAction({
        neverExpires,
        amount: neverExpires ? 7 : Number.parseInt(amount, 10),
        unit: neverExpires ? "days" : unit,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setNeverExpires(isNeverExpireMinutes(res.expiryMinutes));
      if (!isNeverExpireMinutes(res.expiryMinutes)) {
        const next = preferredDurationUnit(res.expiryMinutes);
        setAmount(String(next.amount));
        setUnit(next.unit);
      }
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
          pay — or turn on{" "}
          <span className="font-medium text-foreground">
            Do not expire quotes
          </span>{" "}
          so there is no deadline. Expired quotes leave Active and appear under{" "}
          <span className="font-medium text-foreground">
            Add item → Expired Quotes
          </span>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AdminQuoteExpiryDurationFields
          idPrefix="quote-expiry-hub"
          neverExpires={neverExpires}
          onNeverExpiresChange={setNeverExpires}
          amount={amount}
          onAmountChange={setAmount}
          unit={unit}
          onUnitChange={setUnit}
          disabled={pending}
          durationHint={`From ${MIN_QUOTE_EXPIRY_MINUTES} minute to 90 days (${MAX_QUOTE_EXPIRY_MINUTES.toLocaleString()} minutes). Default is 7 days. Currently published: ${formatQuoteExpiryWindowLabel(initialExpiryMinutes)}.`}
        />
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
