"use client";

import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { BarrelContentsPreviewDialog } from "@/components/shipping/barrel-contents-preview-dialog";
import {
  OverseasVendorPreferenceSummary,
  ThirdPartyVendorsSection,
} from "@/components/shipping/third-party-vendors-section";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/admin-markup";
import { unpaidPublishedChargesForIntake } from "@/lib/barrel-outbound-shipping-charge";
import {
  containerFullnessLabel,
  type BarrelShippingIntakeSubmittedRow,
} from "@/lib/barrel-shipping-intake";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";
import { cn } from "@/lib/utils";

type BarrelOutboundShippingChargeCardProps = {
  row: BarrelShippingIntakeSubmittedRow;
  destinationCountry?: string | null;
};

export function BarrelOutboundShippingChargeCard({
  row,
  destinationCountry,
}: BarrelOutboundShippingChargeCardProps) {
  const unpaid = unpaidPublishedChargesForIntake(row.outboundCharges, row);
  if (unpaid.length === 0) return null;
  const inCart = unpaid.some((c) => c.inCart);
  const total = unpaid.reduce((s, c) => s + c.totalCents, 0);

  return (
    <Card
      className={cn(
        "overflow-hidden bg-card shadow-sm",
        inCart ? "border-primary/40 ring-1 ring-primary/30" : "border-border/80",
      )}
    >
      <CardContent className="space-y-3 p-3">
        <article className="flex items-start gap-3">
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
            <p className="text-xs text-muted-foreground">
              {row.alias} · {containerOfferingKindLabel(row.kind)} ·{" "}
              {containerFullnessLabel(row)}
            </p>
            <p className="text-xs font-medium tabular-nums text-muted-foreground">
              Total due {formatUsd(total)}
            </p>
          </div>
          <BarrelContentsPreviewDialog
            barrelId={row.barrelId}
            containerLabel={row.containerName}
            containerAlias={row.alias}
            items={row.contents}
          />
        </article>
        <ThirdPartyVendorsSection
          charges={row.outboundCharges}
          intake={row}
          overseasSummary={
            <OverseasVendorPreferenceSummary
              row={row}
              destinationCountry={destinationCountry}
            />
          }
        />
      </CardContent>
    </Card>
  );
}
