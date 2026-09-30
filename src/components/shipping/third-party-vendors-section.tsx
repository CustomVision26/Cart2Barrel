"use client";

import type { ReactNode } from "react";
import { CheckCircle2Icon } from "lucide-react";

import { DeclineBrokerButton } from "@/components/shipping/decline-broker-button";
import { DeclineCourierButton } from "@/components/shipping/decline-courier-button";
import { BarrelPublishedOutboundCharges } from "@/components/shipping/barrel-published-outbound-charges";
import { OutboundChargePaymentStatus } from "@/components/shipping/outbound-charge-payment-status";
import type { BarrelOutboundShippingChargeView } from "@/lib/barrel-outbound-shipping-charge";
import {
  applyOutboundChargeBundleForCustomer,
  canDeclineBrokerForIntake,
  canDeclineCourierForIntake,
  vendorChargesForIntake,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  barrelShippingDeliveryMethodLabel,
  type BarrelShippingIntakeSubmittedRow,
} from "@/lib/barrel-shipping-intake";
import {
  findDestinationBroker,
  findDestinationCourier,
  PUBLISHED_BROKER_KEY,
  PUBLISHED_COURIER_KEY,
} from "@/lib/destination-clearance-partners";
import { partitionThirdPartyVendorCharges } from "@/lib/third-party-vendors";
import { cn } from "@/lib/utils";

export function ThirdPartyVendorsDivider({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)} role="separator">
      <span className="h-px min-w-4 flex-1 bg-border" />
      <p className="shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Third-party vendors
      </p>
      <span className="h-px min-w-4 flex-1 bg-border" />
    </div>
  );
}

function VendorGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/40 px-3 py-2.5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function OverseasVendorPreferenceSummary({
  row,
  destinationCountry,
}: {
  row: Pick<
    BarrelShippingIntakeSubmittedRow,
    | "intakeId"
    | "deliveryMethod"
    | "selectedBrokerKey"
    | "selectedCourierKey"
    | "outboundCharges"
  >;
  destinationCountry?: string | null;
}) {
  const broker = findDestinationBroker(
    row.selectedBrokerKey,
    destinationCountry,
  );
  const courier = findDestinationCourier(
    row.selectedCourierKey,
    destinationCountry,
  );
  const brokerCharge = row.outboundCharges.find(
    (charge) => charge.chargeKind === "broker",
  );
  const courierCharge = row.outboundCharges.find(
    (charge) => charge.chargeKind === "courier",
  );
  const publishedBrokerName = brokerCharge?.partnerName?.trim();
  const publishedCourierName = courierCharge?.partnerName?.trim();
  const brokerLabel =
    row.selectedBrokerKey === PUBLISHED_BROKER_KEY
      ? publishedBrokerName || broker?.name
      : broker?.name;
  const courierLabel =
    row.selectedCourierKey === PUBLISHED_COURIER_KEY
      ? publishedCourierName || courier?.name
      : courier?.name;
  const canDeclineBroker = canDeclineBrokerForIntake(row);
  const canDeclineCourier = canDeclineCourierForIntake(row);

  return (
    <div className="space-y-1.5">
      <PreferenceCheckRow className="text-sm text-foreground">
        {barrelShippingDeliveryMethodLabel(row.deliveryMethod)}
      </PreferenceCheckRow>
      {brokerLabel ?
        <PreferenceCheckRow
          className="text-xs text-muted-foreground"
          charge={brokerCharge}
        >
          Customs broker:{" "}
          <span className="text-foreground">{brokerLabel}</span>
        </PreferenceCheckRow>
      : null}
      {canDeclineBroker && !brokerCharge ?
        <DeclineBrokerButton intakeId={row.intakeId} />
      : null}
      {courierLabel ?
        <PreferenceCheckRow
          className="text-xs text-muted-foreground"
          charge={courierCharge}
        >
          Transportation:{" "}
          <span className="text-foreground">{courierLabel}</span>
        </PreferenceCheckRow>
      : null}
      {canDeclineCourier && !courierCharge ?
        <DeclineCourierButton intakeId={row.intakeId} />
      : null}
    </div>
  );
}

function PreferenceCheckRow({
  children,
  className,
  charge,
}: {
  children: ReactNode;
  className?: string;
  charge?: BarrelOutboundShippingChargeView;
}) {
  return (
    <div className={cn("flex items-start gap-1.5", className)}>
      <CheckCircle2Icon
        className="mt-0.5 size-3.5 shrink-0 text-emerald-400"
        aria-hidden
      />
      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span>{children}</span>
        {charge ?
          <OutboundChargePaymentStatus
            charges={[charge]}
            showCustomer={false}
          />
        : null}
      </span>
    </div>
  );
}

type ThirdPartyVendorsSectionProps = {
  charges: BarrelOutboundShippingChargeView[];
  overseasSummary?: ReactNode;
  showDivider?: boolean;
  intake?: Pick<
    BarrelShippingIntakeSubmittedRow,
    "intakeId" | "deliveryMethod" | "selectedCourierKey" | "outboundCharges"
  >;
};

export function ThirdPartyVendorsSection({
  charges,
  overseasSummary,
  showDivider = true,
  intake,
}: ThirdPartyVendorsSectionProps) {
  const visible = intake
    ? vendorChargesForIntake(charges, intake)
    : applyOutboundChargeBundleForCustomer(charges);
  const { unitedStates, overseas } = partitionThirdPartyVendorCharges(visible);
  const declineBrokerIntakeId =
    intake && canDeclineBrokerForIntake(intake) ? intake.intakeId : undefined;
  const declineCourierIntakeId =
    intake && canDeclineCourierForIntake(intake) ? intake.intakeId : undefined;

  return (
    <div className="space-y-2.5">
      {showDivider ? <ThirdPartyVendorsDivider /> : null}
      <VendorGroup
        title="In-US vendor"
        description="Freight company that moves the container from the United States warehouse to the destination port."
      >
        {unitedStates.length > 0 ?
          <BarrelPublishedOutboundCharges
            charges={unitedStates}
            showHeading={false}
            includePaid
          />
        : (
          <p className="text-xs text-muted-foreground">
            No United States vendor is published for this container yet.
          </p>
        )}
      </VendorGroup>
      <VendorGroup
        title="Overseas third-party vendor"
        description="Destination-country clearance and local transportation after the container arrives."
      >
        {overseasSummary}
        {overseas.length > 0 ?
          <BarrelPublishedOutboundCharges
            charges={overseas}
            showHeading={false}
            includePaid
            declineBrokerIntakeId={declineBrokerIntakeId}
            declineCourierIntakeId={declineCourierIntakeId}
          />
        : null}
        {!overseasSummary && overseas.length === 0 ?
          <p className="text-xs text-muted-foreground">
            No overseas third-party vendor is required for this selection.
          </p>
        : null}
      </VendorGroup>
    </div>
  );
}
