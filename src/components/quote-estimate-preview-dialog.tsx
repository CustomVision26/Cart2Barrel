"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { EyeIcon, Loader2Icon, PencilIcon, TriangleAlertIcon } from "lucide-react";

import {
  getQuoteEstimatePreviewAction,
  type GetQuoteEstimatePreviewResult,
  type QuoteEstimateProductMeta,
} from "@/actions/quote-estimate-preview";
import { requestNewItemEstimateAction } from "@/actions/request-new-item-estimate";
import { saveCustomerItemRequestLineDetailsAction } from "@/actions/save-customer-item-request-line-details";
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
import { CollapsibleFieldSection } from "@/components/ui/collapsible-field-section";
import { Separator } from "@/components/ui/separator";
import { AdminStaffNotesBlock } from "@/components/admin-staff-notes-block";
import { OutsidePurchaseReceiptLink } from "@/components/outside-purchase-receipt-link";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";
import { outsidePurchaseQuoteSummaryRows } from "@/lib/outside-purchase-service-quote";
import type { CustomerItemRequestLineDetailsInput } from "@/lib/validations/customer-item-request-line-details";

type QuoteEstimatePreviewDialogProps = {
  itemRequestId: string;
  /** Trigger label */
  label?: string;
  /** `link` — inline text link; `button` — bordered chip (default). */
  triggerVariant?: "button" | "link";
};

function parseQtyInput(raw: string, fallback: number): number {
  const t = raw.trim();
  if (t === "") return fallback;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 99_999);
}

export function QuoteEstimatePreviewDialog({
  itemRequestId,
  label = "Preview quote",
  triggerVariant = "button",
}: QuoteEstimatePreviewDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [isResending, startResend] = useTransition();
  const [payload, setPayload] = useState<GetQuoteEstimatePreviewResult | null>(null);

  const [editing, setEditing] = useState(false);
  const [draftQty, setDraftQty] = useState("");
  const [draftSize, setDraftSize] = useState("");
  const [draftColor, setDraftColor] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendConfirmOpen, setResendConfirmOpen] = useState(false);
  const [pendingResendBody, setPendingResendBody] =
    useState<CustomerItemRequestLineDetailsInput | null>(null);

  const load = useCallback(() => {
    setPayload(null);
    startTransition(async () => {
      const res = await getQuoteEstimatePreviewAction({ itemRequestId });
      setPayload(res);
    });
  }, [itemRequestId]);

  useEffect(() => {
    if (!open) {
      setPayload(null);
      setEditing(false);
      setFeedback(null);
      setError(null);
      setResendConfirmOpen(false);
      setPendingResendBody(null);
      return;
    }
    load();
  }, [open, load]);

  const syncDraftsFromProduct = useCallback((product: QuoteEstimateProductMeta) => {
    setDraftQty(String(product.quantity));
    setDraftSize(product.productSize ?? "");
    setDraftColor(product.productColor ?? "");
  }, []);

  useEffect(() => {
    if (!payload?.ok || !payload.product || editing) return;
    syncDraftsFromProduct(payload.product);
  }, [payload, editing, syncDraftsFromProduct]);

  const quote = payload?.ok ? payload.quote : null;
  const product = payload?.ok ? payload.product : null;
  const loadError = payload && !payload.ok ? payload.message : null;

  const outsidePurchaseServiceOnly = Boolean(
    payload?.ok && payload.outsidePurchaseServiceOnly,
  );
  const outsidePurchaseReceiptUrl =
    payload?.ok && payload.outsidePurchaseReceiptImageUrl ?
      payload.outsidePurchaseReceiptImageUrl
    : null;

  const allowEdit =
    Boolean(payload?.ok && payload.allowCustomerLineEdit && product);
  const allowResend = Boolean(payload?.ok && payload.allowRequestNewEstimate);

  const beginEdit = () => {
    if (!product) return;
    syncDraftsFromProduct(product);
    setEditing(true);
    setFeedback(null);
    setError(null);
  };

  const cancelEdit = () => {
    if (product) syncDraftsFromProduct(product);
    setEditing(false);
    setFeedback(null);
    setError(null);
  };

  const buildDetailsPayload = (): CustomerItemRequestLineDetailsInput | null => {
    if (!product) return null;
    return {
      itemRequestId,
      quantity: parseQtyInput(draftQty, product.quantity),
      productSize: draftSize,
      productColor: draftColor,
    };
  };

  const onSave = () => {
    const body = buildDetailsPayload();
    if (!body) return;
    setFeedback(null);
    setError(null);
    startSave(async () => {
      const res = await saveCustomerItemRequestLineDetailsAction(body);
      if (res.ok) {
        setFeedback(res.message ?? "Saved.");
        setEditing(false);
        load();
        router.refresh();
        return;
      }
      setError(res.message ?? "Could not save.");
    });
  };

  const openResendConfirm = () => {
    const body = buildDetailsPayload();
    if (!body) return;
    setPendingResendBody(body);
    setResendConfirmOpen(true);
  };

  const cancelResendConfirm = () => {
    setResendConfirmOpen(false);
    setPendingResendBody(null);
  };

  const confirmRequestNewEstimate = () => {
    if (!pendingResendBody) return;
    const body = pendingResendBody;
    cancelResendConfirm();
    setFeedback(null);
    setError(null);
    startResend(async () => {
      const res = await requestNewItemEstimateAction(body);
      if (res.ok) {
        setFeedback(res.message ?? "Submitted.");
        setEditing(false);
        load();
        router.refresh();
        return;
      }
      setError(res.message ?? "Could not submit.");
    });
  };

  const showProductDetails = Boolean(product);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          type="button"
          className={cn(
            "inline-flex items-center gap-1 font-medium transition-colors",
            triggerVariant === "link" ?
              "text-sm text-primary underline-offset-2 hover:underline"
            : "rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground shadow-sm hover:bg-muted/60",
          )}
        >
          {triggerVariant === "button" ?
            <EyeIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
          : null}
          {label}
        </DialogTrigger>
        <DialogContent className="z-[60] flex max-h-[min(90vh,42rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 space-y-1.5 border-b border-border px-4 py-3 pr-10">
          <DialogTitle>
            {outsidePurchaseServiceOnly ? "Service & handling" : "Quote estimate"}
          </DialogTitle>
          <DialogDescription>
            {outsidePurchaseServiceOnly ?
              "Outside purchase — customer pays service & handling only (per unit × quantity)."
            : "Item details and the latest saved quote (merchandise, fees, shipping, tax, total) when available."}
          </DialogDescription>
          {outsidePurchaseServiceOnly && outsidePurchaseReceiptUrl ? (
            <p className="text-xs">
              <OutsidePurchaseReceiptLink
                url={outsidePurchaseReceiptUrl}
                className="text-xs font-medium text-primary"
              />
              <span className="sr-only"> (opens in a new tab)</span>
            </p>
          ) : null}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-4 [scrollbar-gutter:stable]">
        {isPending ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading…
          </div>
        ) : loadError ? (
          <p className="text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : (
          <div className="min-w-0 space-y-4 text-sm">
            {showProductDetails && product ? (
              <div className="min-w-0 space-y-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                <div className="flex gap-3">
                  <ProductRequestThumbnail
                    variant="dialog"
                    imageUrl={product.productImageUrl}
                    productLabel={product.productName}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    {product.productName ? (
                      <p className="font-medium leading-snug text-foreground">
                        {product.productName}
                      </p>
                    ) : null}

                    {!editing ? (
                      <dl className="space-y-1 text-xs text-muted-foreground sm:text-sm">
                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                      <dt>Quantity</dt>
                      <dd className="tabular-nums text-foreground">{product.quantity}</dd>
                    </div>
                    {product.productSize ? (
                      <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                        <dt>Size</dt>
                        <dd className="text-foreground">{product.productSize}</dd>
                      </div>
                    ) : null}
                    {product.productColor ? (
                      <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                        <dt>Color</dt>
                        <dd className="text-foreground">{product.productColor}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : (
                  <div className="flex min-w-0 flex-col gap-3">
                    <Field className="min-w-0 gap-1.5">
                      <FieldLabel htmlFor="qe-qty" className="text-xs">
                        Quantity
                      </FieldLabel>
                      <FieldContent>
                        <Input
                          id="qe-qty"
                          className="w-full min-w-0"
                          inputMode="numeric"
                          value={draftQty}
                          onChange={(e) => setDraftQty(e.target.value)}
                          autoComplete="off"
                          min={1}
                        />
                      </FieldContent>
                    </Field>
                    <Field className="min-w-0 gap-1.5">
                      <FieldLabel htmlFor="qe-size" className="text-xs">
                        Size
                      </FieldLabel>
                      <FieldContent>
                        <Input
                          id="qe-size"
                          className="w-full min-w-0"
                          value={draftSize}
                          onChange={(e) => setDraftSize(e.target.value)}
                          placeholder={
                            product.productSize ? undefined : "If applicable"
                          }
                          autoComplete="off"
                        />
                      </FieldContent>
                    </Field>
                    <Field className="min-w-0 gap-1.5">
                      <FieldLabel htmlFor="qe-color" className="text-xs">
                        Color
                      </FieldLabel>
                      <FieldContent>
                        <Input
                          id="qe-color"
                          className="w-full min-w-0"
                          value={draftColor}
                          onChange={(e) => setDraftColor(e.target.value)}
                          placeholder={
                            product.productColor ? undefined : "If applicable"
                          }
                          autoComplete="off"
                        />
                      </FieldContent>
                    </Field>
                  </div>
                )}
                  </div>
                </div>

                {allowEdit ? (
                  <div className="space-y-2 pt-1">
                    {editing && allowResend ? (
                      <div
                        role="alert"
                        className="flex gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-foreground dark:border-amber-400/25 dark:bg-amber-400/10"
                      >
                        <TriangleAlertIcon
                          className="size-4 shrink-0 text-amber-800 dark:text-amber-400"
                          aria-hidden
                        />
                        <p>
                          <span className="font-medium text-foreground">
                            Request new estimate
                          </span>
                          {" — "}
                          Your current quote will be marked superseded (it remains visible
                          to staff). Staff will prepare new pricing using the{" "}
                          <span className="font-medium text-foreground">
                            quantity, size, and color
                          </span>{" "}
                          shown in the fields above. You’ll confirm in a quick second step.
                        </p>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                    {!editing ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        onClick={beginEdit}
                      >
                        <PencilIcon className="size-3.5" aria-hidden />
                        Edit details
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSaving || isResending}
                          className="gap-1.5"
                          onClick={onSave}
                        >
                          {isSaving ? (
                            <>
                              <Loader2Icon className="size-3.5 animate-spin" />
                              Saving…
                            </>
                          ) : (
                            "Save"
                          )}
                        </Button>
                        {allowResend ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            disabled={isSaving || isResending}
                            className="gap-1.5"
                            onClick={openResendConfirm}
                          >
                            {isResending ? (
                              <>
                                <Loader2Icon className="size-3.5 animate-spin" />
                                Sending…
                              </>
                            ) : (
                              "Request new estimate"
                            )}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isSaving || isResending}
                          onClick={cancelEdit}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {feedback ? (
              <p className="text-sm text-muted-foreground" role="status">
                {feedback}
              </p>
            ) : null}

            {quote == null ? (
              <p className="text-sm text-muted-foreground">
                No saved quote yet. When staff saves a quote from the admin estimate,
                it will appear here.
              </p>
            ) : (
              <>
                {showProductDetails ? <Separator /> : null}
                {outsidePurchaseServiceOnly ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Your charges
                    </p>
                    <ul className="space-y-2.5 tabular-nums">
                      {outsidePurchaseQuoteSummaryRows({
                        serviceFee: quote.serviceFee,
                        requestQuantity: quote.quotedRequestLine?.quantity ?? null,
                        totalPrice: quote.totalPrice,
                        staffNote: quote.staffNote,
                      }).map((row) => (
                        <li
                          key={row.label}
                          className={cn(
                            "flex justify-between gap-3 text-sm",
                            row.emphasis ?
                              "border-t border-border/80 pt-2.5 text-base font-semibold text-foreground"
                            : "text-muted-foreground",
                          )}
                        >
                          <span>
                            {row.label}
                            {row.detail ?
                              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                                {row.detail}
                              </span>
                            : null}
                          </span>
                          <span className="shrink-0 text-foreground">
                            {formatUsd(row.amountCents)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {quote.quotedRequestLine &&
                outsidePurchaseServiceOnly &&
                showProductDetails ? (
                  <CollapsibleFieldSection
                    compact
                    title="Line staff priced against"
                    description="Snapshot saved with this estimate"
                    defaultOpen={false}
                  >
                    <dl className="space-y-1 text-xs text-muted-foreground">
                      {quote.quotedRequestLine.productName ? (
                        <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                          <dt>Product</dt>
                          <dd className="max-w-[70%] text-right text-foreground">
                            {quote.quotedRequestLine.productName}
                          </dd>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                        <dt>Quantity</dt>
                        <dd className="tabular-nums text-foreground">
                          {quote.quotedRequestLine.quantity}
                        </dd>
                      </div>
                      {quote.quotedRequestLine.productSize ? (
                        <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                          <dt>Size</dt>
                          <dd className="text-foreground">
                            {quote.quotedRequestLine.productSize}
                          </dd>
                        </div>
                      ) : null}
                      {quote.quotedRequestLine.productColor ? (
                        <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                          <dt>Color</dt>
                          <dd className="text-foreground">
                            {quote.quotedRequestLine.productColor}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </CollapsibleFieldSection>
                ) : quote.quotedRequestLine ? (
                  <div className="rounded-md border border-border bg-muted/15 px-3 py-2 text-xs">
                    <p className="mb-1.5 font-medium text-foreground">
                      Line staff priced against (saved with this estimate)
                    </p>
                    <dl className="space-y-1 text-muted-foreground">
                      {quote.quotedRequestLine.productName ? (
                        <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                          <dt>Product</dt>
                          <dd className="max-w-[70%] text-right text-foreground">
                            {quote.quotedRequestLine.productName}
                          </dd>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                        <dt>Quantity</dt>
                        <dd className="tabular-nums text-foreground">
                          {quote.quotedRequestLine.quantity}
                        </dd>
                      </div>
                      {quote.quotedRequestLine.productSize ? (
                        <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                          <dt>Size</dt>
                          <dd className="text-foreground">
                            {quote.quotedRequestLine.productSize}
                          </dd>
                        </div>
                      ) : null}
                      {quote.quotedRequestLine.productColor ? (
                        <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                          <dt>Color</dt>
                          <dd className="text-foreground">
                            {quote.quotedRequestLine.productColor}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                ) : null}
                {!outsidePurchaseServiceOnly ? (
                  <ul className="space-y-2 tabular-nums text-muted-foreground">
                    {quote.merchandiseSavingsCents != null &&
                    quote.merchandiseSavingsCents > 0 ? (
                      <>
                        <li className="flex justify-between gap-2">
                          <span>Pack / bundle subtotal (listed)</span>
                          <span className="text-foreground">
                            {formatUsd(
                              quote.itemCost + quote.merchandiseSavingsCents,
                            )}
                          </span>
                        </li>
                        <li className="flex justify-between gap-2">
                          <span>Savings</span>
                          <span className="text-foreground">
                            −{formatUsd(quote.merchandiseSavingsCents)}
                          </span>
                        </li>
                      </>
                    ) : null}
                    <li className="flex justify-between gap-2">
                      <span>
                        {quote.merchandiseSavingsCents != null &&
                        quote.merchandiseSavingsCents > 0
                          ? "Merchandise subtotal (pack line)"
                          : "Merchandise"}
                      </span>
                      <span className="text-foreground">{formatUsd(quote.itemCost)}</span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span>Service &amp; handling</span>
                      <span className="text-foreground">{formatUsd(quote.serviceFee)}</span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span>Shipping (est.)</span>
                      <span className="text-foreground">
                        {formatUsd(quote.estimatedShipping)}
                      </span>
                    </li>
                    <li className="flex justify-between gap-2">
                      <span>Tax</span>
                      <span className="text-foreground">{formatUsd(quote.taxCents)}</span>
                    </li>
                    <li className="flex justify-between gap-2 border-t border-border pt-2 font-medium text-foreground">
                      <span>Total</span>
                      <span>{formatUsd(quote.totalPrice)}</span>
                    </li>
                  </ul>
                ) : null}
                <AdminStaffNotesBlock staffNote={quote.staffNote} />
                <p className="text-xs text-muted-foreground">
                  Quoted{" "}
                  <time dateTime={quote.quotedAt}>
                    {new Date(quote.quotedAt).toLocaleString()}
                  </time>
                  {outsidePurchaseServiceOnly ?
                    ". Merchandise was purchased elsewhere and is not billed here."
                  : ". Tax is the remainder of total minus line items (as saved)."}
                </p>
              </>
            )}
          </div>
        )}
        </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resendConfirmOpen}
        onOpenChange={(next) => {
          setResendConfirmOpen(next);
          if (!next) setPendingResendBody(null);
        }}
      >
        <DialogContent showCloseButton={false} className="z-[60] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request a new estimate?</DialogTitle>
            <DialogDescription className="text-pretty">
              Your current quote will be set aside so staff can price this request again.
              Earlier estimates remain in staff history—you are not deleting anything.
            </DialogDescription>
          </DialogHeader>

          {pendingResendBody ? (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs">
              <p className="mb-2 font-medium text-foreground">Staff will use:</p>
              {product?.productName?.trim() ? (
                <p className="mb-2 text-foreground">{product.productName.trim()}</p>
              ) : null}
              <dl className="grid gap-1.5 text-muted-foreground">
                <div className="flex justify-between gap-4">
                  <dt>Quantity</dt>
                  <dd className="tabular-nums text-foreground">
                    {pendingResendBody.quantity}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Size</dt>
                  <dd className="text-right text-foreground">
                    {pendingResendBody.productSize?.trim() || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Color</dt>
                  <dd className="text-right text-foreground">
                    {pendingResendBody.productColor?.trim() || "—"}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="sm:min-w-0"
              onClick={cancelResendConfirm}
            >
              Keep current quote
            </Button>
            <Button
              type="button"
              className="gap-1.5 sm:min-w-[11rem]"
              onClick={confirmRequestNewEstimate}
            >
              Yes, send request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
