"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import {
  adminAiEstimateFromUrlAction,
  type AdminAiEstimateResult,
} from "@/actions/admin-ai-estimate";
import { saveAdminItemQuoteAction } from "@/actions/admin-item-quote";
import { AdminAiEstimateResultFields } from "@/components/admin/admin-ai-estimate-result-fields";
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
import {
  computePackLineMerchandiseAndServiceCents,
} from "@/lib/admin-markup";
import type { MerchantPricingEstimateSnapshot } from "@/data/merchant-pricing-settings";
import { isRetailerPageFetchBlockedMessage } from "@/lib/ai/fetch-page-for-ai";
import { persistStagedProductImage } from "@/lib/persist-staged-product-image";
import { revokeBlobPreviewUrl } from "@/lib/staged-product-image";

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

type AdminAiEstimateDialogProps = {
  itemRequestId: string;
  productUrl: string;
  initialQuantity: number;
  initialProductSize?: string | null;
  initialProductColor?: string | null;
  merchantEstimateFees?: MerchantPricingEstimateSnapshot;
};

export function AdminAiEstimateDialog({
  itemRequestId,
  productUrl,
  initialQuantity,
  initialProductSize = null,
  initialProductColor = null,
  merchantEstimateFees,
}: AdminAiEstimateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(String(initialQuantity));
  const [result, setResult] = useState<AdminAiEstimateResult | null>(null);
  const [isAiPending, startAiTransition] = useTransition();
  const [isSavePending, startSaveTransition] = useTransition();

  const [variantColor, setVariantColor] = useState("");
  const [variantSize, setVariantSize] = useState("");
  /** Listed price for one pack (AI seeds; admin may fix bundle/case price). */
  const [editPackPriceDollars, setEditPackPriceDollars] = useState("0.00");
  /** When true, pack price field flows into Estimate (USD); when false, treated as $0 for totals. */
  const [includePackPriceInEstimate, setIncludePackPriceInEstimate] =
    useState(true);
  /** Consumer units in each pack (1 = single item at pack price). */
  const [unitsPerPack, setUnitsPerPack] = useState("1");
  /**
   * When the site lists a different consumer-unit price than pack ÷ units,
   * optional override in USD for **service tiers only** (merchandise uses pack line).
   */
  const [editConsumerUnitOverrideDollars, setEditConsumerUnitOverrideDollars] =
    useState("");
  const [editShippingDollars, setEditShippingDollars] = useState("0.00");
  const [editTaxDollars, setEditTaxDollars] = useState("0.00");
  /** Subtracted from pack/bundle subtotal for net merchandise (promos, instant savings). */
  const [editSavingsDollars, setEditSavingsDollars] = useState("0.00");
  const [merchandiseIncludesSiteShippingTax, setMerchandiseIncludesSiteShippingTax] =
    useState(false);
  const [editStaffNote, setEditStaffNote] = useState("");

  /** Preview URL (HTTPS or local blob) for display. */
  const [uploadedProductImageUrl, setUploadedProductImageUrl] = useState<
    string | null
  >(null);
  /** Manual upload held until Save quote. */
  const [stagedProductImageFile, setStagedProductImageFile] = useState<File | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    setQuantity(String(initialQuantity));
    setVariantSize(initialProductSize?.trim() ?? "");
    setVariantColor(initialProductColor?.trim() ?? "");
    setUnitsPerPack("1");
    setEditPackPriceDollars("0.00");
    setIncludePackPriceInEstimate(true);
    setEditConsumerUnitOverrideDollars("");
    setEditSavingsDollars("0.00");
    setEditStaffNote("");
    setMerchandiseIncludesSiteShippingTax(false);
    setStagedProductImageFile(null);
    setUploadedProductImageUrl((prev) => {
      revokeBlobPreviewUrl(prev);
      return null;
    });
  }, [open, initialQuantity, initialProductSize, initialProductColor]);

  useEffect(() => {
    if (!result?.ok) return;
    setVariantColor(
      (c) => result.extraction.color?.trim() || c
    );
    setVariantSize(
      (s) => result.extraction.size?.trim() || s
    );
    setEditPackPriceDollars(
      result.unitPriceCents != null
        ? centsToDollarInput(result.unitPriceCents)
        : "0.00"
    );
    setUnitsPerPack("1");
    setEditConsumerUnitOverrideDollars("");
    setIncludePackPriceInEstimate(true);
    setEditShippingDollars(
      centsToDollarInput(result.estimate.estimatedShippingCents)
    );
    setEditTaxDollars(centsToDollarInput(result.estimate.taxCents));
    setEditSavingsDollars("0.00");
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

  const runEstimate = useCallback(
    (skipPageFetch: boolean) => {
      setResult(null);
      if (!skipPageFetch) {
        revokeBlobPreviewUrl(uploadedProductImageUrl);
        setUploadedProductImageUrl(null);
        setStagedProductImageFile(null);
      }
      startAiTransition(async () => {
        const res = await adminAiEstimateFromUrlAction({
          productUrl,
          quantity,
          productSize: variantSize.trim() || undefined,
          productColor: variantColor.trim() || undefined,
          itemRequestId,
          skipPageFetch,
        });
        setResult(res);
      });
    },
    [
      productUrl,
      quantity,
      variantSize,
      variantColor,
      itemRequestId,
      uploadedProductImageUrl,
    ]
  );

  const runAi = useCallback(() => runEstimate(false), [runEstimate]);
  const runManualQuote = useCallback(() => runEstimate(true), [runEstimate]);

  const derived = useMemo(() => {
    if (!result?.ok) return null;
    const enteredPackCents = parseDollarsToCents(editPackPriceDollars);
    const packCents = includePackPriceInEstimate ? enteredPackCents : 0;
    const packCount = Math.min(
      999,
      Math.max(0, Number.parseInt(String(quantity).trim(), 10) || 0)
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
    result,
    editPackPriceDollars,
    includePackPriceInEstimate,
    unitsPerPack,
    editConsumerUnitOverrideDollars,
    quantity,
    editShippingDollars,
    editTaxDollars,
    editSavingsDollars,
    merchantEstimateFees,
  ]);

  const save = useCallback(() => {
    if (!result?.ok || !derived || derived.packCount < 1) return;
    startSaveTransition(async () => {
      const fallbackUrl =
        stagedProductImageFile ?
          null
        : uploadedProductImageUrl?.trim() ||
          result.extraction.productImageUrl?.trim() ||
          null;

      const imageRes = await persistStagedProductImage(
        itemRequestId,
        stagedProductImageFile,
        fallbackUrl,
      );
      if (!imageRes.ok) {
        toast.error(imageRes.message);
        return;
      }

      const res = await saveAdminItemQuoteAction({
        itemRequestId,
        itemCost: derived.merch,
        merchandiseSavingsCents:
          derived.savingsCents > 0 ? derived.savingsCents : undefined,
        serviceFee: derived.serv,
        estimatedShipping: derived.ship,
        tax: derived.tax,
        merchandiseIncludesSiteShippingTax,
        productColor: variantColor.trim() || undefined,
        productSize: variantSize.trim() || undefined,
        staffNote: editStaffNote.trim() || undefined,
        ...(imageRes.imageUrl ? { productImageUrl: imageRes.imageUrl } : {}),
      });
      if (res.ok) {
        revokeBlobPreviewUrl(uploadedProductImageUrl);
        setStagedProductImageFile(null);
        toast.success(res.message ?? "Quote saved.");
        router.refresh();
        return;
      }
      toast.error(res.message ?? "Could not save quote.");
    });
  }, [
    result,
    derived,
    itemRequestId,
    variantColor,
    variantSize,
    router,
    merchandiseIncludesSiteShippingTax,
    uploadedProductImageUrl,
    stagedProductImageFile,
    editStaffNote,
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setResult(null);
          setQuantity(String(initialQuantity));
          setUnitsPerPack("1");
          setEditPackPriceDollars("0.00");
          setIncludePackPriceInEstimate(true);
          setEditConsumerUnitOverrideDollars("");
          setEditSavingsDollars("0.00");
          setEditStaffNote("");
          setMerchandiseIncludesSiteShippingTax(false);
          revokeBlobPreviewUrl(uploadedProductImageUrl);
          setUploadedProductImageUrl(null);
          setStagedProductImageFile(null);
        }
      }}
    >
      <DialogTrigger
        type="button"
        className="cursor-pointer border-0 bg-transparent p-0 text-left text-xs font-medium text-primary underline-offset-4 hover:text-primary/90 hover:underline"
      >
        <span className="inline-flex items-center gap-1">
          <SparklesIcon className="size-3.5 shrink-0" aria-hidden />
          AI estimate
        </span>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI product estimate</DialogTitle>
          <DialogDescription>
            Run AI on the product URL to extract details and the primary product image.
            When extraction succeeds, the HTTPS image URL is saved on the request right
            away for cart and shopper-facing lists. If AI finds no image, use{" "}
            <span className="font-medium text-foreground">Upload product image</span> to
            pick a file (preview only).{" "}
            <span className="font-medium text-foreground">Save quote</span> uploads the
            image and saves it on the request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-3">
            <Field>
              <FieldLabel htmlFor="ai-estimate-qty">Quantity (packs)</FieldLabel>
              <FieldContent>
                <Input
                  id="ai-estimate-qty"
                  type="number"
                  min={1}
                  max={999}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="max-w-28"
                />
                <p className="text-xs text-muted-foreground">
                  Number of packs at the listed pack price below—e.g.{" "}
                  <span className="whitespace-nowrap">2 cases</span>,{" "}
                  <span className="whitespace-nowrap">3 twin-packs</span>, or
                  individual lines if each pack is one SKU.
                </p>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="ai-estimate-size">Size (variant)</FieldLabel>
              <FieldContent>
                <Input
                  id="ai-estimate-size"
                  value={variantSize}
                  onChange={(e) => setVariantSize(e.target.value)}
                  placeholder="e.g. XL"
                  autoComplete="off"
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="ai-estimate-color">Color (variant)</FieldLabel>
              <FieldContent>
                <Input
                  id="ai-estimate-color"
                  value={variantColor}
                  onChange={(e) => setVariantColor(e.target.value)}
                  placeholder="e.g. Blue"
                  autoComplete="off"
                />
              </FieldContent>
            </Field>
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
          </div>

          {result && !result.ok ? (
            <div className="space-y-2" role="alert">
              <p className="text-sm text-destructive">{result.message}</p>
              {isRetailerPageFetchBlockedMessage(result.message) ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isAiPending}
                  onClick={runManualQuote}
                >
                  Enter quote manually
                </Button>
              ) : null}
            </div>
          ) : null}

          {result?.ok && derived ? (
            <>
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
                idPrefix="ai-est"
                itemRequestId={itemRequestId}
                productImageUrl={uploadedProductImageUrl}
                deferProductImagePersist
                onProductImageStaged={handleProductImageStaged}
                editStaffNote={editStaffNote}
                setEditStaffNote={setEditStaffNote}
              />
              <Button
                type="button"
                className="w-full gap-1.5"
                disabled={
                  isSavePending ||
                  !derived ||
                  derived.packCount < 1
                }
                title={
                  derived && derived.packCount < 1
                    ? "Set quantity (packs) to at least 1"
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
                  "Save quote"
                )}
              </Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
