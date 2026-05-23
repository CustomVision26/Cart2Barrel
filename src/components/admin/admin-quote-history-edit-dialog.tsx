"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  ExternalLinkIcon,
  Loader2Icon,
  RotateCcwIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  adminAiEstimateFromUrlAction,
  type AdminAiEstimateResult,
} from "@/actions/admin-ai-estimate";
import { adminUpdateHistoricalQuoteAction } from "@/actions/admin-update-historical-quote";
import { AdminAiEstimateResultFields } from "@/components/admin/admin-ai-estimate-result-fields";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
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
import type { AdminQuoteHistoryLine } from "@/data/admin-quote-history";
import type { MerchantPricingEstimateSnapshot } from "@/data/merchant-pricing-settings";
import { isRetailerPageFetchBlockedMessage } from "@/lib/ai/fetch-page-for-ai";
import { computePackLineMerchandiseAndServiceCents, formatUsd } from "@/lib/admin-markup";
import {
  adminQuoteLineToEstimateSeed,
  lineTaxCentsFromQuote,
  packPriceDollarsFromQuoteLine,
  savingsDollarsFromQuoteLine,
} from "@/lib/admin-quote-line-estimate-seed";
import { persistStagedProductImage } from "@/lib/persist-staged-product-image";
import { displaySiteName } from "@/lib/site-name";
import { revokeBlobPreviewUrl } from "@/lib/staged-product-image";
import { cn } from "@/lib/utils";

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/80 bg-muted/20 p-4 shadow-sm",
        className
      )}
    >
      {children}
    </section>
  );
}

type AdminQuoteHistoryEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line: AdminQuoteHistoryLine | null;
  merchantEstimateFees?: MerchantPricingEstimateSnapshot;
};

export function AdminQuoteHistoryEditDialog({
  open,
  onOpenChange,
  line,
  merchantEstimateFees,
}: AdminQuoteHistoryEditDialogProps) {
  const router = useRouter();
  const [result, setResult] = useState<AdminAiEstimateResult | null>(null);
  const [isAiPending, startAiTransition] = useTransition();
  const [isSavePending, startSaveTransition] = useTransition();

  const [variantColor, setVariantColor] = useState("");
  const [variantSize, setVariantSize] = useState("");
  const [editProductName, setEditProductName] = useState("");
  /** Drives pack-line pricing, AI extraction, and saved request quantity. */
  const [editCustomerQuantity, setEditCustomerQuantity] = useState("1");

  const [editPackPriceDollars, setEditPackPriceDollars] = useState("0.00");
  const [includePackPriceInEstimate, setIncludePackPriceInEstimate] =
    useState(true);
  const [unitsPerPack, setUnitsPerPack] = useState("1");
  const [editConsumerUnitOverrideDollars, setEditConsumerUnitOverrideDollars] =
    useState("");
  const [editShippingDollars, setEditShippingDollars] = useState("0.00");
  const [editTaxDollars, setEditTaxDollars] = useState("0.00");
  const [editSavingsDollars, setEditSavingsDollars] = useState("0.00");
  const [merchandiseIncludesSiteShippingTax, setMerchandiseIncludesSiteShippingTax] =
    useState(false);
  const [editStaffNote, setEditStaffNote] = useState("");

  const [uploadedProductImageUrl, setUploadedProductImageUrl] = useState<
    string | null
  >(null);
  const [stagedProductImageFile, setStagedProductImageFile] = useState<File | null>(
    null,
  );

  useEffect(() => {
    if (!open || !line) return;

    const tax = lineTaxCentsFromQuote(line);
    const seed = adminQuoteLineToEstimateSeed(line);

    setResult(seed);
    setVariantSize(line.request.productSize?.trim() ?? "");
    setVariantColor(line.request.productColor?.trim() ?? "");
    setEditProductName(line.request.productName?.trim() ?? "");
    setEditCustomerQuantity(String(line.request.quantity));
    setEditPackPriceDollars(packPriceDollarsFromQuoteLine(line));
    setIncludePackPriceInEstimate(
      parseDollarsToCents(packPriceDollarsFromQuoteLine(line)) > 0
    );
    setUnitsPerPack("1");
    setEditConsumerUnitOverrideDollars("");
    setEditSavingsDollars(savingsDollarsFromQuoteLine(line));
    setEditShippingDollars(centsToDollarInput(line.quote.estimatedShipping));
    setEditTaxDollars(centsToDollarInput(tax));
    setEditStaffNote(line.quote.staffNote?.trim() ?? "");
    setMerchandiseIncludesSiteShippingTax(
      Boolean(line.quote.merchandiseIncludesSiteShippingTax)
    );
    setStagedProductImageFile(null);
    setUploadedProductImageUrl((prev) => {
      revokeBlobPreviewUrl(prev);
      return line.request.productImageUrl ?? null;
    });
  }, [open, line]);

  useEffect(() => {
    if (!result?.ok) return;
    setVariantColor((c) => result.extraction.color?.trim() || c);
    setVariantSize((s) => result.extraction.size?.trim() || s);
    if (result.extraction.productName?.trim()) {
      setEditProductName(result.extraction.productName.trim());
    }
    if (result.unitPriceCents != null) {
      setEditPackPriceDollars(centsToDollarInput(result.unitPriceCents));
    }
    setUnitsPerPack("1");
    setEditConsumerUnitOverrideDollars("");
    setIncludePackPriceInEstimate(true);
    setEditShippingDollars(
      centsToDollarInput(result.estimate.estimatedShippingCents)
    );
    setEditTaxDollars(centsToDollarInput(result.estimate.taxCents));
    if (result.extraction.productImageUrl?.trim()) {
      setUploadedProductImageUrl(result.extraction.productImageUrl.trim());
    }
  }, [result]);

  const handleProductImageStaged = useCallback(
    (file: File, previewUrl: string) => {
      revokeBlobPreviewUrl(uploadedProductImageUrl);
      setStagedProductImageFile(file);
      setUploadedProductImageUrl(previewUrl);
    },
    [uploadedProductImageUrl],
  );

  const derived = useMemo(() => {
    if (!result?.ok) return null;
    const enteredPackCents = parseDollarsToCents(editPackPriceDollars);
    const packCents = includePackPriceInEstimate ? enteredPackCents : 0;
    const packCount = Math.min(
      999,
      Math.max(
        0,
        parseQuantityInput(
          editCustomerQuantity,
          line?.request.quantity ?? 1
        )
      )
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
      serviceTiers: merchantEstimateFees?.serviceTiers,
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

    const ship = parseDollarsToCents(editShippingDollars);
    const tax = parseDollarsToCents(editTaxDollars);
    const total = merchNet + packLine.serviceFeeCents + ship + tax;

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
      impliedConsumerUnitCents:
        packLine.impliedConsumerUnitCents > 0
          ? packLine.impliedConsumerUnitCents
          : null,
      effectiveConsumerUnitCents:
        packLine.effectiveConsumerUnitCents > 0
          ? packLine.effectiveConsumerUnitCents
          : null,
      usesUnitOverride: packLine.usesConsumerUnitOverride,
    };
  }, [
    result,
    editPackPriceDollars,
    includePackPriceInEstimate,
    unitsPerPack,
    editConsumerUnitOverrideDollars,
    editCustomerQuantity,
    line?.request.quantity,
    editShippingDollars,
    editTaxDollars,
    editSavingsDollars,
    merchantEstimateFees,
  ]);

  const runEstimate = useCallback(
    (skipPageFetch: boolean) => {
      if (!line) return;
      if (!skipPageFetch) {
        revokeBlobPreviewUrl(uploadedProductImageUrl);
        setUploadedProductImageUrl(null);
        setStagedProductImageFile(null);
      }
      startAiTransition(async () => {
        const packN = Math.min(
          999,
          Math.max(
            1,
            parseQuantityInput(editCustomerQuantity, line.request.quantity)
          )
        );
        const res = await adminAiEstimateFromUrlAction({
          productUrl: line.request.productUrl,
          quantity: String(packN),
          productSize: variantSize.trim() || undefined,
          productColor: variantColor.trim() || undefined,
          itemRequestId: line.request.id,
          skipPageFetch,
        });
        setResult(res);
      });
    },
    [line, editCustomerQuantity, variantSize, variantColor, uploadedProductImageUrl]
  );

  const runAi = useCallback(() => runEstimate(false), [runEstimate]);
  const runManualQuote = useCallback(() => runEstimate(true), [runEstimate]);

  const resetToSavedQuote = useCallback(() => {
    if (!line) return;
    const tax = lineTaxCentsFromQuote(line);
    setResult(adminQuoteLineToEstimateSeed(line));
    setVariantSize(line.request.productSize?.trim() ?? "");
    setVariantColor(line.request.productColor?.trim() ?? "");
    setEditProductName(line.request.productName?.trim() ?? "");
    setEditCustomerQuantity(String(line.request.quantity));
    setEditPackPriceDollars(packPriceDollarsFromQuoteLine(line));
    setEditSavingsDollars(savingsDollarsFromQuoteLine(line));
    setEditShippingDollars(centsToDollarInput(line.quote.estimatedShipping));
    setEditTaxDollars(centsToDollarInput(tax));
    setEditStaffNote(line.quote.staffNote?.trim() ?? "");
    setMerchandiseIncludesSiteShippingTax(
      Boolean(line.quote.merchandiseIncludesSiteShippingTax)
    );
    revokeBlobPreviewUrl(uploadedProductImageUrl);
    setStagedProductImageFile(null);
    setUploadedProductImageUrl(line.request.productImageUrl ?? null);
    toast.message("Restored values from the saved quote.");
  }, [line, uploadedProductImageUrl]);

  const save = useCallback(() => {
    if (!line || !result?.ok || !derived) return;
    if (derived.packCount < 1) {
      toast.error("Set quantity to at least 1.");
      return;
    }

    startSaveTransition(async () => {
      const customerQty = parseQuantityInput(
        editCustomerQuantity,
        line.request.quantity
      );

      const fallbackUrl =
        stagedProductImageFile ? null : uploadedProductImageUrl;
      const imageRes = await persistStagedProductImage(
        line.request.id,
        stagedProductImageFile,
        fallbackUrl
      );
      if (!imageRes.ok) {
        toast.error(imageRes.message);
        return;
      }

      const res = await adminUpdateHistoricalQuoteAction({
        quoteId: line.quote.id,
        itemRequestId: line.request.id,
        itemCost: derived.merch,
        merchandiseSavingsCents:
          derived.savingsCents > 0 ? derived.savingsCents : undefined,
        serviceFee: derived.serv,
        estimatedShipping: derived.ship,
        tax: derived.tax,
        quantity: customerQty,
        productName: editProductName.trim() || undefined,
        productColor: variantColor.trim() || undefined,
        productSize: variantSize.trim() || undefined,
        productImageUrl: imageRes.imageUrl,
        staffNote: editStaffNote.trim() || undefined,
        merchandiseIncludesSiteShippingTax,
      });

      if (res.ok) {
        revokeBlobPreviewUrl(uploadedProductImageUrl);
        setStagedProductImageFile(null);
        toast.success(res.message ?? "Quote saved.");
        router.refresh();
        onOpenChange(false);
        return;
      }
      toast.error(res.message ?? "Could not save quote.");
    });
  }, [
    line,
    result,
    derived,
    editCustomerQuantity,
    editProductName,
    variantColor,
    variantSize,
    uploadedProductImageUrl,
    stagedProductImageFile,
    editStaffNote,
    merchandiseIncludesSiteShippingTax,
    router,
    onOpenChange,
  ]);

  if (!line) return null;

  const siteLabel = displaySiteName(line.request.siteName, line.request.productUrl);
  const savedTotal = line.quote.totalPrice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="space-y-1 border-b border-border/80 bg-muted/15 px-6 py-5">
          <DialogTitle className="text-lg tracking-tight">Edit quote</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Update pricing and product details. Saving publishes a new current
            estimate and replaces the previous row for this customer.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <Panel className="bg-gradient-to-br from-muted/30 to-muted/10">
            <div className="flex gap-4">
              <ProductRequestThumbnail
                variant="admin"
                imageUrl={uploadedProductImageUrl ?? line.request.productImageUrl}
                productLabel={editProductName || line.request.productName}
                className="size-20 shrink-0 rounded-lg"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                  {editProductName.trim() ||
                    line.request.productName?.trim() ||
                    "Unnamed product"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {siteLabel}
                  <span className="text-foreground">
                    {" "}
                    · Qty{" "}
                    {parseQuantityInput(
                      editCustomerQuantity,
                      line.request.quantity
                    )}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Originally quoted{" "}
                  <time dateTime={line.quote.createdAt} className="text-foreground">
                    {new Date(line.quote.createdAt).toLocaleString()}
                  </time>
                </p>
                <a
                  href={line.request.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  View product page
                  <ExternalLinkIcon className="size-3.5" aria-hidden />
                </a>
                {stagedProductImageFile ? (
                  <span className="inline-flex w-fit rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                    New photo pending save
                  </span>
                ) : null}
              </div>
            </div>
          </Panel>

          <div className="space-y-3">
            <SectionLabel>Refresh from retailer</SectionLabel>
            <Panel>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="edit-quote-size" className="text-xs">
                    Size
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="edit-quote-size"
                      value={variantSize}
                      onChange={(e) => setVariantSize(e.target.value)}
                      placeholder="XL"
                      autoComplete="off"
                      className="h-9"
                    />
                  </FieldContent>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="edit-quote-color" className="text-xs">
                    Color
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="edit-quote-color"
                      value={variantColor}
                      onChange={(e) => setVariantColor(e.target.value)}
                      placeholder="Blue"
                      autoComplete="off"
                      className="h-9"
                    />
                  </FieldContent>
                </Field>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Run AI to pull fresh title, image, and price hints from the product
                URL. Variant fields help match the correct SKU on multi-option listings.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
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
                      Run SerpApi lookup
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={isAiPending}
                  onClick={resetToSavedQuote}
                >
                  <RotateCcwIcon className="size-4" />
                  Reset
                </Button>
              </div>
            </Panel>

            {result && !result.ok ? (
              <div
                className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3"
                role="alert"
              >
                <p className="text-sm text-destructive">{result.message}</p>
                {isRetailerPageFetchBlockedMessage(result.message) ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isAiPending}
                    onClick={runManualQuote}
                  >
                    Continue with manual entry
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {result?.ok && derived ? (
            <div className="space-y-3">
              <SectionLabel>Quote breakdown</SectionLabel>
              <AdminAiEstimateResultFields
                result={result}
                derived={derived}
                editPackPriceDollars={editPackPriceDollars}
                setEditPackPriceDollars={setEditPackPriceDollars}
                includePackPriceInEstimate={includePackPriceInEstimate}
                setIncludePackPriceInEstimate={setIncludePackPriceInEstimate}
                unitsPerPack={unitsPerPack}
                setUnitsPerPack={setUnitsPerPack}
                editConsumerUnitOverrideDollars={editConsumerUnitOverrideDollars}
                setEditConsumerUnitOverrideDollars={
                  setEditConsumerUnitOverrideDollars
                }
                editShippingDollars={editShippingDollars}
                setEditShippingDollars={setEditShippingDollars}
                editTaxDollars={editTaxDollars}
                setEditTaxDollars={setEditTaxDollars}
                editSavingsDollars={editSavingsDollars}
                setEditSavingsDollars={setEditSavingsDollars}
                merchandiseIncludesSiteShippingTax={
                  merchandiseIncludesSiteShippingTax
                }
                setMerchandiseIncludesSiteShippingTax={
                  setMerchandiseIncludesSiteShippingTax
                }
                idPrefix="edit-quote"
                itemRequestId={line.request.id}
                productImageUrl={uploadedProductImageUrl}
                deferProductImagePersist
                onProductImageStaged={handleProductImageStaged}
                editStaffNote={editStaffNote}
                setEditStaffNote={setEditStaffNote}
                editProductName={editProductName}
                setEditProductName={setEditProductName}
                editCustomerQuantity={editCustomerQuantity}
                setEditCustomerQuantity={setEditCustomerQuantity}
                alwaysShowImageUpload
                productUrl={line.request.productUrl}
                hideLeadingSeparator
                polishedEditLayout
              />
            </div>
          ) : null}
        </div>

        {result?.ok && derived ? (
          <div className="shrink-0 border-t border-border/80 bg-muted/20 px-6 py-4">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">New total</p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                  {formatUsd(derived.total)}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>Was {formatUsd(savedTotal)}</p>
                {derived.total !== savedTotal ? (
                  <p
                    className={cn(
                      "font-medium tabular-nums",
                      derived.total > savedTotal
                        ? "text-amber-400"
                        : "text-emerald-400"
                    )}
                  >
                    {derived.total > savedTotal ? "+" : "−"}
                    {formatUsd(Math.abs(derived.total - savedTotal))}
                  </p>
                ) : (
                  <p className="text-muted-foreground">No change</p>
                )}
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isSavePending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="gap-1.5 sm:min-w-[10rem]"
                disabled={isSavePending || derived.packCount < 1}
                title={
                  derived.packCount < 1
                    ? "Set quantity to at least 1"
                    : undefined
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
            </div>
          </div>
        ) : (
          <div className="shrink-0 border-t border-border/80 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
