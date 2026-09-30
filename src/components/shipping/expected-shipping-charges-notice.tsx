"use client";

import type { ReactNode } from "react";

import { BarrelPublishedOutboundCharges } from "@/components/shipping/barrel-published-outbound-charges";
import { CustomsClearancePolicyLink } from "@/components/shipping/customs-clearance-policy-link";
import { OutboundShippingAddedChargesPanel } from "@/components/shipping/outbound-shipping-added-charges-panel";
import { UnpaidContainerLinkPanel } from "@/components/shipping/unpaid-container-link-panel";
import { CollapsibleFieldSection } from "@/components/ui/collapsible-field-section";
import { applyOutboundChargeBundleForCustomer } from "@/lib/barrel-outbound-shipping-charge";
import type {
  AdminRateLinkableContainer,
  BarrelOutboundShippingChargeView,
} from "@/lib/barrel-outbound-shipping-charge";
import { EXPECTED_OUTBOUND_SHIPPING_CHARGE_ITEMS } from "@/lib/outbound-shipping-expected-charges";

type ExpectedShippingChargesNoticeProps = {
  destinationCountry?: string | null;
  className?: string;
  /** When false, the section starts collapsed. Defaults to open for new containers. */
  defaultOpen?: boolean;
  /** Replaces the static customs bullet (customer clearance + courier choice). */
  customsContent?: ReactNode;
  /** Published freight / broker / courier charges for this container. */
  charges?: BarrelOutboundShippingChargeView[];
  sourceBarrelId?: string;
  unpaidContainers?: AdminRateLinkableContainer[];
  preferPayHostBarrelIds?: readonly string[];
  /** Locks unpaid-container linking (for example while a receipt awaits verification). */
  linkDisabled?: boolean;
};

export function ExpectedShippingChargesNotice({
  destinationCountry,
  className,
  defaultOpen = true,
  customsContent,
  charges,
  sourceBarrelId,
  unpaidContainers = [],
  preferPayHostBarrelIds,
  linkDisabled = false,
}: ExpectedShippingChargesNoticeProps) {
  const freightItem = EXPECTED_OUTBOUND_SHIPPING_CHARGE_ITEMS.find(
    (item) => item.id === "freight",
  );
  const customsItem = EXPECTED_OUTBOUND_SHIPPING_CHARGE_ITEMS.find(
    (item) => item.id === "customs",
  );
  const visibleCharges = applyOutboundChargeBundleForCustomer(charges ?? []);
  const freightCharges = visibleCharges.filter(
    (charge) => charge.chargeKind === "freight",
  );
  const unpaidFreightName = freightCharges[0]?.partnerName?.trim() ?? "";
  const freightLinkedIds = (freightCharges[0]?.linkedContainers ?? []).map(
    (item) => item.barrelId,
  );
  const showSummary = charges != null;

  return (
    <CollapsibleFieldSection
      title="Outbound shipping charges"
      description="Freight, customs clearance, and local transportation due before container release"
      defaultOpen={defaultOpen}
      className={
        className ??
        "border-amber-500/25 bg-amber-500/10 shadow-none hover:bg-amber-500/15"
      }
    >
      <div
        className={
          showSummary
            ? "grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.85fr)]"
            : undefined
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Freight, customs clearance, and related fees are due before we
            release this container. Typical charges include:
          </p>
          {freightCharges.length > 0 ?
            <>
              <BarrelPublishedOutboundCharges
                charges={freightCharges}
                kinds={["freight"]}
                showHeading={false}
                includePaid
                preferPayHostBarrelIds={preferPayHostBarrelIds}
              />
              {sourceBarrelId &&
              unpaidFreightName &&
              !freightCharges[0]?.paidAt ?
                <UnpaidContainerLinkPanel
                  sourceBarrelId={sourceBarrelId}
                  companyName={unpaidFreightName}
                  kind="freight"
                  containers={unpaidContainers}
                  linkedBarrelIds={freightLinkedIds}
                  disabled={linkDisabled || Boolean(freightCharges[0]?.inCart)}
                  lockMessage={
                    linkDisabled
                      ? "Linked containers are locked while a payment is awaiting verification. Use Cancel confirmation to change them on this card."
                      : undefined
                  }
                />
              : null}
            </>
          : freightItem ?
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">
                  {freightItem.label}
                </span>
                {" — "}
                {freightItem.description}
              </li>
            </ul>
          : null}
          {customsItem && !customsContent ?
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">
                  {customsItem.label}
                </span>
                {" — "}
                {customsItem.description}{" "}
                <CustomsClearancePolicyLink country={destinationCountry} />
              </li>
            </ul>
          : null}
          {customsItem && customsContent ?
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {customsItem.label}
                </span>
                {" — "}
                {customsItem.description}
              </p>
              {customsContent}
            </div>
          : null}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Continue to pricing for itemized amounts. Add freight to your cart.
            Pay broker and local courier charges with Zelle, Cash App, or at the
            local office.
          </p>
        </div>
        {showSummary ?
          <OutboundShippingAddedChargesPanel charges={visibleCharges} />
        : null}
      </div>
    </CollapsibleFieldSection>
  );
}
