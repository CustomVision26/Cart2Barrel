"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { AdminOutboundChargeKindTabs } from "@/components/admin/admin-outbound-charge-kind-tabs";
import { AdminOutboundPaymentReceiptDialog } from "@/components/admin/admin-outbound-off-platform-payment-review";
import { AdminShipmentCustomsPanel } from "@/components/admin/admin-shipment-customs-panel";
import { AdminUpdatedByCell } from "@/components/admin/admin-staff-record-label";
import type { AdminStaffProfilesByClerkUserId } from "@/lib/admin-staff-profiles";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AdminBarrelOutboundShippingChargeRow } from "@/lib/barrel-outbound-shipping-charge";
import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS,
  isOffPlatformPaymentPendingReview,
  paidOutboundCharges,
} from "@/lib/barrel-outbound-shipping-charge";
import { formatUsd } from "@/lib/admin-markup";
import { containerFullnessLabel } from "@/lib/barrel-shipping-intake";

type AdminShippingChargeIntakeCardProps = {
  row: AdminBarrelOutboundShippingChargeRow;
  /** When false, form is visible but publish is disabled (preview or still packing). */
  publishEnabled?: boolean;
  lockMessage?: string;
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
};

export function AdminShippingChargeIntakeCard({
  row,
  publishEnabled = true,
  lockMessage,
  staffProfilesByClerkUserId = {},
}: AdminShippingChargeIntakeCardProps) {
  const pendingReviewCount = row.charges.filter(
    isOffPlatformPaymentPendingReview,
  ).length;
  const [expanded, setExpanded] = useState(pendingReviewCount > 0);
  const [customsOpen, setCustomsOpen] = useState(false);
  const paidCharges = paidOutboundCharges(row.charges);
  const allPaid = paidCharges.length > 0 && paidCharges.length === row.charges.length;
  const publishedSummary = row.charges
    .filter((c) => c.totalCents > 0)
    .map(
      (c) =>
        `${BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[c.chargeKind]} ${formatUsd(c.totalCents)}`,
    )
    .join(" · ");

  const statusDetail =
    !row.readyForShipping ?
      containerFullnessLabel(row)
    : row.intakeId.startsWith("awaiting-") ?
      "Awaiting customer confirmation"
    : `Confirmed ${new Date(row.submittedAt).toLocaleDateString(undefined, {
        dateStyle: "medium",
      })}`;

  return (
    <Card className="overflow-hidden border-border/80 bg-card shadow-sm">
      <CardContent className="p-3">
        <article className="flex items-center gap-3">
          <ProductRequestThumbnail
            variant="list"
            imageUrl={row.containerImageUrl}
            productLabel={row.containerName}
            className="rounded-md ring-1 ring-border/40"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {row.containerName}
            </h3>
            {allPaid ?
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Paid outbound charges
              </p>
            : row.charges.some(isOffPlatformPaymentPendingReview) ?
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Payment receipt waiting for verification
              </p>
            : publishedSummary ?
              <p className="text-xs tabular-nums text-muted-foreground">
                {publishedSummary}
              </p>
            : (
              <p className="text-xs text-muted-foreground">{statusDetail}</p>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">
              Updated by{" "}
              <AdminUpdatedByCell
                clerkUserId={row.updatedByClerkUserId}
                profilesByClerkUserId={staffProfilesByClerkUserId}
                primaryClassName="inline text-[10px] font-medium"
                secondaryClassName="inline text-[9px] text-muted-foreground"
              />
            </p>
          </div>
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
        </article>

        {expanded ?
          <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
            {paidCharges.length > 0 ||
            row.charges.some((charge) => charge.offPlatformSubmittedAt) ?
              <div className="flex flex-wrap items-center gap-2">
                {paidCharges.length > 0 ?
                  <Button
                    type="button"
                    variant={customsOpen ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setCustomsOpen((open) => !open)}
                  >
                    {customsOpen ? "Close" : "Customs clearance"}
                  </Button>
                : null}
                <AdminOutboundPaymentReceiptDialog
                  charges={row.charges}
                  customerName={row.customerName}
                  customerEmail={row.customerEmail}
                />
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
