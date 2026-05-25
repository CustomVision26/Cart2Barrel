"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";

import {
  getAdminBatchQuoteEstimateDraftAction,
  saveAdminBatchQuoteEstimateAction,
} from "@/actions/admin-batch-quote";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatUsd } from "@/lib/admin-markup";

function parseDollarsToCents(raw: string): number {
  const t = raw.trim().replace(/[$,]/g, "");
  if (t === "") return 0;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function centsToDollarInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

type AdminBatchQuoteEstimateDialogProps = {
  batchSessionId: string;
  triggerLabel?: string;
  onSaved?: () => void;
};

export function AdminBatchQuoteEstimateDialog({
  batchSessionId,
  triggerLabel = "Estimate",
  onSaved,
}: AdminBatchQuoteEstimateDialogProps) {
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const [batchNumber, setBatchNumber] = useState("");
  const [batchMerch, setBatchMerch] = useState(0);
  const [batchShip, setBatchShip] = useState(0);
  const [batchTax, setBatchTax] = useState(0);
  const [serviceTotal, setServiceTotal] = useState(0);

  const [siteMerch$, setSiteMerch$] = useState("");
  const [siteShip$, setSiteShip$] = useState("");
  const [siteTax$, setSiteTax$] = useState("");

  const load = useCallback(() => {
    setLoadError(null);
    startTransition(async () => {
      const res = await getAdminBatchQuoteEstimateDraftAction({ batchSessionId });
      if (!res.ok) {
        setLoadError(res.message);
        return;
      }
      setBatchNumber(res.batchNumber);
      setBatchMerch(res.batchMerchandiseTotalCents);
      setBatchShip(res.batchShippingTotalCents);
      setBatchTax(res.batchSaleTaxTotalCents);
      setServiceTotal(res.serviceHandlingTotalCents);
      setSiteMerch$(
        centsToDollarInput(
          res.existingSiteMerchandiseCents ?? res.batchMerchandiseTotalCents
        )
      );
      setSiteShip$(
        centsToDollarInput(res.existingSiteShippingCents ?? res.batchShippingTotalCents)
      );
      setSiteTax$(
        centsToDollarInput(res.existingSiteSaleTaxCents ?? res.batchSaleTaxTotalCents)
      );
    });
  }, [batchSessionId]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setLoadError(null);
      setPreviewOpen(false);
      setBatchNumber("");
      return;
    }
    load();
  };

  const siteMerchC = parseDollarsToCents(siteMerch$);
  const siteShipC = parseDollarsToCents(siteShip$);
  const siteTaxC = parseDollarsToCents(siteTax$);

  const itemDiscount = useMemo(
    () => Math.max(0, batchMerch - siteMerchC),
    [batchMerch, siteMerchC]
  );
  const shippingDiscount = useMemo(
    () => Math.max(0, batchShip - siteShipC),
    [batchShip, siteShipC]
  );
  const saleTaxDiscount = useMemo(
    () => Math.max(0, batchTax - siteTaxC),
    [batchTax, siteTaxC]
  );
  const subtotal = useMemo(
    () => siteMerchC + serviceTotal + siteTaxC + siteShipC,
    [siteMerchC, serviceTotal, siteTaxC, siteShipC]
  );

  const save = () => {
    setLoadError(null);
    startTransition(async () => {
      const res = await saveAdminBatchQuoteEstimateAction({
        batchSessionId,
        siteMerchandiseCents: siteMerchC,
        siteShippingCents: siteShipC,
        siteSaleTaxCents: siteTaxC,
      });
      if (!res.ok) {
        setLoadError(res.message ?? "Save failed.");
        return;
      }
      setOpen(false);
      onSaved?.();
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger
          type="button"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          {triggerLabel}
        </DialogTrigger>
        <DialogContent className="max-h-[min(90vh,40rem)] w-[min(96vw,32rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Batch estimate</DialogTitle>
            <DialogDescription>
              Batch <span className="font-mono font-medium">{batchNumber || "…"}</span>.
              Totals derive from saved line quotes; enter site-aligned amounts for merchandise,
              shipping, and tax before saving.
            </DialogDescription>
          </DialogHeader>

          {busy && !batchNumber ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 rounded-md border border-border/80 bg-muted p-3 tabular-nums">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Batch Total (merchandise)</span>
                  <span className="text-foreground">{formatUsd(batchMerch)}</span>
                </div>
                <Field className="gap-1">
                  <FieldLabel htmlFor="b-site-merch" className="text-xs">
                    Site total (customer merchandise)
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="b-site-merch"
                      inputMode="decimal"
                      value={siteMerch$}
                      onChange={(e) => setSiteMerch$(e.target.value)}
                    />
                  </FieldContent>
                </Field>
                <div className="flex justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Item(s) discount</span>
                  <span className="text-foreground">{formatUsd(itemDiscount)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Service &amp; handling</span>
                  <span className="text-foreground">{formatUsd(serviceTotal)}</span>
                </div>
              </div>

              <Separator />

              <div className="grid gap-2 rounded-md border border-border/80 bg-muted p-3 tabular-nums">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Batch Shipping Total</span>
                  <span className="text-foreground">{formatUsd(batchShip)}</span>
                </div>
                <Field className="gap-1">
                  <FieldLabel htmlFor="b-site-ship" className="text-xs">
                    Site Shipping Total
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="b-site-ship"
                      inputMode="decimal"
                      value={siteShip$}
                      onChange={(e) => setSiteShip$(e.target.value)}
                    />
                  </FieldContent>
                </Field>
                <div className="flex justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Shipping discount</span>
                  <span className="text-foreground">{formatUsd(shippingDiscount)}</span>
                </div>
              </div>

              <Separator />

              <div className="grid gap-2 rounded-md border border-border/80 bg-muted p-3 tabular-nums">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Batch Sale tax</span>
                  <span className="text-foreground">{formatUsd(batchTax)}</span>
                </div>
                <Field className="gap-1">
                  <FieldLabel htmlFor="b-site-tax" className="text-xs">
                    Site Sale Tax
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="b-site-tax"
                      inputMode="decimal"
                      value={siteTax$}
                      onChange={(e) => setSiteTax$(e.target.value)}
                    />
                  </FieldContent>
                </Field>
                <div className="flex justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Sale Tax discount</span>
                  <span className="text-foreground">{formatUsd(saleTaxDiscount)}</span>
                </div>
              </div>

              <div className="flex justify-between border-t border-border pt-3 font-semibold tabular-nums">
                <span>Estimate SubTotal</span>
                <span>{formatUsd(subtotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                SubTotal uses site merchandise + service &amp; handling + site sale tax + site
                shipping.
              </p>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setPreviewOpen(true)}
                  disabled={busy}
                >
                  Preview estimate
                </Button>
                <Button type="button" size="sm" disabled={busy} onClick={save}>
                  {busy ? "Saving…" : "Save batch estimate"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[min(96vw,26rem)]">
          <DialogHeader>
            <DialogTitle>Estimate preview</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {batchNumber}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm tabular-nums">
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Site merchandise</span>
              <span>{formatUsd(siteMerchC)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Service &amp; handling</span>
              <span>{formatUsd(serviceTotal)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Site shipping</span>
              <span>{formatUsd(siteShipC)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Site sale tax</span>
              <span>{formatUsd(siteTaxC)}</span>
            </li>
            <li className="flex justify-between gap-2 border-t border-border pt-2 font-medium">
              <span>Customer subtotal</span>
              <span>{formatUsd(subtotal)}</span>
            </li>
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
