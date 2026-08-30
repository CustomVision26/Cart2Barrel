"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  generateHubStockUsReturnLabelAction,
  type GenerateHubStockUsReturnLabelState,
} from "@/actions/admin-hub-stock-return";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

type LabelRate = NonNullable<
  Extract<GenerateHubStockUsReturnLabelState, { ok: false }>["rates"]
>[number];

function formatDeliveryEstimate(rate: LabelRate): string {
  if (rate.durationTerms) return rate.durationTerms;
  if (rate.estimatedDays === 1) return "Est. 1 business day";
  if (rate.estimatedDays && rate.estimatedDays > 1) {
    return `Est. ${rate.estimatedDays} business days`;
  }
  return "Delivery time varies";
}

function rateKey(rate: LabelRate): string {
  return `${rate.carrier}|${rate.service}|${rate.cents}`;
}

export function AdminGenerateHubStockReturnLabelButton({
  orderItemId,
  customerNotes,
  disabled,
}: {
  orderItemId: string;
  customerNotes: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ratesOpen, setRatesOpen] = useState(false);
  const [rates, setRates] = useState<LabelRate[] | null>(null);
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [rateMessage, setRateMessage] = useState<string | null>(null);

  function applyResult(result: GenerateHubStockUsReturnLabelState, fromPicker: boolean) {
    if (result.ok) {
      toast.success(result.message);
      setRatesOpen(false);
      setRates(null);
      if (result.labelUrl) {
        window.open(result.labelUrl, "_blank", "noopener,noreferrer");
      }
      router.refresh();
      return;
    }
    if (result.rates && result.rates.length > 0) {
      setRates(result.rates);
      setRateMessage(result.message);
      setPickedKey(rateKey(result.rates[0]!));
      setRatesOpen(true);
      return;
    }
    if (fromPicker) {
      setRateMessage(result.message);
      return;
    }
    toast.error(result.message);
  }

  function generate(selection?: LabelRate) {
    const notes = customerNotes.trim();
    if (!notes) {
      toast.error("Add a note for the customer before buying the return label.");
      return;
    }
    startTransition(async () => {
      const result = await generateHubStockUsReturnLabelAction(
        selection ?
          {
            orderItemId,
            customerNotes: notes,
            carrier: selection.carrier,
            service: selection.service,
            cents: selection.cents,
          }
        : { orderItemId, customerNotes: notes },
      );
      applyResult(result, Boolean(selection));
    });
  }

  const picked = rates?.find((rate) => rateKey(rate) === pickedKey) ?? null;

  return (
    <>
      <Button
        type="button"
        disabled={disabled || pending}
        onClick={() => generate()}
      >
        {pending && !ratesOpen ? "Generating…" : "Generate return label"}
      </Button>

      <Dialog open={ratesOpen} onOpenChange={setRatesOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose a return shipping rate</DialogTitle>
            <DialogDescription>
              Pick a current USPS, UPS, or FedEx rate for the customer to ship this
              product back to the warehouse.
            </DialogDescription>
          </DialogHeader>
          {rateMessage ?
            <p className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {rateMessage}
            </p>
          : null}
          {rates && rates.length > 0 ?
            <ul className="space-y-2" role="list">
              {rates.map((rate) => {
                const key = rateKey(rate);
                const checked = key === pickedKey;
                return (
                  <li key={key}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors",
                        checked ?
                          "border-primary/50 bg-primary/8 ring-1 ring-primary/20"
                        : "border-border/80 bg-muted/20 hover:bg-muted/35",
                      )}
                    >
                      <input
                        type="radio"
                        name="hub-stock-return-label-rate"
                        className="mt-1"
                        checked={checked}
                        onChange={() => setPickedKey(key)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="font-medium text-foreground">{rate.carrier}</span>
                          <span className="shrink-0 font-semibold tabular-nums text-foreground">
                            {formatUsd(rate.cents)}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-muted-foreground">{rate.service}</span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {formatDeliveryEstimate(rate)}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          : null}
          <DialogFooter>
            <Button
              type="button"
              disabled={pending || !picked}
              onClick={() => {
                if (picked) generate(picked);
              }}
            >
              {pending ? "Buying label…" : "Buy return label"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
