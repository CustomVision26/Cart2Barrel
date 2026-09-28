"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { fulfillOutboundShippingRefundsForBarrelAction } from "@/actions/admin-outbound-shipping-refund";
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
import type { BarrelOutboundShippingChargeView } from "@/lib/barrel-outbound-shipping-charge";
import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS,
  outboundShippingRefundPath,
  paidOutboundCharges,
} from "@/lib/barrel-outbound-shipping-charge";

const BRAND_NAME = "Amani Cart2Barrel";

export function AdminOutboundShippingRefundLineButton({
  barrelId,
  charges,
}: {
  barrelId: string;
  charges: BarrelOutboundShippingChargeView[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const paid = paidOutboundCharges(charges);
  const refundable = paid.filter((charge) => {
    if (charge.refundRequest?.status === "completed") return false;
    return outboundShippingRefundPath(charge) != null;
  });
  const completed = paid.filter(
    (charge) => charge.refundRequest?.status === "completed",
  );

  if (paid.length === 0) return null;
  if (refundable.length === 0 && completed.length === 0) return null;

  if (refundable.length === 0) {
    return (
      <span className="text-[11px] font-medium text-muted-foreground">
        Refunded
      </span>
    );
  }

  const amani = refundable.filter(
    (charge) => outboundShippingRefundPath(charge) === "amani",
  );
  const company = refundable.filter(
    (charge) => outboundShippingRefundPath(charge) === "company_contact",
  );
  const amaniTotal = amani.reduce((sum, charge) => sum + charge.totalCents, 0);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 shrink-0 px-2 text-xs"
        onClick={() => setOpen(true)}
      >
        Refund line
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Refund outbound charges</DialogTitle>
            <DialogDescription>
              Process the refund line for this customer container.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {refundable.map((charge) => {
              const path = outboundShippingRefundPath(charge);
              return (
                <li
                  key={charge.chargeId}
                  className="flex items-start justify-between gap-3 rounded-md border border-border/70 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[charge.chargeKind]}
                      {charge.partnerName?.trim()
                        ? ` · ${charge.partnerName.trim()}`
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {path === "amani"
                        ? `${BRAND_NAME} Stripe refund`
                        : "Customer contacts the company; we also reach out"}
                      {charge.refundRequest?.status === "pending"
                        ? " · requested"
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-foreground">
                    {formatUsd(charge.totalCents)}
                  </span>
                </li>
              );
            })}
          </ul>
          {amani.length > 0 ?
            <p className="text-xs leading-relaxed text-muted-foreground">
              {BRAND_NAME} will refund {formatUsd(amaniTotal)} to the original
              Stripe payment for freight
              {amani.length > 1 ? " and charges billed with freight" : ""}.
            </p>
          : null}
          {company.length > 0 ?
            <p className="text-xs leading-relaxed text-muted-foreground">
              Broker and courier Zelle or Cash App payments stay with those
              companies. Mark this line to record that {BRAND_NAME} is
              encouraging them to refund the customer.
            </p>
          : null}
          <DialogFooter>
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
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const res = await fulfillOutboundShippingRefundsForBarrelAction({
                    barrelId,
                  });
                  if (!res.ok) {
                    toast.error(res.message);
                    return;
                  }
                  toast.success(res.message);
                  setOpen(false);
                  router.refresh();
                });
              }}
            >
              {pending ? "Processing…" : "Process refund line"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
