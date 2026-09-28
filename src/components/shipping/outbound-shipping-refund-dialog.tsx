"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { requestOutboundShippingRefundAction } from "@/actions/request-outbound-shipping-refund";
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
  outboundPartnerContactLines,
  outboundShippingRefundPath,
} from "@/lib/barrel-outbound-shipping-charge";

function companyRoleLabel(kind: BarrelOutboundShippingChargeView["chargeKind"]): string {
  if (kind === "broker") return "customs broker";
  if (kind === "courier") return "local courier";
  return "freight company";
}

const BRAND_NAME = "Amani Cart2Barrel";

export function OutboundShippingRefundButton({
  charge,
  relatedCharges = [],
}: {
  charge: BarrelOutboundShippingChargeView;
  relatedCharges?: BarrelOutboundShippingChargeView[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const path = outboundShippingRefundPath(charge);
  if (!path) return null;

  const targets = [charge, ...relatedCharges.filter((item) => item.chargeId !== charge.chargeId)];
  const completed = targets.every((item) => item.refundRequest?.status === "completed");
  const requested = targets.some((item) => item.refundRequest) && !completed;
  const total = targets.reduce((sum, item) => sum + item.totalCents, 0);
  const company = charge.partnerName?.trim() || "the company";
  const contactLines = outboundPartnerContactLines(charge);

  if (completed) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border border-border/70 bg-muted/50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Refunded
      </span>
    );
  }

  if (requested) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
        Refund requested
      </span>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={() => setOpen(true)}
      >
        Refund
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {path === "amani" ? "Request a freight refund" : "Request a refund"}
            </DialogTitle>
            <DialogDescription>
              {path === "amani"
                ? `${BRAND_NAME} will refund ${formatUsd(total)} to the original payment method.`
                : `This ${companyRoleLabel(charge.chargeKind)} payment of ${formatUsd(charge.totalCents)} was made by Zelle or Cash App.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {path === "company_contact" ?
              <>
                <p>
                  Thank you for writing to {BRAND_NAME}. We have prepared this
                  refund request for the{" "}
                  {BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[
                    charge.chargeKind
                  ].toLowerCase()}{" "}
                  of {formatUsd(charge.totalCents)}.
                </p>
                <p>
                  This payment was made directly to the{" "}
                  {companyRoleLabel(charge.chargeKind)}. It was not processed
                  through {BRAND_NAME}. Please contact the company to request a
                  refund:
                </p>
                {contactLines.length > 0 ?
                  <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-foreground">
                    {contactLines.map((line) => (
                      <p key={line} className="text-sm leading-snug">
                        {line}
                      </p>
                    ))}
                  </div>
                : (
                  <p className="font-medium text-foreground">{company}</p>
                )}
                <p>
                  {BRAND_NAME} will also reach out to {company} to encourage a
                  refund on your behalf.
                </p>
              </>
            : (
              <>
                <p>
                  {BRAND_NAME} will process a refund of {formatUsd(total)} for
                  freight
                  {targets.length > 1
                    ? " and any company billed together with freight"
                    : ""}{" "}
                  on this container.
                </p>
                <p>
                  The refund will return to the original payment method used at
                  checkout. Our team has been notified and will complete this
                  refund. You do not need to contact the freight company
                  separately.
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Close
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const res = await requestOutboundShippingRefundAction({
                    chargeId: charge.chargeId,
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
              {pending ? "Sending…" : "Send refund request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
