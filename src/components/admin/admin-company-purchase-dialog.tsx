"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { confirmCompanyPurchaseAction } from "@/actions/admin-confirm-company-purchase";
import { AdminRetailerReceiptImagesField } from "@/components/admin/admin-retailer-receipt-images-field";
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
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

export type AdminCompanyPurchaseDialogProps = {
  orderItemId: string;
  productName: string;
  retailerLabel: string;
  quantity: number;
  sizeLabel: string | null;
  colorLabel: string | null;
  quotedMerchandiseCostCents: number | null;
  linePriceCents: number;
  refundedCents: number;
  batchLabel: string | null;
};

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
    quantity,
    sizeLabel,
    colorLabel,
    quotedMerchandiseCostCents,
    linePriceCents,
    refundedCents,
    batchLabel,
    initialReceiptImageUrls,
  } = props;

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState("");
  const [retailerTrackingCompany, setRetailerTrackingCompany] = useState("");
  const [retailerTrackingNumber, setRetailerTrackingNumber] = useState("");
  const [pending, startTransition] = useTransition();

  const refundable = Math.max(0, linePriceCents - refundedCents);

  const submit = useCallback(() => {
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
        orderItemId,
        trackingUrl: trackingUrl.trim() === "" ? undefined : trackingUrl.trim(),
        retailerTrackingCompany:
          companyTrim === "" ? undefined : companyTrim,
        retailerTrackingNumber: numberTrim === "" ? undefined : numberTrim,
      });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        setTrackingUrl("");
        setRetailerTrackingCompany("");
        setRetailerTrackingNumber("");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }, [
    orderItemId,
    retailerTrackingCompany,
    retailerTrackingNumber,
    router,
    trackingUrl,
  ]);

  const showAttrs =
    (sizeLabel?.trim().length ?? 0) > 0 || (colorLabel?.trim().length ?? 0) > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setTrackingUrl("");
          setRetailerTrackingCompany("");
          setRetailerTrackingNumber("");
        }
      }}
    >
      <DialogTrigger
        type="button"
        disabled={refundable <= 0}
        className={cn(buttonVariants({ variant: "default", size: "sm" }))}
      >
        Review and approve
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,560px)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm company purchase</DialogTitle>
          <DialogDescription>
            Record that Cart2Barrel purchased this item from the retailer. Optional: tracking link
            and/or retailer tracking details (carrier name + number together).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {batchLabel ?
            <p className="rounded-md border border-primary/35 bg-primary/10 px-3 py-2 text-xs font-medium text-foreground">
              Batch bundle ·{" "}
              <span className="font-mono text-[13px]">{batchLabel}</span>
            </p>
          : null}

          <dl className="grid gap-3 rounded-lg border border-border bg-muted/15 p-3">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">Product</dt>
              <dd className="font-medium leading-snug text-foreground">{productName}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">Retailer</dt>
              <dd className="text-foreground">{retailerLabel}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">Quantity</dt>
              <dd className="tabular-nums text-foreground">{quantity}</dd>
            </div>
            {showAttrs ?
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium text-muted-foreground">Variant</dt>
                <dd className="text-foreground">
                  {[sizeLabel?.trim(), colorLabel?.trim()].filter(Boolean).join(" · ") ||
                    "—"}
                </dd>
              </div>
            : null}
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">
                Quoted merchandise cost (staff estimate)
              </dt>
              <dd className="tabular-nums font-medium text-foreground">
                {quotedMerchandiseCostCents != null ?
                  formatUsd(quotedMerchandiseCostCents)
                : "—"}
              </dd>
            </div>
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

          <AdminRetailerReceiptImagesField
            orderItemId={orderItemId}
            initialUrls={initialReceiptImageUrls}
            disabled={refundable <= 0 || pending}
            dialogOpen={open}
          />

          <div className="space-y-4">
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
                Paste the tracking link from UPS / FedEx / USPS / retailer order status — whatever
                your team uses for proof of outbound shipment from the retailer.
              </p>
            </div>

            <fieldset className="space-y-2 rounded-lg border border-border/80 bg-muted/10 p-3">
              <legend className="px-1 text-xs font-medium text-foreground">
                Retailer shipment tracking (optional)
              </legend>
              <p className="pb-1 text-[11px] text-muted-foreground">
                Carrier or retailer name and tracking number together. If you enter a number only,
                add the company name as well — and vice versa.
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
          <Button type="button" disabled={pending || refundable <= 0} onClick={submit}>
            {pending ? "Saving…" : "Approve purchase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
