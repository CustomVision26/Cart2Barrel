"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";

import { draftItemRequestFromUrlAction } from "@/actions/customer-ai-item-draft";
import { createItemRequestAction } from "@/actions/item-request";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

const IFRAME_TITLE = "Shopping site preview";

function normalizeUrlInput(value: string): string {
  const t = value.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function urlsMatchForSubmit(previewRaw: string, productRaw: string): boolean {
  const a = normalizeUrlInput(previewRaw);
  const b = normalizeUrlInput(productRaw);
  if (!a || !b) return false;
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return a === b;
  }
}

function parseQuantity(value: string): number | null {
  const n = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 999) return null;
  return n;
}

const SUBMIT_SUCCESS_TOAST_MS = 5_000;

type RequestMode = "manual" | "ai";

/** Snapshot after a successful AI draft; used for merchandise preview + stale detection. */
type AiMerchPreviewState = {
  quantity: number;
  unitPriceCents: number | null;
  merchandiseSubtotalCents: number | null;
  variantSizeNorm: string;
  variantColorNorm: string;
};

export function ItemRequestWorkspace() {
  const router = useRouter();
  const [mode, setMode] = useState<RequestMode>("manual");
  const [isPending, startTransition] = useTransition();
  const [isAiPending, startAiTransition] = useTransition();

  const [previewInput, setPreviewInput] = useState("");
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  const [productUrl, setProductUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [productSize, setProductSize] = useState("");
  const [productColor, setProductColor] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");

  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [lastAiNotes, setLastAiNotes] = useState<string | null>(null);
  /** From last successful AI draft; sent on submit so DB stores retailer label. */
  const [draftSiteName, setDraftSiteName] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined> | undefined
  >();
  const [formResetKey, setFormResetKey] = useState(0);
  const [aiMerchPreview, setAiMerchPreview] = useState<AiMerchPreviewState | null>(
    null
  );
  const [submitSuccessToast, setSubmitSuccessToast] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!submitSuccessToast) return;
    const id = window.setTimeout(
      () => setSubmitSuccessToast(null),
      SUBMIT_SUCCESS_TOAST_MS
    );
    return () => window.clearTimeout(id);
  }, [submitSuccessToast]);

  const pricePreviewStale = useMemo(() => {
    if (!aiMerchPreview) return false;
    const q = parseQuantity(quantity);
    if (q !== aiMerchPreview.quantity) return true;
    if (productSize.trim().toLowerCase() !== aiMerchPreview.variantSizeNorm)
      return true;
    if (productColor.trim().toLowerCase() !== aiMerchPreview.variantColorNorm)
      return true;
    return false;
  }, [aiMerchPreview, quantity, productSize, productColor]);

  const openPreviewInNewTab = useCallback(() => {
    const url =
      normalizeUrlInput(previewInput) || normalizeUrlInput(productUrl);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [previewInput, productUrl]);

  const loadPreview = useCallback(() => {
    const fromPreview = normalizeUrlInput(previewInput);
    const fromLink = normalizeUrlInput(productUrl);
    const url = fromPreview || fromLink;
    if (!url) {
      setIframeSrc(null);
      return;
    }
    if (!fromPreview && fromLink) {
      const raw = productUrl.trim();
      setPreviewInput(/^https?:\/\//i.test(raw) ? raw : fromLink);
    }
    setIframeSrc(url);
  }, [previewInput, productUrl]);

  const syncPreviewAndProductLink = useCallback(() => {
    const fromPreview = normalizeUrlInput(previewInput);
    if (fromPreview) {
      setProductUrl(fromPreview);
      return;
    }
    const fromLink = normalizeUrlInput(productUrl);
    if (fromLink) {
      const raw = productUrl.trim();
      setPreviewInput(/^https?:\/\//i.test(raw) ? raw : fromLink);
      setIframeSrc(fromLink);
    }
  }, [previewInput, productUrl]);

  const hasPreviewUrl = Boolean(normalizeUrlInput(previewInput));
  const hasProductLinkUrl = Boolean(normalizeUrlInput(productUrl));
  const canUseUrlSync = hasPreviewUrl || hasProductLinkUrl;

  const urlsAligned = urlsMatchForSubmit(previewInput, productUrl);
  const quantityOk = parseQuantity(quantity) != null;
  const canSubmit = urlsAligned && quantityOk && !isPending;
  const canRunAi =
    urlsAligned && quantityOk && !isAiPending && mode === "ai";

  const fieldError = useMemo(
    () =>
      (name: string) =>
        fieldErrors?.[name]?.length ? fieldErrors[name] : undefined,
    [fieldErrors]
  );

  const runAiDraft = useCallback(() => {
    setAiMessage(null);
    setLastAiNotes(null);
    setDraftSiteName(null);
    if (!urlsMatchForSubmit(previewInput, productUrl)) {
      setAiMessage(
        'Product URL (preview) and Product link must match. Use "Use preview URL above" so both fields use the same address.'
      );
      return;
    }
    if (parseQuantity(quantity) == null) {
      setAiMessage("Enter a quantity between 1 and 999.");
      return;
    }
    startAiTransition(async () => {
      const res = await draftItemRequestFromUrlAction({
        productUrl: normalizeUrlInput(productUrl),
        quantity,
        productSize: productSize.trim() || undefined,
        productColor: productColor.trim() || undefined,
      });
      if (!res.ok) {
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        setAiMerchPreview(null);
        setDraftSiteName(null);
        setAiMessage(res.message ?? "AI could not read this page.");
        return;
      }
      setFieldErrors(undefined);
      setDraftSiteName(res.siteName ?? null);
      if (res.productName) {
        setProductName(res.productName);
      }
      if (res.productSize) {
        setProductSize(res.productSize);
      }
      if (res.productColor) {
        setProductColor(res.productColor);
      }
      setAiMerchPreview({
        quantity: res.quantity,
        unitPriceCents: res.unitPriceCents,
        merchandiseSubtotalCents: res.merchandiseSubtotalCents,
        variantSizeNorm: (
          res.productSize?.trim() ? res.productSize : productSize
        )
          .trim()
          .toLowerCase(),
        variantColorNorm: (
          res.productColor?.trim() ? res.productColor : productColor
        )
          .trim()
          .toLowerCase(),
      });
      setLastAiNotes(res.aiNotes);
      if (res.aiNotes) {
        setNote((prev) => {
          const t = prev.trim();
          return t ? `${t}\n\n— From AI: ${res.aiNotes}` : res.aiNotes!;
        });
      }
      setAiMessage(
        "Details and a merchandise cost preview were filled from the listing. Review everything, then submit your request to staff."
      );
    });
  }, [previewInput, productUrl, quantity, productSize, productColor]);

  const submit = useCallback(() => {
    setFormMessage(null);
    setFieldErrors(undefined);
    if (!urlsMatchForSubmit(previewInput, productUrl)) {
      setFormMessage(
        'Product URL (preview) and Product link must be the same address. Use "Use preview URL above" or edit both fields so they match.'
      );
      return;
    }
    if (parseQuantity(quantity) == null) {
      setFormMessage("Enter a quantity between 1 and 999.");
      return;
    }
    const payload = {
      productUrl,
      productName: productName.trim() || undefined,
      productSize: productSize.trim() || undefined,
      productColor: productColor.trim() || undefined,
      quantity,
      note: note.trim() || undefined,
      siteName: draftSiteName?.trim() || undefined,
    };
    startTransition(async () => {
      const result = await createItemRequestAction(payload);
      if (result.ok) {
        setFieldErrors(undefined);
        setFormMessage(null);
        setAiMessage(null);
        setLastAiNotes(null);
        setDraftSiteName(null);
        setAiMerchPreview(null);
        setPreviewInput("");
        setIframeSrc(null);
        setProductUrl("");
        setProductName("");
        setProductSize("");
        setProductColor("");
        setNote("");
        setQuantity("1");
        setFormResetKey((k) => k + 1);
        setSubmitSuccessToast(
          result.message?.trim() ||
            "Your item request was submitted. Staff will review it soon."
        );
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        setFormMessage(
          result.message ?? "Please fix the highlighted fields and try again."
        );
        return;
      }
      setFieldErrors(undefined);
      setFormMessage(result.message ?? "Could not submit request.");
    });
  }, [
    previewInput,
    productUrl,
    productName,
    productSize,
    productColor,
    quantity,
    note,
    draftSiteName,
    router,
  ]);

  return (
    <div className="space-y-6">
      {submitSuccessToast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 max-w-[min(100vw-2rem,24rem)] -translate-x-1/2 rounded-lg border border-emerald-500/45 bg-emerald-500/15 px-4 py-3 text-center text-sm text-emerald-950 shadow-lg backdrop-blur-sm dark:border-emerald-400/35 dark:bg-emerald-950/85 dark:text-emerald-50"
        >
          {submitSuccessToast}
        </div>
      ) : null}
      <div
        role="tablist"
        aria-label="Request submission method"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "manual"}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            mode === "manual"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => {
            setMode("manual");
            setAiMessage(null);
            setAiMerchPreview(null);
            setDraftSiteName(null);
          }}
        >
          Manual request
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "ai"}
          className={cn(
            "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            mode === "ai"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setMode("ai")}
        >
          <Sparkles className="size-3.5" aria-hidden />
          AI-assisted request
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Browse a store</CardTitle>
          <CardDescription>
            Enter a shop or product URL to load a preview below. Many large
            retailers block embedded frames for security—if you see a blank area,
            use <span className="font-medium text-foreground">Open in new tab</span>{" "}
            to shop, then paste the product link into the request form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label
              htmlFor="item-preview-product-url"
              className="text-sm font-medium text-foreground"
            >
              Product URL <span className="font-normal text-muted-foreground">(preview)</span>
            </label>
            <p className="text-xs text-muted-foreground">
              Enter a shop or product address to load the preview frame.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="item-preview-product-url"
              key={`preview-${formResetKey}`}
              name="previewProductUrl"
              autoComplete="off"
              aria-label="Product URL for preview"
              placeholder="https://example-store.com/…"
              value={previewInput}
              onChange={(e) => setPreviewInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  loadPreview();
                }
              }}
              className="min-w-0 flex-1"
            />
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" onClick={loadPreview} disabled={!canUseUrlSync}>
                Load preview
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={openPreviewInNewTab}
                disabled={!canUseUrlSync}
              >
                <ExternalLink className="size-4" />
                Open in new tab
              </Button>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-lg border border-border bg-muted/20">
            {iframeSrc ? (
              <iframe
                title={IFRAME_TITLE}
                src={iframeSrc}
                className="h-[min(70vh,520px)] w-full bg-background"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-[min(50vh,360px)] w-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                Preview will appear here after you enter a URL and choose Load
                preview.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Item request</CardTitle>
          <CardDescription>
            {mode === "manual" ? (
              <>
                Submit the exact product page link and details yourself. Staff will
                review and send a quote.
              </>
            ) : (
              <>
                AI reads the listing for title, variant, and an estimated{" "}
                <span className="font-medium text-foreground">merchandise</span> total
                (what the store charges for the product line). Review the preview and
                your fields, then submit to staff for an official quote.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldSet key={formResetKey} className="gap-5">
            {mode === "ai" ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                <div
                  role="note"
                  className="space-y-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-950 dark:text-amber-50/95"
                >
                  <p className="font-medium text-foreground">
                    How to read the AI merchandise estimate
                  </p>
                  <p>
                    On the retailer&apos;s site, the price you pay often{" "}
                    <span className="font-medium text-foreground">
                      changes with quantity, size, and color
                    </span>{" "}
                    for the same product. The amounts below are{" "}
                    <span className="font-medium text-foreground">
                      an AI reading of the listing
                    </span>{" "}
                    and may be wrong, incomplete, or out of date.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">
                      Tax, Cart2Barrel service &amp; handling, and shipment fees are not
                      included
                    </span>{" "}
                    in this preview. Staff will send you a full quote that includes
                    those items where they apply.
                  </p>
                </div>
                <p>
                  Link the preview URL and product link, set quantity, add optional
                  size/color to help match variants, then run AI. Edit any field before
                  you submit your request to admin.
                </p>
                <Button
                  type="button"
                  className="mt-3 gap-1.5"
                  variant="secondary"
                  disabled={!canRunAi}
                  onClick={runAiDraft}
                  title={
                    !canRunAi && !isAiPending
                      ? !hasPreviewUrl || !hasProductLinkUrl
                        ? "Fill preview and product URLs"
                        : !urlsAligned
                          ? "URLs must match"
                          : !quantityOk
                            ? "Enter quantity 1–999"
                            : undefined
                      : undefined
                  }
                >
                  {isAiPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Filling…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Fill details with AI
                    </>
                  )}
                </Button>
                {aiMessage ? (
                  <p
                    className={cn(
                      "mt-2 text-sm",
                      aiMessage.includes("Review") ||
                      aiMessage.includes("filled") ||
                      aiMessage.includes("merchandise cost preview")
                        ? "text-muted-foreground"
                        : "text-destructive"
                    )}
                    role="status"
                  >
                    {aiMessage}
                  </p>
                ) : null}
                {aiMerchPreview ? (
                  <div className="rounded-md border border-border bg-background/80 px-3 py-3 text-foreground">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Merchandise preview (retailer only)
                    </p>
                    {pricePreviewStale ? (
                      <p
                        role="status"
                        className="mt-2 text-xs text-amber-700 dark:text-amber-300"
                      >
                        You changed quantity, size, or color after this run.{" "}
                        <span className="font-medium">
                          Fill details with AI again
                        </span>{" "}
                        to refresh the cost preview.
                      </p>
                    ) : null}
                    <div className="mt-3 space-y-2 tabular-nums text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="text-muted-foreground">
                          Est. unit price
                        </span>
                        <span>{formatUsd(aiMerchPreview.unitPriceCents)}</span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="text-muted-foreground">Quantity</span>
                        <span>{aiMerchPreview.quantity}</span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-2 font-medium">
                        <span>Est. merchandise total</span>
                        <span>
                          {formatUsd(aiMerchPreview.merchandiseSubtotalCents)}
                        </span>
                      </div>
                    </div>
                    {aiMerchPreview.unitPriceCents == null ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        The page did not yield a clear unit price for this variant.
                        Staff will price it when they quote you.
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Service &amp; handling, shipping, and tax are not included—see
                        the notice above.
                      </p>
                    )}
                  </div>
                ) : null}
                {lastAiNotes ? (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">AI note:</span>{" "}
                    {lastAiNotes}
                  </p>
                ) : null}
              </div>
            ) : null}

            <FieldGroup>
              <Field data-invalid={Boolean(fieldError("productUrl")?.length)}>
                <FieldLabel htmlFor="item-product-url">Product link</FieldLabel>
                <FieldContent>
                  <Input
                    id="item-product-url"
                    name="productUrl"
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    placeholder="https://…"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    aria-invalid={Boolean(fieldError("productUrl")?.length)}
                  />
                  <FieldDescription>
                    Paste the product page URL for this request (sent to staff). It must
                    match the Product URL (preview) above—use{" "}
                    <span className="font-medium text-foreground">
                      Use preview URL above
                    </span>{" "}
                    to copy the preview link here.
                  </FieldDescription>
                  <FieldError errors={fieldError("productUrl")?.map((m) => ({ message: m }))} />
                </FieldContent>
              </Field>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-fit"
                onClick={syncPreviewAndProductLink}
                disabled={!canUseUrlSync}
              >
                {hasPreviewUrl
                  ? "Use preview URL above"
                  : "Use product link in preview"}
              </Button>
            </FieldGroup>

            <Separator />

            <Field data-invalid={Boolean(fieldError("productName")?.length)}>
              <FieldLabel htmlFor="item-product-name">
                Product name{" "}
                <span className="font-normal text-muted-foreground">
                  ({mode === "ai" ? "filled by AI or type" : "optional"})
                </span>
              </FieldLabel>
              <FieldContent>
                <Input
                  id="item-product-name"
                  name="productName"
                  placeholder="e.g. Brand — model"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  aria-invalid={Boolean(fieldError("productName")?.length)}
                />
                <FieldError errors={fieldError("productName")?.map((m) => ({ message: m }))} />
              </FieldContent>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={Boolean(fieldError("productSize")?.length)}>
                <FieldLabel htmlFor="item-product-size">
                  Product size{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="item-product-size"
                    name="productSize"
                    placeholder="e.g. M, 10 US, 42 EU"
                    value={productSize}
                    onChange={(e) => setProductSize(e.target.value)}
                    aria-invalid={Boolean(fieldError("productSize")?.length)}
                  />
                  <FieldError errors={fieldError("productSize")?.map((m) => ({ message: m }))} />
                </FieldContent>
              </Field>
              <Field data-invalid={Boolean(fieldError("productColor")?.length)}>
                <FieldLabel htmlFor="item-product-color">
                  Product color{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="item-product-color"
                    name="productColor"
                    placeholder="e.g. Navy, Black / white"
                    value={productColor}
                    onChange={(e) => setProductColor(e.target.value)}
                    aria-invalid={Boolean(fieldError("productColor")?.length)}
                  />
                  <FieldError errors={fieldError("productColor")?.map((m) => ({ message: m }))} />
                </FieldContent>
              </Field>
            </div>

            <Field data-invalid={Boolean(fieldError("quantity")?.length)}>
              <FieldLabel htmlFor="item-quantity">Quantity</FieldLabel>
              <FieldContent>
                <Input
                  id="item-quantity"
                  name="quantity"
                  type="number"
                  min={1}
                  max={999}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="max-w-32"
                  aria-invalid={Boolean(fieldError("quantity")?.length)}
                />
                <FieldError errors={fieldError("quantity")?.map((m) => ({ message: m }))} />
              </FieldContent>
            </Field>

            <Field data-invalid={Boolean(fieldError("note")?.length)}>
              <FieldLabel htmlFor="item-note">
                Note for staff{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <FieldContent>
                <textarea
                  id="item-note"
                  name="note"
                  rows={3}
                  placeholder="Variants, seller preferences, budget cap, etc."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 flex w-full resize-y rounded-lg border px-2.5 py-2 text-sm transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-invalid={Boolean(fieldError("note")?.length)}
                />
                <FieldError errors={fieldError("note")?.map((m) => ({ message: m }))} />
              </FieldContent>
            </Field>

            {hasPreviewUrl &&
            hasProductLinkUrl &&
            !urlsAligned &&
            !fieldErrors?.productUrl?.length ? (
              <p
                role="status"
                className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
              >
                Product URL (preview) and Product link must match. Click{" "}
                <span className="font-medium">Use preview URL above</span> or change
                one field so both use the exact same product page URL.
              </p>
            ) : null}

            {formMessage && (
              <p
                role="status"
                className={`text-sm ${
                  fieldErrors ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {formMessage}
              </p>
            )}

            <Button
              type="button"
              disabled={!canSubmit}
              title={
                !canSubmit && !isPending
                  ? !hasPreviewUrl || !hasProductLinkUrl
                    ? "Fill in Product URL (preview) and Product link"
                    : !urlsAligned
                      ? "Preview URL and product link must match"
                      : !quantityOk
                        ? "Enter a valid quantity (1–999)"
                        : undefined
                  : undefined
              }
              onClick={submit}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit request"
              )}
            </Button>
          </FieldSet>
        </CardContent>
      </Card>
    </div>
  );
}
