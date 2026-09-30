"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { cancelBarrelShippingIntakeAction } from "@/actions/barrel-shipping-intake";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { BarrelContentsPreviewDialog } from "@/components/shipping/barrel-contents-preview-dialog";
import {
  OverseasVendorPreferenceSummary,
  ThirdPartyVendorsSection,
} from "@/components/shipping/third-party-vendors-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { formatUsd } from "@/lib/admin-markup";
import { unpaidPublishedChargesForIntake } from "@/lib/barrel-outbound-shipping-charge";
import { DASHBOARD_SHIPPING_ROUTES } from "@/lib/dashboard-shipping-routes";
import {
  containerFullnessLabel,
  type BarrelShippingIntakeSubmittedRow,
} from "@/lib/barrel-shipping-intake";
import { linkedShippingGroupLabel } from "@/lib/shipping-container-groups";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";
import { cn } from "@/lib/utils";

type ChargeCardMember = {
  alias: string;
  intakeId?: string;
};

type BarrelOutboundShippingChargeCardProps = {
  row: BarrelShippingIntakeSubmittedRow;
  members?: ChargeCardMember[];
  destinationCountry?: string | null;
};

export function BarrelOutboundShippingChargeCard({
  row,
  members,
  destinationCountry,
}: BarrelOutboundShippingChargeCardProps) {
  const group = members && members.length > 0 ? members : [row];
  const groupLabel = linkedShippingGroupLabel(group);
  const unpaid = unpaidPublishedChargesForIntake(row.outboundCharges, row);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (unpaid.length === 0) return null;
  const inCart = unpaid.some((c) => c.inCart);
  const total = unpaid.reduce((s, c) => s + c.totalCents, 0);
  const cancelIds = [
    ...new Set(
      [row.intakeId, ...group.map((item) => item.intakeId)].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ];

  function cancelSubmit() {
    const [intakeId, ...alsoIntakeIds] = cancelIds;
    if (!intakeId) {
      toast.error("No confirmation to cancel.");
      return;
    }
    startTransition(async () => {
      const res = await cancelBarrelShippingIntakeAction({
        intakeId,
        alsoIntakeIds,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.push(DASHBOARD_SHIPPING_ROUTES.tracking);
      router.refresh();
    });
  }

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
              {groupLabel} · {containerOfferingKindLabel(row.kind)} ·{" "}
              {containerFullnessLabel(row)}
            </p>
            <p className="text-xs font-medium tabular-nums text-muted-foreground">
              Total due {formatUsd(total)}
              {group.length > 1 ? " · one payment covers all linked containers" : ""}
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
      {cancelIds.length > 0 ?
        <CardFooter className="border-t border-border/60 px-3 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={cancelSubmit}
          >
            {pending ? "Cancelling…" : "Cancel confirmation"}
          </Button>
        </CardFooter>
      : null}
    </Card>
  );
}
