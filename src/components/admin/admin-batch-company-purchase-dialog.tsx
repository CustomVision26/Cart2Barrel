"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { confirmCompanyPurchaseAction } from "@/actions/admin-confirm-company-purchase";
import { AdminMerchandiseReconciliationPanel } from "@/components/admin/admin-merchandise-reconciliation-panel";
import { AdminRetailerReceiptImagesField } from "@/components/admin/admin-retailer-receipt-images-field";
import {
  defaultWarehouseReceiptIntakeDraft,
  WarehouseReceiptIntakeFields,
  type WarehouseReceiptIntakeDraft,
} from "@/components/admin/warehouse-receipt-intake-fields";
import { CartLinePriceBreakdown } from "@/components/dashboard/cart-line-price-breakdown";
import { DashboardCheckoutChargesPreviewDialog } from "@/components/dashboard/dashboard-checkout-charges-preview-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { CollapsibleFieldSection } from "@/components/ui/collapsible-field-section";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  batchEstimateSummaryRows,
  batchLineShareSummaryRows,
} from "@/lib/admin-order-estimate-summary-rows";
import { formatUsd } from "@/lib/admin-markup";
import type { BatchLineShare } from "@/lib/batch-line-share";
import type { BatchQuoteEstimate } from "@/db/schema";
import type { ReconciliationProductLineInput } from "@/lib/merchandise-reconciliation";
import { cn } from "@/lib/utils";

export type AdminBatchPurchaseLine = {
  orderItemId: string;
  productName: string;
  retailerLabel: string;
  productUrl: string;
  quantity: number;
  sizeLabel: string | null;
  colorLabel: string | null;
  linePriceCents: number;
  refundedCents: number;
  batchShare: BatchLineShare | null;
  initialReceiptImageUrls?: string[] | null;
};

type DeliveryTab = "tracking" | "store_pickup";

function defaultStorePickupAtLocalValue(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function storePickupAtLocalToIso(localValue: string): string | null {
  const trimmed = localValue.trim();
  if (trimmed === "") return null;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

/** One Review-and-approve dialog for every pending line in a paid batch. */
export function AdminBatchCompanyPurchaseDialog({
  batchLabel,
  orderId,
  batchSessionId,
  batchEstimate,
  lines,
  triggerLabel = "Review and approve",
}: {
  batchLabel: string;
  orderId: string;
  batchSessionId: string;
  batchEstimate?: BatchQuoteEstimate | null;
  lines: AdminBatchPurchaseLine[];
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deliveryTab, setDeliveryTab] = useState<DeliveryTab>("tracking");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [retailerTrackingCompany, setRetailerTrackingCompany] = useState("");
  const [retailerTrackingNumber, setRetailerTrackingNumber] = useState("");
  const [storePickupAtLocal, setStorePickupAtLocal] = useState(() =>
    defaultStorePickupAtLocalValue(),
  );
  const [pickupByItemId, setPickupByItemId] = useState<
    Record<string, WarehouseReceiptIntakeDraft>
  >(() => Object.fromEntries(
    lines.map((line) => [
      line.orderItemId,
      defaultWarehouseReceiptIntakeDraft(line.quantity),
    ]),
  ));
  const [pending, startTransition] = useTransition();
  const [reconciliationAllowsPurchase, setReconciliationAllowsPurchase] =
    useState(false);

  const eligibleLines = useMemo(
    () =>
      lines.filter(
        (line) => Math.max(0, line.linePriceCents - line.refundedCents) > 0,
      ),
    [lines],
  );

  const batchCheckoutMerchandiseCents = useMemo(() => {
    if (batchEstimate) return batchEstimate.siteMerchandiseTotalCents;
    return eligibleLines.reduce(
      (sum, line) => sum + (line.batchShare?.merchandise ?? 0),
      0,
    );
  }, [batchEstimate, eligibleLines]);

  const batchCheckoutShippingCents = useMemo(() => {
    if (batchEstimate) return batchEstimate.siteShippingTotalCents;
    return eligibleLines.reduce(
      (sum, line) => sum + (line.batchShare?.shipping ?? 0),
      0,
    );
  }, [batchEstimate, eligibleLines]);

  const batchCheckoutTaxCents = useMemo(() => {
    if (batchEstimate) return batchEstimate.siteSaleTaxTotalCents;
    return eligibleLines.reduce(
      (sum, line) => sum + (line.batchShare?.tax ?? 0),
      0,
    );
  }, [batchEstimate, eligibleLines]);

  const batchCheckoutServiceCents = useMemo(() => {
    if (batchEstimate) return batchEstimate.serviceHandlingTotalCents;
    return eligibleLines.reduce(
      (sum, line) => sum + (line.batchShare?.serviceFee ?? 0),
      0,
    );
  }, [batchEstimate, eligibleLines]);

  const customerCheckoutTotalCents = useMemo(() => {
    if (batchEstimate) return batchEstimate.subtotalCents;
    return eligibleLines.reduce((sum, line) => sum + line.linePriceCents, 0);
  }, [batchEstimate, eligibleLines]);

  const batchProducts = useMemo(
    (): ReconciliationProductLineInput[] =>
      eligibleLines.map((line) => ({
        productName: line.productName,
        productNumber: line.orderItemId,
        quantity: line.quantity,
        sizeLabel: line.sizeLabel,
        colorLabel: line.colorLabel,
        checkoutMerchandiseCents: line.batchShare?.merchandise ?? 0,
        checkoutShippingCents: line.batchShare?.shipping ?? 0,
        checkoutTaxCents: line.batchShare?.tax ?? 0,
        checkoutServiceCents: line.batchShare?.serviceFee ?? 0,
      })),
    [eligibleLines],
  );

  const batchRefundedCents = useMemo(
    () => eligibleLines.reduce((sum, line) => sum + line.refundedCents, 0),
    [eligibleLines],
  );

  const anchorOrderItemId = eligibleLines[0]?.orderItemId ?? null;
  const relatedOrderItemIds = useMemo(
    () => eligibleLines.slice(1).map((line) => line.orderItemId),
    [eligibleLines],
  );
  /** One shared receipt upload for the batch (anchor line). */
  const batchReceiptInitialUrls = useMemo(() => {
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const line of eligibleLines) {
      for (const url of line.initialReceiptImageUrls ?? []) {
        const trimmed = url.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        urls.push(trimmed);
      }
    }
    return urls;
  }, [eligibleLines]);

  const resetForm = useCallback(() => {
    setDeliveryTab("tracking");
    setTrackingUrl("");
    setRetailerTrackingCompany("");
    setRetailerTrackingNumber("");
    setStorePickupAtLocal(defaultStorePickupAtLocalValue());
    setPickupByItemId(
      Object.fromEntries(
        lines.map((line) => [
          line.orderItemId,
          defaultWarehouseReceiptIntakeDraft(line.quantity),
        ]),
      ),
    );
  }, [lines]);

  const submitTracking = useCallback(() => {
    const companyTrim = retailerTrackingCompany.trim();
    const numberTrim = retailerTrackingNumber.trim();
    if (numberTrim !== "" && companyTrim === "") {
      toast.error(
        "Enter the retailer / carrier tracking company name when you add a tracking number.",
      );
      return;
    }
    if (companyTrim !== "" && numberTrim === "") {
      toast.error(
        "Enter the tracking number when you add a retailer / carrier name.",
      );
      return;
    }
    if (eligibleLines.length === 0) {
      toast.error("No refundable batch lines left to approve.");
      return;
    }
    startTransition(async () => {
      let okCount = 0;
      let lastError: string | null = null;
      for (const line of eligibleLines) {
        const res = await confirmCompanyPurchaseAction({
          deliveryMode: "tracking",
          orderItemId: line.orderItemId,
          trackingUrl: trackingUrl.trim() === "" ? undefined : trackingUrl.trim(),
          retailerTrackingCompany: companyTrim === "" ? undefined : companyTrim,
          retailerTrackingNumber: numberTrim === "" ? undefined : numberTrim,
        });
        if (res.ok) {
          okCount += 1;
        } else {
          lastError = res.message;
        }
      }
      if (okCount > 0) {
        toast.success(
          okCount === eligibleLines.length ?
            `Recorded company purchase for ${okCount} batch ${okCount === 1 ? "line" : "lines"}.`
          : `Recorded purchase for ${okCount} of ${eligibleLines.length} lines.${lastError ? ` ${lastError}` : ""}`,
        );
        setOpen(false);
        resetForm();
        router.refresh();
      } else {
        toast.error(lastError ?? "Could not approve batch purchase.");
      }
    });
  }, [
    eligibleLines,
    resetForm,
    retailerTrackingCompany,
    retailerTrackingNumber,
    router,
    trackingUrl,
  ]);

  const submitStorePickup = useCallback(() => {
    const pickupIso = storePickupAtLocalToIso(storePickupAtLocal);
    if (!pickupIso) {
      toast.error("Choose when the items were picked up from the store.");
      return;
    }
    if (eligibleLines.length === 0) {
      toast.error("No refundable batch lines left to approve.");
      return;
    }
    startTransition(async () => {
      let okCount = 0;
      let lastError: string | null = null;
      for (const line of eligibleLines) {
        const intake =
          pickupByItemId[line.orderItemId] ??
          defaultWarehouseReceiptIntakeDraft(line.quantity);
        const res = await confirmCompanyPurchaseAction({
          deliveryMode: "store_pickup",
          orderItemId: line.orderItemId,
          storePickupAt: pickupIso,
          receivedQty: intake.receivedQty,
          condition: intake.condition,
          missingReason:
            intake.condition === "missing" ? intake.missingReason : undefined,
          shelfLocation: intake.shelfLocation,
          proofPhotoCount: intake.proofPhotoUrls.length,
          proofPhotoUrls:
            intake.proofPhotoUrls.length > 0 ? intake.proofPhotoUrls : undefined,
          barcodeValue:
            intake.barcodeValue.trim() === "" ?
              undefined
            : intake.barcodeValue.trim(),
          conditionNotes:
            intake.conditionNotes.trim() === "" ?
              undefined
            : intake.conditionNotes.trim(),
        });
        if (res.ok) {
          okCount += 1;
        } else {
          lastError = res.message;
        }
      }
      if (okCount > 0) {
        toast.success(
          okCount === eligibleLines.length ?
            `Recorded store pickup for ${okCount} batch ${okCount === 1 ? "line" : "lines"}.`
          : `Recorded pickup for ${okCount} of ${eligibleLines.length} lines.${lastError ? ` ${lastError}` : ""}`,
        );
        setOpen(false);
        resetForm();
        router.refresh();
      } else {
        toast.error(lastError ?? "Could not approve batch store pickup.");
      }
    });
  }, [
    eligibleLines,
    pickupByItemId,
    resetForm,
    router,
    storePickupAtLocal,
  ]);

  const submit =
    deliveryTab === "tracking" ? submitTracking : submitStorePickup;

  const tabClass = (selected: boolean) =>
    cn(
      "-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors sm:text-sm",
      selected ?
        "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
    );

  if (eligibleLines.length === 0) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        resetForm();
      }}
    >
      <DialogTrigger
        type="button"
        className={cn(buttonVariants({ variant: "default", size: "sm" }))}
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Confirm batch company purchase</DialogTitle>
          <DialogDescription>
            Record that Amani Cart2Barrel purchased every pending product in this batch.
            Choose one shared shipment or store pickup; product details are listed
            once each below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/35 bg-primary/10 px-3 py-2">
            <p className="text-xs font-medium text-foreground">
              Batch bundle ·{" "}
              <span className="font-mono text-[13px]">{batchLabel}</span>
              <span className="ml-2 font-normal text-muted-foreground">
                · {eligibleLines.length}{" "}
                {eligibleLines.length === 1 ? "product" : "products"}
              </span>
            </p>
            <DashboardCheckoutChargesPreviewDialog
              scope="batch"
              orderId={orderId}
              batchSessionId={batchSessionId}
              triggerLabel="Batch charges"
            />
          </div>

          {batchEstimate ?
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Batch estimate (checkout)
              </p>
              <CartLinePriceBreakdown
                rows={batchEstimateSummaryRows(batchEstimate)}
              />
            </div>
          : null}

          {anchorOrderItemId ?
            <AdminMerchandiseReconciliationPanel
              orderItemId={anchorOrderItemId}
              productName={`Batch ${batchLabel}`}
              checkoutMerchandiseCents={batchCheckoutMerchandiseCents}
              checkoutShippingCents={batchCheckoutShippingCents}
              checkoutTaxCents={batchCheckoutTaxCents}
              checkoutServiceCents={batchCheckoutServiceCents}
              customerCheckoutTotalCents={customerCheckoutTotalCents}
              linePriceCents={customerCheckoutTotalCents}
              refundedCents={batchRefundedCents}
              relatedOrderItemIds={relatedOrderItemIds}
              products={batchProducts}
              dialogOpen={open}
              onAllowsPurchaseChange={setReconciliationAllowsPurchase}
            />
          : null}

          <div className="space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Products in this approval
            </p>
            {eligibleLines.map((line) => {
              const refundable = Math.max(
                0,
                line.linePriceCents - line.refundedCents,
              );
              const showAttrs =
                (line.sizeLabel?.trim().length ?? 0) > 0 ||
                (line.colorLabel?.trim().length ?? 0) > 0;
              const productTitle =
                line.productName.trim().length > 52 ?
                  `${line.productName.trim().slice(0, 52)}…`
                : line.productName.trim() || "Product";
              return (
                <div key={line.orderItemId} className="space-y-3">
                  <CollapsibleFieldSection
                    title={productTitle}
                    description={`Checkout ${formatUsd(line.linePriceCents)} · Qty ${line.quantity}`}
                    defaultOpen={false}
                    compact
                    id={`batch-approval-product-${line.orderItemId}`}
                    className="bg-secondary"
                  >
                    <dl className="grid gap-2">
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-xs font-medium text-muted-foreground">
                          Product
                        </dt>
                        <dd className="font-medium leading-snug text-foreground">
                          {line.productName}
                        </dd>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-xs font-medium text-muted-foreground">
                            Retailer
                          </dt>
                          <dd className="text-foreground">{line.retailerLabel}</dd>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-xs font-medium text-muted-foreground">
                            Quantity
                          </dt>
                          <dd className="tabular-nums text-foreground">
                            {line.quantity}
                          </dd>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <dt className="text-xs font-medium text-muted-foreground">
                          Link
                        </dt>
                        <dd>
                          <a
                            href={line.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Product URL
                          </a>
                        </dd>
                      </div>
                      {line.sizeLabel?.trim() ?
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-xs font-medium text-muted-foreground">
                            Size
                          </dt>
                          <dd className="text-foreground">
                            {line.sizeLabel.trim()}
                          </dd>
                        </div>
                      : null}
                      {line.colorLabel?.trim() ?
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-xs font-medium text-muted-foreground">
                            Color
                          </dt>
                          <dd className="text-foreground">
                            {line.colorLabel.trim()}
                          </dd>
                        </div>
                      : null}
                      {!showAttrs ?
                        <div className="flex flex-col gap-0.5">
                          <dt className="text-xs font-medium text-muted-foreground">
                            Variant
                          </dt>
                          <dd className="text-foreground">Single</dd>
                        </div>
                      : null}
                      <div className="flex flex-col gap-0.5 border-t border-border pt-2">
                        <dt className="text-xs font-medium text-muted-foreground">
                          Checkout line total
                        </dt>
                        <dd className="font-semibold tabular-nums text-foreground">
                          {formatUsd(line.linePriceCents)}
                        </dd>
                        {line.refundedCents > 0 ?
                          <p className="text-xs text-muted-foreground">
                            Refunded {formatUsd(line.refundedCents)} · Net{" "}
                            {formatUsd(refundable)}
                          </p>
                        : null}
                      </div>
                    </dl>
                    {line.batchShare ?
                      <CartLinePriceBreakdown
                        rows={batchLineShareSummaryRows(line.batchShare)}
                      />
                    : null}
                  </CollapsibleFieldSection>
                  {deliveryTab === "store_pickup" ?
                    <fieldset className="space-y-3 rounded-lg border border-border/80 bg-muted p-3">
                      <legend className="px-1 text-xs font-medium text-foreground">
                        Received delivery intake
                      </legend>
                      <WarehouseReceiptIntakeFields
                        idPrefix={line.orderItemId}
                        orderedQty={line.quantity}
                        draft={
                          pickupByItemId[line.orderItemId] ??
                          defaultWarehouseReceiptIntakeDraft(line.quantity)
                        }
                        disabled={pending}
                        lineLabel={line.productName}
                        onChange={(patch) =>
                          setPickupByItemId((prev) => ({
                            ...prev,
                            [line.orderItemId]: {
                              ...(prev[line.orderItemId] ??
                                defaultWarehouseReceiptIntakeDraft(line.quantity)),
                              ...patch,
                            },
                          }))
                        }
                      />
                    </fieldset>
                  : null}
                </div>
              );
            })}
            {anchorOrderItemId ?
              <AdminRetailerReceiptImagesField
                orderItemId={anchorOrderItemId}
                initialUrls={batchReceiptInitialUrls}
                disabled={pending}
                dialogOpen={open}
              />
            : null}
          </div>

          <div className="space-y-3">
            <div
              role="tablist"
              aria-label="Delivery method"
              className="flex flex-wrap gap-1 border-b border-border"
            >
              <button
                type="button"
                role="tab"
                aria-selected={deliveryTab === "tracking"}
                className={tabClass(deliveryTab === "tracking")}
                onClick={() => setDeliveryTab("tracking")}
                disabled={pending}
              >
                Tracking delivery
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={deliveryTab === "store_pickup"}
                className={tabClass(deliveryTab === "store_pickup")}
                onClick={() => setDeliveryTab("store_pickup")}
                disabled={pending}
              >
                Pickup from store
              </button>
            </div>

            {deliveryTab === "tracking" ?
              <div role="tabpanel" className="space-y-4">
                <p className="text-[11px] text-muted-foreground">
                  Shared tracking applies to every product listed above.
                </p>
                <div className="space-y-2">
                  <Label htmlFor={`batch-purchase-tracking-${batchSessionId}`}>
                    Tracking URL (optional)
                  </Label>
                  <Input
                    id={`batch-purchase-tracking-${batchSessionId}`}
                    type="url"
                    inputMode="url"
                    placeholder="https:// …"
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    disabled={pending}
                    autoComplete="off"
                  />
                </div>
                <fieldset className="space-y-2 rounded-lg border border-border/80 bg-muted p-3">
                  <legend className="px-1 text-xs font-medium text-foreground">
                    Retailer shipment tracking (optional)
                  </legend>
                  <div className="space-y-2">
                    <Label
                      htmlFor={`batch-purchase-retailer-carrier-${batchSessionId}`}
                    >
                      Tracking company
                    </Label>
                    <Input
                      id={`batch-purchase-retailer-carrier-${batchSessionId}`}
                      type="text"
                      placeholder="UPS, USPS, Retailer pickup, …"
                      value={retailerTrackingCompany}
                      onChange={(e) => setRetailerTrackingCompany(e.target.value)}
                      disabled={pending}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor={`batch-purchase-retailer-tracking-${batchSessionId}`}
                    >
                      Tracking number
                    </Label>
                    <Input
                      id={`batch-purchase-retailer-tracking-${batchSessionId}`}
                      type="text"
                      spellCheck={false}
                      placeholder="Paste tracking ID"
                      value={retailerTrackingNumber}
                      onChange={(e) => setRetailerTrackingNumber(e.target.value)}
                      disabled={pending}
                      autoComplete="off"
                    />
                  </div>
                </fieldset>
              </div>
            : <div role="tabpanel" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`batch-purchase-pickup-at-${batchSessionId}`}>
                    Pickup date &amp; time
                  </Label>
                  <Input
                    id={`batch-purchase-pickup-at-${batchSessionId}`}
                    type="datetime-local"
                    value={storePickupAtLocal}
                    onChange={(e) => setStorePickupAtLocal(e.target.value)}
                    disabled={pending}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Shared pickup time for this batch. Per-product intake is above
                    each product card.
                  </p>
                </div>
              </div>
            }
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || !reconciliationAllowsPurchase}
            onClick={submit}
          >
            {pending ?
              "Saving…"
            : `Approve ${eligibleLines.length} ${eligibleLines.length === 1 ? "purchase" : "purchases"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
