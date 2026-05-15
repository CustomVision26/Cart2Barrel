"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Loader2Icon, SparklesIcon } from "lucide-react";

import {
  adminAiEstimateFromUrlAction,
  type AdminAiEstimateResult,
} from "@/actions/admin-ai-estimate";
import { adminUpdateHistoricalQuoteAction } from "@/actions/admin-update-historical-quote";
import { AdminAiEstimateResultFields } from "@/components/admin/admin-ai-estimate-result-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { AdminQuoteHistoryLine } from "@/data/admin-quote-history";
import {
  computePackLineMerchandiseAndServiceCents,
  formatUsd,
} from "@/lib/admin-markup";

function parseDollarsToCents(raw: string): number {
  const t = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (t === "") return 0;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function centsToDollarInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function parseQuantityInput(raw: string, fallback: number): number {
  const t = raw.trim();
  if (t === "") return fallback;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 99_999);
}

function lineTaxCents(line: AdminQuoteHistoryLine): number {
  const q = line.quote;
  return Math.max(
    0,
    q.totalPrice - q.itemCost - q.serviceFee - q.estimatedShipping
  );
}

type AdminQuoteHistoryEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line: AdminQuoteHistoryLine | null;
};

export function AdminQuoteHistoryEditDialog({
  open,
  onOpenChange,
  line,
}: AdminQuoteHistoryEditDialogProps) {
  const router = useRouter();
  const [isAiPending, startAiTransition] = useTransition();
  const [isSavePending, startSaveTransition] = useTransition();
  const [aiResult, setAiResult] = useState<AdminAiEstimateResult | null>(null);

  const [merchDollars, setMerchDollars] = useState("0.00");
  const [serviceDollars, setServiceDollars] = useState("0.00");
  const [shippingDollars, setShippingDollars] = useState("0.00");
  const [taxDollars, setTaxDollars] = useState("0.00");
  const [editProductName, setEditProductName] = useState("");
  const [editQuantity, setEditQuantity] = useState("1");
  const [editColor, setEditColor] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);

  /** Pack count for AI extraction + pack-line math (same semantics as AI estimate dialog). */
  const [packQty, setPackQty] = useState("1");
  const [editPackPriceDollars, setEditPackPriceDollars] = useState("0.00");
  const [includePackPriceInEstimate, setIncludePackPriceInEstimate] =
    useState(true);
  const [unitsPerPack, setUnitsPerPack] = useState("1");
  const [editConsumerUnitOverrideDollars, setEditConsumerUnitOverrideDollars] =
    useState("");
  const [editSavingsDollars, setEditSavingsDollars] = useState("0.00");

  const [merchandiseIncludesSiteShippingTax, setMerchandiseIncludesSiteShippingTax] =
    useState(false);

  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !line) return;
    const tax = lineTaxCents(line);
    setMerchDollars(centsToDollarInput(line.quote.itemCost));
    setServiceDollars(centsToDollarInput(line.quote.serviceFee));
    setShippingDollars(centsToDollarInput(line.quote.estimatedShipping));
    setTaxDollars(centsToDollarInput(tax));
    setEditProductName(line.request.productName?.trim() ?? "");
    setEditQuantity(String(line.request.quantity));
    setEditColor(line.request.productColor?.trim() ?? "");
    setEditSize(line.request.productSize?.trim() ?? "");
    setEditedImageUrl(line.request.productImageUrl ?? null);
    setPackQty(String(line.request.quantity));
    setEditPackPriceDollars("0.00");
    setIncludePackPriceInEstimate(true);
    setUnitsPerPack("1");
    setEditConsumerUnitOverrideDollars("");
    setEditSavingsDollars("0.00");
    setMerchandiseIncludesSiteShippingTax(
      Boolean(line.quote.merchandiseIncludesSiteShippingTax)
    );
    setAiResult(null);
    setSaveMessage(null);
    setSaveError(null);
  }, [open, line]);

  useEffect(() => {
    if (!aiResult?.ok) return;
    setEditColor((c) => aiResult.extraction.color?.trim() || c);
    setEditSize((s) => aiResult.extraction.size?.trim() || s);
    setEditPackPriceDollars(
      aiResult.unitPriceCents != null
        ? centsToDollarInput(aiResult.unitPriceCents)
        : "0.00"
    );
    setUnitsPerPack("1");
    setEditConsumerUnitOverrideDollars("");
    setEditSavingsDollars("0.00");
    setIncludePackPriceInEstimate(true);
    setShippingDollars(
      centsToDollarInput(aiResult.estimate.estimatedShippingCents)
    );
    setTaxDollars(centsToDollarInput(aiResult.estimate.taxCents));
    if (aiResult.extraction.productName?.trim()) {
      setEditProductName(aiResult.extraction.productName.trim());
    }
    setEditedImageUrl(aiResult.extraction.productImageUrl ?? null);
    setSaveMessage(null);
    setSaveError(null);
  }, [aiResult]);

  const manualLineDerived = useMemo(() => {
    const merch = parseDollarsToCents(merchDollars);
    const serv = parseDollarsToCents(serviceDollars);
    const ship = parseDollarsToCents(shippingDollars);
    const tax = parseDollarsToCents(taxDollars);
    return { merch, serv, ship, tax, total: merch + serv + ship + tax };
  }, [merchDollars, serviceDollars, shippingDollars, taxDollars]);

  const packDerived = useMemo(() => {
    if (!aiResult?.ok) return null;
    const enteredPackCents = parseDollarsToCents(editPackPriceDollars);
    const packCents = includePackPriceInEstimate ? enteredPackCents : 0;
    const packCount = Math.min(
      999,
      Math.max(0, Number.parseInt(String(packQty).trim(), 10) || 0)
    );
    const upp = Math.min(
      9999,
      Math.max(1, Number.parseInt(unitsPerPack.trim(), 10) || 1)
    );
    const overrideCentsRaw = parseDollarsToCents(
      editConsumerUnitOverrideDollars
    );
    const consumerUnitPriceOverrideCents =
      editConsumerUnitOverrideDollars.trim() === "" || overrideCentsRaw <= 0
        ? null
        : overrideCentsRaw;

    const packLine = computePackLineMerchandiseAndServiceCents({
      packPriceCents: packCents,
      packCount,
      unitsPerPack: upp,
      consumerUnitPriceOverrideCents,
    });

    const savingsRaw = parseDollarsToCents(editSavingsDollars);
    const savingsCents = Math.min(
      packLine.packBundleSubtotalCents,
      Math.max(0, savingsRaw)
    );
    const merchNet = Math.max(
      0,
      packLine.merchandiseSubtotalCents - savingsCents
    );

    const ship = parseDollarsToCents(shippingDollars);
    const tax = parseDollarsToCents(taxDollars);
    const total =
      merchNet + packLine.serviceFeeCents + ship + tax;

    const impliedConsumerUnitCents =
      packLine.impliedConsumerUnitCents > 0
        ? packLine.impliedConsumerUnitCents
        : null;
    const effectiveConsumerUnitCents =
      packLine.effectiveConsumerUnitCents > 0
        ? packLine.effectiveConsumerUnitCents
        : null;

    return {
      merch: merchNet,
      packBundle: packLine.packBundleSubtotalCents,
      savingsCents,
      packListedSubtotalCents: Math.round(enteredPackCents * packCount),
      serv: packLine.serviceFeeCents,
      ship,
      tax,
      total,
      packCount,
      upp,
      packCents,
      enteredPackCents,
      includePackPriceInEstimate,
      impliedConsumerUnitCents,
      effectiveConsumerUnitCents,
      usesUnitOverride: packLine.usesConsumerUnitOverride,
    };
  }, [
    aiResult,
    editPackPriceDollars,
    includePackPriceInEstimate,
    unitsPerPack,
    editConsumerUnitOverrideDollars,
    packQty,
    shippingDollars,
    taxDollars,
    editSavingsDollars,
  ]);

  const totalPreviewCents =
    aiResult?.ok && packDerived ? packDerived.total : manualLineDerived.total;

  const runAi = useCallback(() => {
    if (!line) return;
    setAiResult(null);
    setSaveMessage(null);
    setSaveError(null);
    startAiTransition(async () => {
      const packN = Math.min(
        999,
        Math.max(1, Number.parseInt(packQty.trim(), 10) || line.request.quantity)
      );
      const res = await adminAiEstimateFromUrlAction({
        productUrl: line.request.productUrl,
        quantity: String(packN),
        productSize: editSize.trim() || undefined,
        productColor: editColor.trim() || undefined,
        itemRequestId: line.request.id,
      });
      setAiResult(res);
    });
  }, [line, packQty, editSize, editColor]);

  const save = useCallback(() => {
    if (!line) return;
    if (aiResult?.ok && packDerived && packDerived.packCount < 1) {
      setSaveError("Set quantity (packs) to at least 1, or clear AI pricing.");
      return;
    }
    setSaveMessage(null);
    setSaveError(null);
    startSaveTransition(async () => {
      const quantity = parseQuantityInput(editQuantity, line.request.quantity);
      const itemCost =
        aiResult?.ok && packDerived ? packDerived.merch : manualLineDerived.merch;
      const serviceFee =
        aiResult?.ok && packDerived ? packDerived.serv : manualLineDerived.serv;
      const estimatedShipping = parseDollarsToCents(shippingDollars);
      const tax = parseDollarsToCents(taxDollars);
      const res = await adminUpdateHistoricalQuoteAction({
        quoteId: line.quote.id,
        itemRequestId: line.request.id,
        itemCost,
        merchandiseSavingsCents:
          aiResult?.ok && packDerived && packDerived.savingsCents > 0
            ? packDerived.savingsCents
            : undefined,
        serviceFee,
        estimatedShipping,
        tax,
        quantity,
        productName: editProductName.trim() || undefined,
        productColor: editColor.trim() || undefined,
        productSize: editSize.trim() || undefined,
        productImageUrl: editedImageUrl ?? null,
        merchandiseIncludesSiteShippingTax,
      });
      if (res.ok) {
        setSaveMessage(res.message ?? "Saved.");
        router.refresh();
        return;
      }
      setSaveError(res.message ?? "Could not save.");
    });
  }, [
    line,
    aiResult,
    packDerived,
    manualLineDerived,
    shippingDollars,
    taxDollars,
    editQuantity,
    editProductName,
    editColor,
    editSize,
    editedImageUrl,
    router,
    merchandiseIncludesSiteShippingTax,
  ]);

  if (!line) return null;

  const savedTax = lineTaxCents(line);
  const sizeSaved = line.request.productSize?.trim();
  const colorSaved = line.request.productColor?.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit saved quote</DialogTitle>
          <DialogDescription>
            Same AI workflow as new quotes: run extraction, tune pack / bundle
            pricing, shipping, and tax, then{" "}
            <span className="font-medium text-foreground">Save changes</span>. Or clear
            AI pricing and edit line amounts manually. Saving publishes a new current
            estimate and supersedes the prior row; item display fields update.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3 text-sm">
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Product &amp; saved quote
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="shrink-0 sm:w-36">
                {line.request.productImageUrl ? (
                  <div className="overflow-hidden rounded-md border border-border bg-background">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={line.request.productImageUrl}
                      alt={
                        line.request.productName?.trim()
                          ? `Product: ${line.request.productName.trim()}`
                          : "Product"
                      }
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-2 text-center text-xs text-muted-foreground">
                    No image on file
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="font-medium text-foreground">
                    {line.request.productName?.trim() || "Unnamed product"}
                  </p>
                  <p
                    className="mt-0.5 truncate text-xs text-muted-foreground"
                    title={line.request.productUrl}
                  >
                    {line.request.productUrl}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Quoted{" "}
                    <time dateTime={line.quote.createdAt}>
                      {new Date(line.quote.createdAt).toLocaleString()}
                    </time>
                  </p>
                </div>
                <dl className="grid max-w-md grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-xs sm:text-sm">
                  <dt className="text-muted-foreground">Quantity</dt>
                  <dd className="tabular-nums text-foreground">{line.request.quantity}</dd>
                  {sizeSaved ? (
                    <>
                      <dt className="text-muted-foreground">Size</dt>
                      <dd className="text-foreground">{sizeSaved}</dd>
                    </>
                  ) : null}
                  {colorSaved ? (
                    <>
                      <dt className="text-muted-foreground">Color</dt>
                      <dd className="text-foreground">{colorSaved}</dd>
                    </>
                  ) : null}
                  {line.request.note?.trim() ? (
                    <>
                      <dt className="text-muted-foreground">Note</dt>
                      <dd className="max-w-md whitespace-pre-wrap text-foreground">
                        {line.request.note.trim()}
                      </dd>
                    </>
                  ) : null}
                </dl>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-foreground">Saved amounts</p>
                  <dl className="grid max-w-md grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground sm:text-sm">
                    {line.quote.merchandiseSavingsCents != null &&
                    line.quote.merchandiseSavingsCents > 0 ? (
                      <>
                        <dt>Pack / bundle (listed)</dt>
                        <dd className="text-foreground">
                          {formatUsd(
                            line.quote.itemCost + line.quote.merchandiseSavingsCents
                          )}
                        </dd>
                        <dt>Savings</dt>
                        <dd className="text-foreground">
                          −{formatUsd(line.quote.merchandiseSavingsCents)}
                        </dd>
                      </>
                    ) : null}
                    <dt>Merchandise</dt>
                    <dd className="text-foreground">{formatUsd(line.quote.itemCost)}</dd>
                    <dt>Service &amp; handling</dt>
                    <dd className="text-foreground">{formatUsd(line.quote.serviceFee)}</dd>
                    <dt>Shipping</dt>
                    <dd className="text-foreground">{formatUsd(line.quote.estimatedShipping)}</dd>
                    <dt>Tax</dt>
                    <dd className="text-foreground">{formatUsd(savedTax)}</dd>
                    <dt className="font-medium text-foreground">Total</dt>
                    <dd className="font-semibold text-foreground">
                      {formatUsd(line.quote.totalPrice)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              AI product estimate
            </p>
            <Field>
              <FieldLabel htmlFor="qh-ai-pack-qty">Quantity (packs)</FieldLabel>
              <FieldContent>
                <Input
                  id="qh-ai-pack-qty"
                  type="number"
                  min={1}
                  max={999}
                  value={packQty}
                  onChange={(e) => setPackQty(e.target.value)}
                  className="max-w-28"
                />
                <p className="text-xs text-muted-foreground">
                  Used for AI extraction context and pack-line totals (same as the AI
                  estimate dialog).
                </p>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="qh-ai-size">Size (variant)</FieldLabel>
              <FieldContent>
                <Input
                  id="qh-ai-size"
                  value={editSize}
                  onChange={(e) => setEditSize(e.target.value)}
                  placeholder="e.g. XL"
                  autoComplete="off"
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="qh-ai-color">Color (variant)</FieldLabel>
              <FieldContent>
                <Input
                  id="qh-ai-color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  placeholder="e.g. Blue"
                  autoComplete="off"
                />
              </FieldContent>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="gap-1.5"
                disabled={isAiPending}
                onClick={runAi}
              >
                {isAiPending ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Running…
                  </>
                ) : (
                  <>
                    <SparklesIcon className="size-4" />
                    Run AI extraction
                  </>
                )}
              </Button>
              {aiResult?.ok ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAiResult(null);
                    setEditSavingsDollars("0.00");
                    setSaveError(null);
                  }}
                >
                  Clear AI pricing
                </Button>
              ) : null}
            </div>

            {aiResult && !aiResult.ok ? (
              <p className="text-sm text-destructive" role="alert">
                {aiResult.message}
              </p>
            ) : null}

            {aiResult?.ok && packDerived ? (
              <AdminAiEstimateResultFields
                result={aiResult}
                derived={packDerived}
                editPackPriceDollars={editPackPriceDollars}
                setEditPackPriceDollars={setEditPackPriceDollars}
                includePackPriceInEstimate={includePackPriceInEstimate}
                setIncludePackPriceInEstimate={setIncludePackPriceInEstimate}
                unitsPerPack={unitsPerPack}
                setUnitsPerPack={setUnitsPerPack}
                editConsumerUnitOverrideDollars={editConsumerUnitOverrideDollars}
                setEditConsumerUnitOverrideDollars={setEditConsumerUnitOverrideDollars}
                editShippingDollars={shippingDollars}
                setEditShippingDollars={setShippingDollars}
                editTaxDollars={taxDollars}
                setEditTaxDollars={setTaxDollars}
                editSavingsDollars={editSavingsDollars}
                setEditSavingsDollars={setEditSavingsDollars}
                merchandiseIncludesSiteShippingTax={
                  merchandiseIncludesSiteShippingTax
                }
                setMerchandiseIncludesSiteShippingTax={
                  setMerchandiseIncludesSiteShippingTax
                }
                idPrefix="qh-ai"
              />
            ) : null}
          </div>

          <Separator />

          <div className="min-w-0 space-y-3">
            <p className="text-xs font-semibold text-foreground">
              Line details (saved with quote)
            </p>
            <Field className="min-w-0 gap-1.5">
              <FieldLabel htmlFor="qh-product-name" className="text-xs">
                Product name
              </FieldLabel>
              <FieldContent>
                <Input
                  id="qh-product-name"
                  className="w-full min-w-0"
                  value={editProductName}
                  onChange={(e) => setEditProductName(e.target.value)}
                  placeholder="e.g. Crewneck sweatshirt"
                  autoComplete="off"
                />
              </FieldContent>
            </Field>
            <Field className="min-w-0 gap-1.5">
              <FieldLabel htmlFor="qh-qty" className="text-xs">
                Quantity (customer line)
              </FieldLabel>
              <FieldContent>
                <Input
                  id="qh-qty"
                  className="w-full min-w-0"
                  inputMode="numeric"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  autoComplete="off"
                  min={1}
                />
              </FieldContent>
            </Field>

            {!aiResult?.ok ? (
              <>
                <p className="text-xs font-medium text-foreground">
                  Manual line amounts
                </p>
                <Field className="min-w-0 gap-1.5">
                  <FieldLabel htmlFor="qh-tax" className="text-xs">
                    Tax ($)
                  </FieldLabel>
                  <FieldContent>
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                        $
                      </span>
                      <Input
                        id="qh-tax"
                        className="w-full min-w-0 pl-6"
                        inputMode="decimal"
                        value={taxDollars}
                        onChange={(e) => setTaxDollars(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  </FieldContent>
                </Field>
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field className="min-w-0 gap-1.5">
                    <FieldLabel htmlFor="qh-merch" className="text-xs">
                      Merchandise ($)
                    </FieldLabel>
                    <FieldContent>
                      <div className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                          $
                        </span>
                        <Input
                          id="qh-merch"
                          className="w-full min-w-0 pl-6"
                          inputMode="decimal"
                          value={merchDollars}
                          onChange={(e) => setMerchDollars(e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                    </FieldContent>
                  </Field>
                  <Field className="min-w-0 gap-1.5">
                    <FieldLabel htmlFor="qh-svc" className="text-xs">
                      Service &amp; handling ($)
                    </FieldLabel>
                    <FieldContent>
                      <div className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                          $
                        </span>
                        <Input
                          id="qh-svc"
                          className="w-full min-w-0 pl-6"
                          inputMode="decimal"
                          value={serviceDollars}
                          onChange={(e) => setServiceDollars(e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                    </FieldContent>
                  </Field>
                  <Field className="min-w-0 gap-1.5">
                    <FieldLabel htmlFor="qh-ship" className="text-xs">
                      Shipping ($)
                    </FieldLabel>
                    <FieldContent>
                      <div className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                          $
                        </span>
                        <Input
                          id="qh-ship"
                          className="w-full min-w-0 pl-6"
                          inputMode="decimal"
                          value={shippingDollars}
                          onChange={(e) => setShippingDollars(e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                    </FieldContent>
                  </Field>
                </div>
                <label
                  htmlFor="qh-merch-includes-site-fees"
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2 text-xs text-muted-foreground"
                >
                  <input
                    id="qh-merch-includes-site-fees"
                    type="checkbox"
                    checked={merchandiseIncludesSiteShippingTax}
                    onChange={(e) =>
                      setMerchandiseIncludesSiteShippingTax(e.target.checked)
                    }
                    className="border-input text-primary focus-visible:ring-ring mt-0.5 size-4 shrink-0 rounded"
                  />
                  <span>
                    Retailer-listed{" "}
                    <span className="font-medium text-foreground">
                      shipping &amp; sale tax
                    </span>{" "}
                    are bundled into merchandise ($0 on this line for those splits).
                  </span>
                </label>
              </>
            ) : null}
          </div>

          <div className="flex justify-between gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2 font-medium tabular-nums text-foreground">
            <span>New total</span>
            <span>{formatUsd(totalPreviewCents)}</span>
          </div>

          {saveError ? (
            <p className="text-sm text-destructive" role="alert">
              {saveError}
            </p>
          ) : null}
          {saveMessage ? (
            <p className="text-sm text-muted-foreground" role="status">
              {saveMessage}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              className="gap-1.5"
              disabled={
                isSavePending ||
                (Boolean(aiResult?.ok) &&
                  (packDerived?.packCount ?? 0) < 1)
              }
              onClick={save}
            >
              {isSavePending ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
