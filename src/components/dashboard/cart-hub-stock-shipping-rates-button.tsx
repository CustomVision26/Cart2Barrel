"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  listHubStockPackageShippingRatesAction,
  selectHubStockPackageShippingRateAction,
  type HubStockShippingRateOption,
} from "@/actions/user-hub-stock-cart";
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

function formatDeliveryEstimate(rate: HubStockShippingRateOption): string {
  if (rate.durationTerms) return rate.durationTerms;
  if (rate.estimatedDays === 1) return "Est. 1 business day";
  if (rate.estimatedDays && rate.estimatedDays > 1) {
    return `Est. ${rate.estimatedDays} business days`;
  }
  return "Delivery time varies";
}

function rateKey(rate: HubStockShippingRateOption): string {
  return `${rate.carrier}|${rate.service}|${rate.cents}`;
}

export function CartHubStockShippingRatesButton({
  cartItemId,
  selectedCents,
  selectedCarrier,
  selectedService,
}: {
  cartItemId: string;
  selectedCents: number;
  selectedCarrier: string | null;
  selectedService: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rates, setRates] = useState<HubStockShippingRateOption[] | null>(null);
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedLabel = [selectedCarrier, selectedService]
    .filter((part) => Boolean(part?.trim()))
    .join(" ");

  function openRates() {
    setOpen(true);
    setRates(null);
    setError(null);
    setPickedKey(null);
    startTransition(async () => {
      const result = await listHubStockPackageShippingRatesAction({ cartItemId });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setRates(result.rates);
      const current =
        selectedCarrier && selectedService ?
          result.rates.find(
            (rate) =>
              rate.carrier === selectedCarrier &&
              rate.service === selectedService &&
              rate.cents === selectedCents,
          )
        : null;
      const initial = current ?? result.rates[0];
      setPickedKey(initial ? rateKey(initial) : null);
    });
  }

  const picked = rates?.find((rate) => rateKey(rate) === pickedKey) ?? null;

  return (
    <div className="w-full space-y-2 sm:w-56">
      <Button
        type="button"
        className="w-full"
        disabled={pending}
        onClick={openRates}
      >
        {pending && open ? "Getting rates…" : "Shipping"}
      </Button>
      {selectedCents > 0 ?
        <p className="text-right text-xs leading-relaxed text-muted-foreground">
          {selectedLabel || "Selected rate"}
          <span className="mt-0.5 block text-sm font-semibold tabular-nums text-foreground">
            {formatUsd(selectedCents)}
          </span>
        </p>
      : (
        <p className="text-right text-[11px] text-muted-foreground">
          Compare USPS, UPS, and FedEx rates
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compare shipping</DialogTitle>
            <DialogDescription>
              Shippo retrieves available rates from USPS, UPS, and FedEx so you can
              compare price and estimated delivery time.
            </DialogDescription>
          </DialogHeader>

          {error ?
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          : rates == null ?
            <p className="text-sm text-muted-foreground">Loading carrier rates…</p>
          : rates.length === 0 ?
            <p className="text-sm text-muted-foreground">
              No carrier rates were returned for this package.
            </p>
          : (
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
                        name="hub-stock-shippo-rate"
                        className="mt-1"
                        checked={checked}
                        onChange={() => setPickedKey(key)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="font-medium text-foreground">
                            {rate.carrier}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-foreground">
                            {formatUsd(rate.cents)}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {rate.service}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {formatDeliveryEstimate(rate)}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !picked}
              onClick={() => {
                if (!picked) return;
                startTransition(async () => {
                  const result = await selectHubStockPackageShippingRateAction({
                    cartItemId,
                    cents: picked.cents,
                    carrier: picked.carrier,
                    service: picked.service,
                  });
                  if (!result.ok) {
                    toast.error(result.message);
                    return;
                  }
                  toast.success("Shipping rate updated.");
                  setOpen(false);
                  router.refresh();
                });
              }}
            >
              {pending ? "Saving…" : "Use this rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
