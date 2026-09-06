"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
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
  batchLineShareSummaryRows,
  singleQuoteSummaryRows,
} from "@/lib/admin-order-estimate-summary-rows";
import { formatUsd } from "@/lib/admin-markup";
import type { BatchLineShare } from "@/lib/batch-line-share";
import type { ItemQuote } from "@/db/schema";
import { lineSaleTaxCentsFromQuote } from "@/lib/quote-line-tax";
import { cn } from "@/lib/utils";

export type AdminCompanyPurchaseDialogProps = {
  orderItemId: string;
  productName: string;
  retailerLabel: string;
  productUrl: string;
  quantity: number;
  sizeLabel: string | null;
  colorLabel: string | null;
  quotedMerchandiseCostCents: number | null;
  linePriceCents: number;
  refundedCents: number;
  batchLabel: string | null;
  orderId: string;
  batchSessionId: string | null;
  batchShare: BatchLineShare | null;
  /** Latest staff quote — used for single-line charge breakdown. */
  quote?: ItemQuote | null;
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

/** Approve paid lines awaiting company purchase; outcomes use Sonner toasts. */
export function AdminCompanyPurchaseDialog(
  props: AdminCompanyPurchaseDialogProps & {
    initialReceiptImageUrls?: string[] | null;
  },
) {
  const {
    orderItemId,
    productName,
    retailerLabel,
    productUrl,
    quantity,
    sizeLabel,
    colorLabel,
    quotedMerchandiseCostCents,
    linePriceCents,
    refundedCents,
    batchLabel,
    orderId,
    batchSessionId,
    batchShare,
    quote = null,
    initialReceiptImageUrls,
  } = props;

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deliveryTab, setDeliveryTab] = useState<DeliveryTab>("tracking");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [retailerTrackingCompany, setRetailerTrackingCompany] = useState("");
  const [retailerTrackingNumber, setRetailerTrackingNumber] = useState("");
  const [storePickupAtLocal, setStorePickupAtLocal] = useState(() =>
    defaultStorePickupAtLocalValue(),
  );
  const [pickupIntake, setPickupIntake] = useState<WarehouseReceiptIntakeDraft>(
    () => defaultWarehouseReceiptIntakeDraft(quantity),
  );
  const [pending, startTransition] = useTransition();
  const [reconciliationAllowsPurchase, setReconciliationAllowsPurchase] =
    useState(false);

  const refundable = Math.max(0, linePriceCents - refundedCents);
  const checkoutMerchandiseCents =
    batchShare?.merchandise ??
    quotedMerchandiseCostCents ??
    quote?.itemCost ??
    0;
  const checkoutShippingCents =
    batchShare?.shipping ?? quote?.estimatedShipping ?? 0;
  const checkoutTaxCents =
    batchShare?.tax ?? (quote ? lineSaleTaxCentsFromQuote(quote) : 0);
  const checkoutServiceCents =
    batchShare?.serviceFee ?? quote?.serviceFee ?? 0;

  const resetForm = useCallback(() => {
    setDeliveryTab("tracking");
    setTrackingUrl("");
    setRetailerTrackingCompany("");
    setRetailerTrackingNumber("");
    setStorePickupAtLocal(defaultStorePickupAtLocalValue());
    setPickupIntake(defaultWarehouseReceiptIntakeDraft(quantity));
  }, [quantity]);

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
    startTransition(async () => {
      const res = await confirmCompanyPurchaseAction({
        deliveryMode: "tracking",
        orderItemId,
        trackingUrl: trackingUrl.trim() === "" ? undefined : trackingUrl.trim(),
        retailerTrackingCompany: companyTrim === "" ? undefined : companyTrim,
        retailerTrackingNumber: numberTrim === "" ? undefined : numberTrim,
      });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        resetForm();
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }, [
    orderItemId,
    resetForm,
    retailerTrackingCompany,
    retailerTrackingNumber,
    router,
    trackingUrl,
  ]);

  const submitStorePickup = useCallback(() => {
    const pickupIso = storePickupAtLocalToIso(storePickupAtLocal);
    if (!pickupIso) {
      toast.error("Choose when the item was picked up from the store.");
      return;
    }
    startTransition(async () => {
      const res = await confirmCompanyPurchaseAction({
        deliveryMode: "store_pickup",
        orderItemId,
        storePickupAt: pickupIso,
        receivedQty: pickupIntake.receivedQty,
        condition: pickupIntake.condition,
        missingReason:
          pickupIntake.condition === "missing" ?
            pickupIntake.missingReason
          : undefined,
        shelfLocation: pickupIntake.shelfLocation,
        proofPhotoCount: pickupIntake.proofPhotoUrls.length,
        proofPhotoUrls:
          pickupIntake.proofPhotoUrls.length > 0 ?
            pickupIntake.proofPhotoUrls
          : undefined,
        barcodeValue:
          pickupIntake.barcodeValue.trim() === "" ?
            undefined
          : pickupIntake.barcodeValue.trim(),
        conditionNotes:
          pickupIntake.conditionNotes.trim() === "" ?
            undefined
          : pickupIntake.conditionNotes.trim(),
      });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        resetForm();
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }, [orderItemId, pickupIntake, resetForm, router, storePickupAtLocal]);

  const submit =
    deliveryTab === "tracking" ? submitTracking : submitStorePickup;

  const showAttrs =
    (sizeLabel?.trim().length ?? 0) > 0 || (colorLabel?.trim().length ?? 0) > 0;

  const tabClass = (selected: boolean) =>
    cn(
      "-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors sm:text-sm",
      selected ?
        "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger
        type="button"
        disabled={refundable <= 0}
        className={cn(buttonVariants({ variant: "default", size: "sm" }))}
      >
        Review and approve
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm company purchase</DialogTitle>
          <DialogDescription>
            Record that Amani Cart2Barrel purchased this item. Choose shipment tracking or store
            pickup with warehouse intake.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {batchLabel ?
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/35 bg-primary/10 px-3 py-2">
              <p className="text-xs font-medium text-foreground">
                Batch bundle ·{" "}
                <span className="font-mono text-[13px]">{batchLabel}</span>
              </p>
              {batchSessionId ?
                <DashboardCheckoutChargesPreviewDialog
                  scope="batch"
                  orderId={orderId}
                  batchSessionId={batchSessionId}
                  triggerLabel="Batch charges"
                />
              : null}
            </div>
          : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/40 px-3 py-2">
              <p className="text-xs font-medium text-foreground">
                Single product checkout charges
              </p>
              <DashboardCheckoutChargesPreviewDialog
                scope="line"
                orderId={orderId}
                orderItemId={orderItemId}
                triggerLabel="Line charges"
              />
            </div>
          )}

          <dl className="grid gap-3 rounded-lg border border-border bg-secondary p-3">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">Product</dt>
              <dd className="font-medium leading-snug text-foreground">{productName}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">Retailer</dt>
              <dd className="text-foreground">{retailerLabel}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">Link</dt>
              <dd>
                <a
                  href={productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={productUrl}
                  className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  Product URL
                </a>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">Quantity</dt>
              <dd className="tabular-nums text-foreground">{quantity}</dd>
            </div>
            {sizeLabel?.trim() ?
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium text-muted-foreground">Size</dt>
                <dd className="text-foreground">{sizeLabel.trim()}</dd>
              </div>
            : null}
            {colorLabel?.trim() ?
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium text-muted-foreground">Color</dt>
                <dd className="text-foreground">{colorLabel.trim()}</dd>
              </div>
            : null}
            {!showAttrs ?
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium text-muted-foreground">Variant</dt>
                <dd className="text-foreground">Single</dd>
              </div>
            : null}
            {!batchSessionId && quotedMerchandiseCostCents != null ?
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium text-muted-foreground">
                  Quoted merchandise cost (staff estimate)
                </dt>
                <dd className="tabular-nums font-medium text-foreground">
                  {formatUsd(quotedMerchandiseCostCents)}
                </dd>
              </div>
            : null}
            <div className="flex flex-col gap-0.5 border-t border-border pt-3">
              <dt className="text-xs font-medium text-muted-foreground">Checkout line total</dt>
              <dd className="text-base font-semibold tabular-nums text-foreground">
                {formatUsd(linePriceCents)}
              </dd>
              {refundedCents > 0 ?
                <p className="text-xs text-muted-foreground">
                  Refunded {formatUsd(refundedCents)} · Net {formatUsd(refundable)}
                </p>
              : null}
            </div>
          </dl>

          {batchShare ?
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Batch summary (this product)
              </p>
              <CartLinePriceBreakdown rows={batchLineShareSummaryRows(batchShare)} />
            </div>
          : !batchSessionId && quote ?
            <div>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Charge breakdown
              </p>
              <CartLinePriceBreakdown rows={singleQuoteSummaryRows(quote)} />
            </div>
          : null}

          <AdminMerchandiseReconciliationPanel
            orderItemId={orderItemId}
            productName={productName}
            checkoutMerchandiseCents={checkoutMerchandiseCents}
            checkoutShippingCents={checkoutShippingCents}
            checkoutTaxCents={checkoutTaxCents}
            checkoutServiceCents={checkoutServiceCents}
            customerCheckoutTotalCents={linePriceCents}
            linePriceCents={linePriceCents}
            refundedCents={refundedCents}
            quantity={quantity}
            products={[
              {
                productName,
                productNumber: orderItemId,
                quantity,
                sizeLabel,
                colorLabel,
              },
            ]}
            dialogOpen={open}
            onAllowsPurchaseChange={setReconciliationAllowsPurchase}
          />

          <AdminRetailerReceiptImagesField
            orderItemId={orderItemId}
            initialUrls={initialReceiptImageUrls}
            disabled={refundable <= 0 || pending}
            dialogOpen={open}
          />

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
                <div className="space-y-2">
                  <Label htmlFor={`purchase-tracking-${orderItemId}`}>
                    Tracking URL (optional)
                  </Label>
                  <Input
                    id={`purchase-tracking-${orderItemId}`}
                    type="url"
                    inputMode="url"
                    placeholder="https:// …"
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    disabled={pending}
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Paste the tracking link from UPS / FedEx / USPS / retailer order status.
                  </p>
                </div>

                <fieldset className="space-y-2 rounded-lg border border-border/80 bg-muted p-3">
                  <legend className="px-1 text-xs font-medium text-foreground">
                    Retailer shipment tracking (optional)
                  </legend>
                  <p className="pb-1 text-[11px] text-muted-foreground">
                    Carrier or retailer name and tracking number together.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor={`purchase-retailer-carrier-${orderItemId}`}>
                      Tracking company
                    </Label>
                    <Input
                      id={`purchase-retailer-carrier-${orderItemId}`}
                      type="text"
                      placeholder="UPS, USPS, Retailer pickup, …"
                      value={retailerTrackingCompany}
                      onChange={(e) => setRetailerTrackingCompany(e.target.value)}
                      disabled={pending}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`purchase-retailer-tracking-${orderItemId}`}>
                      Tracking number
                    </Label>
                    <Input
                      id={`purchase-retailer-tracking-${orderItemId}`}
                      type="text"
                      inputMode="text"
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
                  <Label htmlFor={`purchase-pickup-at-${orderItemId}`}>
                    Pickup date &amp; time
                  </Label>
                  <Input
                    id={`purchase-pickup-at-${orderItemId}`}
                    type="datetime-local"
                    value={storePickupAtLocal}
                    onChange={(e) => setStorePickupAtLocal(e.target.value)}
                    disabled={pending}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    When staff collected this item from the retailer.
                  </p>
                </div>

                <fieldset className="space-y-3 rounded-lg border border-border/80 bg-muted p-3">
                  <legend className="px-1 text-xs font-medium text-foreground">
                    Received delivery intake
                  </legend>
                  <p className="text-[11px] text-muted-foreground">
                    Good condition moves this line to{" "}
                    <span className="font-medium text-foreground">
                      In Barrel: awaiting shipping: (Pickup)
                    </span>{" "}
                    on Packages and Product to barrel. Problem conditions stay on purchase
                    orders for follow-up.
                  </p>
                  <WarehouseReceiptIntakeFields
                    idPrefix={orderItemId}
                    orderedQty={quantity}
                    draft={pickupIntake}
                    disabled={pending}
                    lineLabel={productName}
                    onChange={(patch) =>
                      setPickupIntake((prev) => ({ ...prev, ...patch }))
                    }
                  />
                </fieldset>
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
            disabled={
              pending || refundable <= 0 || !reconciliationAllowsPurchase
            }
            onClick={submit}
          >
            {pending ? "Saving…" : "Approve purchase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
