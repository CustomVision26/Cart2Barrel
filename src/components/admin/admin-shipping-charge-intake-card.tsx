"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { AdminOutboundChargeKindTabs } from "@/components/admin/admin-outbound-charge-kind-tabs";
import { AdminOutboundOffPlatformPaymentReview } from "@/components/admin/admin-outbound-off-platform-payment-review";
import { OutboundChargePaymentStatus } from "@/components/shipping/outbound-charge-payment-status";
import { AdminOutboundShippingRefundLineButton } from "@/components/admin/admin-outbound-shipping-refund-line-button";
import { AdminShipmentCustomsPanel } from "@/components/admin/admin-shipment-customs-panel";
import { AdminUpdatedByCell } from "@/components/admin/admin-staff-record-label";
import type { AdminStaffProfilesByClerkUserId } from "@/lib/admin-staff-profiles";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  AdminBarrelOutboundShippingChargeRow,
  BarrelOutboundShippingChargeView,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS,
  chargesPendingOffPlatformReview,
  isOffPlatformPaymentPendingReview,
  paidOutboundCharges,
} from "@/lib/barrel-outbound-shipping-charge";
import { formatUsd } from "@/lib/admin-markup";
import { containerFullnessLabel } from "@/lib/barrel-shipping-intake";
import { BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS } from "@/lib/barrel-shipment-tracking";

type AdminShippingChargeIntakeCardProps = {
  row: AdminBarrelOutboundShippingChargeRow;
  /** When false, form is visible but publish is disabled (preview or still packing). */
  publishEnabled?: boolean;
  lockMessage?: string;
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
};

function chargeChipTone(charge: BarrelOutboundShippingChargeView): string {
  if (charge.paidAt) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  }
  if (isOffPlatformPaymentPendingReview(charge)) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200";
  }
  return "border-border/70 bg-muted/60 text-foreground";
}

function chargeChipValue(charge: BarrelOutboundShippingChargeView): string {
  if (charge.paidAt) return "Paid";
  if (isOffPlatformPaymentPendingReview(charge)) {
    return `${formatUsd(charge.totalCents)} submitted`;
  }
  return formatUsd(charge.totalCents);
}

export function AdminShippingChargeIntakeCard({
  row,
  publishEnabled = true,
  lockMessage,
  staffProfilesByClerkUserId = {},
}: AdminShippingChargeIntakeCardProps) {
  const pendingReviewCharges = chargesPendingOffPlatformReview(row.charges);
  const pendingReviewCount = pendingReviewCharges.length;
  const paidCharges = paidOutboundCharges(row.charges);
  const billableCharges = row.charges.filter((c) => c.totalCents > 0);
  const allPaid =
    billableCharges.length > 0 && billableCharges.every((c) => Boolean(c.paidAt));
  const [expanded, setExpanded] = useState(
    pendingReviewCount > 0 || paidCharges.length > 0,
  );
  const [customsOpen, setCustomsOpen] = useState(
    paidCharges.length > 0 && pendingReviewCount === 0,
  );
  const trackingLabel = row.shipmentTracking
    ? BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS[row.shipmentTracking.trackingStage]
    : null;

  const statusDetail =
    !row.readyForShipping ?
      containerFullnessLabel(row)
    : row.intakeId.startsWith("awaiting-") ?
      "Awaiting customer confirmation"
    : `Confirmed ${new Date(row.submittedAt).toLocaleDateString(undefined, {
        dateStyle: "medium",
      })}`;

  const headline =
    pendingReviewCount > 0
      ? "Payment receipt awaiting verification"
      : allPaid
        ? "All outbound charges paid"
        : paidCharges.length > 0
          ? trackingLabel
          : null;

  return (
    <Card className="overflow-hidden border-border/80 bg-card shadow-sm">
      <CardContent className="p-4">
        <article>
          <div className="flex gap-3">
            <ProductRequestThumbnail
              variant="list"
              imageUrl={row.containerImageUrl}
              productLabel={row.containerName}
              className="self-start rounded-md ring-1 ring-border/40"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex items-center gap-2">
                    <h3
                      className="min-w-0 truncate text-sm font-semibold leading-snug text-foreground"
                      title={row.containerName}
                    >
                      {row.containerName}
                    </h3>
                    {row.alias ?
                      <p
                        className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums tracking-tight text-foreground"
                        title={`Container ${row.alias}`}
                      >
                        {row.alias}
                      </p>
                    : null}
                  </div>
                  {headline ?
                    <p
                      className={cn(
                        "mt-1 text-xs leading-snug",
                        pendingReviewCount > 0
                          ? "font-medium text-amber-800 dark:text-amber-300"
                          : allPaid
                            ? "font-medium text-emerald-700 dark:text-emerald-400"
                            : "text-muted-foreground",
                      )}
                    >
                      {headline}
                    </p>
                  : (
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">
                      {statusDetail}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  <OutboundChargePaymentStatus
                    charges={row.charges}
                    audience="admin"
                    customerName={row.customerName}
                    customerEmail={row.customerEmail}
                  />
                  <AdminOutboundShippingRefundLineButton
                    barrelId={row.barrelId}
                    charges={row.charges}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 gap-1 px-2 text-xs"
                    aria-expanded={expanded}
                    onClick={() =>
                      setExpanded((value) => {
                        const next = !value;
                        if (!next) setCustomsOpen(false);
                        return next;
                      })
                    }
                  >
                    {expanded ? "Hide" : "Manage"}
                    <ChevronDownIcon
                      className={cn(
                        "size-3.5 transition-transform",
                        expanded && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </Button>
                </div>
              </div>

              {billableCharges.length > 0 ?
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {billableCharges.map((charge) => (
                    <li
                      key={charge.chargeId}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] leading-none",
                        chargeChipTone(charge),
                      )}
                    >
                      <span className="font-medium">
                        {BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[charge.chargeKind]}
                      </span>
                      <span className="tabular-nums opacity-90">
                        {chargeChipValue(charge)}
                      </span>
                    </li>
                  ))}
                </ul>
              : null}

              {trackingLabel && headline !== trackingLabel ?
                <p className="mt-2 text-xs leading-snug text-muted-foreground">
                  {trackingLabel}
                </p>
              : null}
              <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
                Updated by{" "}
                <AdminUpdatedByCell
                  clerkUserId={row.updatedByClerkUserId}
                  profilesByClerkUserId={staffProfilesByClerkUserId}
                  primaryClassName="inline text-[10px] font-medium"
                  secondaryClassName="inline text-[9px] text-muted-foreground"
                />
              </p>
            </div>
          </div>
        </article>

        {expanded ?
          <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
            {pendingReviewCharges.map((charge) => (
              <AdminOutboundOffPlatformPaymentReview
                key={charge.chargeId}
                charge={charge}
                customerName={row.customerName}
                customerEmail={row.customerEmail}
              />
            ))}
            {paidCharges.length > 0 ?
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={customsOpen ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setCustomsOpen((open) => !open)}
                >
                  {customsOpen ? "Close" : "Customs clearance"}
                </Button>
              </div>
            : null}

            {customsOpen ?
              <AdminShipmentCustomsPanel
                row={row}
                onClose={() => setCustomsOpen(false)}
              />
            : (
              <AdminOutboundChargeKindTabs
                row={row}
                publishEnabled={publishEnabled}
                lockMessage={lockMessage}
              />
            )}
          </div>
        : null}
      </CardContent>
    </Card>
  );
}
