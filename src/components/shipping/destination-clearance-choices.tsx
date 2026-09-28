"use client";

import { BarrelPublishedOutboundCharges } from "@/components/shipping/barrel-published-outbound-charges";
import { CustomsClearancePolicyLink } from "@/components/shipping/customs-clearance-policy-link";
import { UnpaidContainerLinkPanel } from "@/components/shipping/unpaid-container-link-panel";
import type {
  AdminRateLinkableContainer,
  BarrelOutboundShippingChargeView,
} from "@/lib/barrel-outbound-shipping-charge";
import { destinationClearancePresentation } from "@/lib/barrel-outbound-shipping-charge";
import {
  destinationBrokersForCountry,
  isAllowedCustomerCourierKey,
  isOwnTransportCourierKey,
  OWN_TRANSPORT_COURIER_KEY,
  PUBLISHED_BROKER_KEY,
  PUBLISHED_COURIER_KEY,
} from "@/lib/destination-clearance-partners";
import type { BarrelShippingDeliveryMethod } from "@/lib/validations/barrel-shipping-intake";
import { cn } from "@/lib/utils";

export type DestinationClearanceChoiceValue = {
  deliveryMethod: BarrelShippingDeliveryMethod | null;
  brokerKey: string | null;
  courierKey: string | null;
};

type DestinationClearanceChoicesProps = {
  destinationCountry?: string | null;
  namePrefix: string;
  value: DestinationClearanceChoiceValue;
  onChange: (next: DestinationClearanceChoiceValue) => void;
  disabled?: boolean;
  charges?: BarrelOutboundShippingChargeView[];
  /** Intake-only: unpaid barrels the customer can attach to a standalone broker/courier. */
  sourceBarrelId?: string;
  unpaidContainers?: AdminRateLinkableContainer[];
};

function ChoiceCard({
  id,
  name,
  checked,
  disabled,
  title,
  description,
  onSelect,
}: {
  id: string;
  name: string;
  checked: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <label
      htmlFor={id}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      className={cn(
        "relative z-10 flex cursor-pointer gap-3 rounded-md border px-4 py-3.5 text-left transition-colors",
        checked
          ? "border-primary/55 bg-primary/10"
          : "border-border/80 bg-background hover:border-primary/40 hover:bg-muted/40",
        disabled && "pointer-events-none cursor-not-allowed opacity-60",
      )}
    >
      <input
        id={id}
        type="radio"
        name={name}
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
      />
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
          checked
            ? "border-primary bg-primary"
            : "border-muted-foreground/70 bg-background",
        )}
        aria-hidden
      >
        {checked ?
          <span className="size-1.5 rounded-full bg-primary-foreground" />
        : null}
      </span>
      <span className="min-w-0 space-y-1">
        <span className="block text-sm font-medium leading-snug text-foreground">
          {title}
        </span>
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

export function DestinationClearanceChoices({
  destinationCountry,
  namePrefix,
  value,
  onChange,
  disabled,
  charges = [],
  sourceBarrelId,
  unpaidContainers = [],
}: DestinationClearanceChoicesProps) {
  const country = destinationCountry?.trim() || null;
  const presentation = destinationClearancePresentation(charges, country);
  const {
    showBrokerUi,
    showSelfClearance,
    showCourierUi,
    publishedBrokers,
    publishedCouriers,
    brokerAbsorbed,
  } = presentation;
  const catalogBrokers = country ? destinationBrokersForCountry(country) : [];
  const hasBrokers = publishedBrokers.length > 0 || catalogBrokers.length > 0;
  const publishedBrokerInCart = publishedBrokers.some((charge) => charge.inCart);
  const publishedBrokerName = publishedBrokers[0]?.partnerName?.trim() || "";
  const publishedCourierName = publishedCouriers[0]?.partnerName?.trim() || "";
  const publishedBrokerLinkedIds =
    publishedBrokers[0]?.linkedContainers?.map((item) => item.barrelId) ?? [];
  const publishedCourierLinkedIds =
    publishedCouriers[0]?.linkedContainers?.map((item) => item.barrelId) ?? [];

  if (!country) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a destination shipping address to see the clearance policy, brokers,
        and local couriers for that country.
      </p>
    );
  }

  if (!showBrokerUi && !showCourierUi) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        Destination customs and local transportation for{" "}
        <span className="font-medium text-foreground">{country}</span> are
        included with freight.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {showBrokerUi ?
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Select how this container will be cleared at destination customs in{" "}
            <span className="font-medium text-foreground">{country}</span>.{" "}
            <CustomsClearancePolicyLink country={country} />
          </p>

          <fieldset className="relative z-10 space-y-2.5">
            <legend className="sr-only">Destination customs clearance</legend>
            {showSelfClearance ?
              <ChoiceCard
                id={`${namePrefix}-clear-self`}
                name={`${namePrefix}-clearance`}
                checked={value.deliveryMethod === "customs_pickup"}
                disabled={disabled}
                title="I'll clear this barrel at destination customs myself"
                description="You (or someone you appoint) will handle destination customs in person and collect the container when it is released."
                onSelect={() =>
                  onChange({
                    deliveryMethod: "customs_pickup",
                    brokerKey: null,
                    courierKey: value.courierKey,
                  })
                }
              />
            : null}
            <ChoiceCard
              id={`${namePrefix}-clear-broker`}
              name={`${namePrefix}-clearance`}
              checked={value.deliveryMethod === "broker_delivery"}
              disabled={disabled || !hasBrokers}
              title="Use a selected broker for this destination country"
              description={
                hasBrokers
                  ? `Choose one of the licensed brokers Amani selected for ${country}. The broker clears the container for you.`
                  : `No licensed brokers are listed for ${country}. Choose self-clearance or contact support.`
              }
              onSelect={() =>
                onChange({
                  deliveryMethod: "broker_delivery",
                  brokerKey:
                    publishedBrokers.length > 0 || publishedBrokerInCart
                      ? PUBLISHED_BROKER_KEY
                      : value.brokerKey,
                  courierKey: value.courierKey,
                })
              }
            />
          </fieldset>
        </>
      : brokerAbsorbed ?
        <p className="text-sm leading-relaxed text-muted-foreground">
          Destination customs clearance in{" "}
          <span className="font-medium text-foreground">{country}</span> is
          included with freight. <CustomsClearancePolicyLink country={country} />
        </p>
      : null}

      {showBrokerUi &&
      value.deliveryMethod === "broker_delivery" &&
      hasBrokers ?
        <fieldset className="relative z-10 space-y-2.5">
          <legend className="text-sm font-medium tracking-tight text-foreground">
            Customs brokers — {country}
          </legend>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Only licensed brokers for {country} are shown.
          </p>
          {publishedBrokers.length > 0 ?
            <>
              <BarrelPublishedOutboundCharges
                charges={publishedBrokers}
                kinds={["broker"]}
                showHeading={false}
                includePaid
                selection={{
                  name: `${namePrefix}-broker`,
                  selected: value.brokerKey === PUBLISHED_BROKER_KEY,
                  disabled,
                  onSelect: () =>
                    onChange({
                      ...value,
                      brokerKey: PUBLISHED_BROKER_KEY,
                    }),
                }}
                onAdded={() =>
                  onChange({
                    ...value,
                    deliveryMethod: "broker_delivery",
                    brokerKey: PUBLISHED_BROKER_KEY,
                  })
                }
              />
              {sourceBarrelId &&
              value.brokerKey === PUBLISHED_BROKER_KEY &&
              publishedBrokerName ?
                <UnpaidContainerLinkPanel
                  sourceBarrelId={sourceBarrelId}
                  companyName={publishedBrokerName}
                  kind="broker"
                  containers={unpaidContainers}
                  linkedBarrelIds={publishedBrokerLinkedIds}
                  disabled={disabled}
                />
              : null}
            </>
          : (
            <div className="grid gap-2.5">
              {catalogBrokers.map((broker) => (
                <ChoiceCard
                  key={broker.key}
                  id={`${namePrefix}-broker-${broker.key}`}
                  name={`${namePrefix}-broker`}
                  checked={value.brokerKey === broker.key}
                  disabled={disabled}
                  title={broker.name}
                  description={`${broker.location} — ${broker.summary}`}
                  onSelect={() => onChange({ ...value, brokerKey: broker.key })}
                />
              ))}
            </div>
          )}
        </fieldset>
      : null}

      {showCourierUi ?
        <fieldset className="relative z-10 space-y-2.5">
          <legend className="text-sm font-medium tracking-tight text-foreground">
            Local transportation — {country}
          </legend>
          <p className="text-xs leading-relaxed text-muted-foreground">
            After customs clearance, choose whether to use the courier company
            published for this container, or provide your own transportation.
          </p>
          <ChoiceCard
            id={`${namePrefix}-courier-own`}
            name={`${namePrefix}-courier`}
            checked={isOwnTransportCourierKey(value.courierKey)}
            disabled={disabled}
            title="I'll provide my own transportation"
            description="You will collect the container or hire your own driver after customs release. A local courier is not required."
            onSelect={() =>
              onChange({
                ...value,
                courierKey: OWN_TRANSPORT_COURIER_KEY,
              })
            }
          />
          {publishedCouriers.length > 0 ?
            <>
              <BarrelPublishedOutboundCharges
                charges={publishedCouriers}
                kinds={["courier"]}
                showHeading={false}
                includePaid
                selection={{
                  name: `${namePrefix}-courier`,
                  selected: value.courierKey === PUBLISHED_COURIER_KEY,
                  disabled,
                  onSelect: () =>
                    onChange({
                      ...value,
                      courierKey: PUBLISHED_COURIER_KEY,
                    }),
                }}
                onAdded={() =>
                  onChange({
                    ...value,
                    courierKey: PUBLISHED_COURIER_KEY,
                  })
                }
              />
              {sourceBarrelId &&
              value.courierKey === PUBLISHED_COURIER_KEY &&
              publishedCourierName ?
                <UnpaidContainerLinkPanel
                  sourceBarrelId={sourceBarrelId}
                  companyName={publishedCourierName}
                  kind="courier"
                  containers={unpaidContainers}
                  linkedBarrelIds={publishedCourierLinkedIds}
                  disabled={disabled}
                />
              : null}
            </>
          : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              A courier company appears here when staff publishes one for this
              container. You can still choose your own transportation now.
            </p>
          )}
        </fieldset>
      : null}
    </div>
  );
}

export function isDestinationClearanceChoiceComplete(
  value: DestinationClearanceChoiceValue,
  charges: readonly BarrelOutboundShippingChargeView[] = [],
  destinationCountry?: string | null,
): boolean {
  const presentation = destinationClearancePresentation(
    charges,
    destinationCountry,
  );
  if (presentation.showBrokerUi) {
    if (!value.deliveryMethod) return false;
    if (value.deliveryMethod === "broker_delivery" && !value.brokerKey) {
      return false;
    }
  }
  if (
    presentation.showCourierUi &&
    presentation.publishedCouriers.length > 0 &&
    !isAllowedCustomerCourierKey(value.courierKey)
  ) {
    return false;
  }
  return true;
}
