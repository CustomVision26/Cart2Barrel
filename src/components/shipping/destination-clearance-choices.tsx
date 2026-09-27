"use client";

import { BarrelPublishedOutboundCharges } from "@/components/shipping/barrel-published-outbound-charges";
import { CustomsClearancePolicyLink } from "@/components/shipping/customs-clearance-policy-link";
import type { BarrelOutboundShippingChargeView } from "@/lib/barrel-outbound-shipping-charge";
import {
  applyOutboundChargeBundleForCustomer,
  isOutboundChargeKindAbsorbed,
  publishedChargesForDestination,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  destinationBrokersForCountry,
  destinationCouriersForCountry,
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
}: DestinationClearanceChoicesProps) {
  const country = destinationCountry?.trim() || null;
  const bundle = charges[0]?.chargeBundle ?? [];
  const brokerAbsorbed = isOutboundChargeKindAbsorbed("broker", bundle);
  const courierAbsorbed = isOutboundChargeKindAbsorbed("courier", bundle);
  const visibleCharges = applyOutboundChargeBundleForCustomer(charges);
  const destinationBrokersPublished = country
    ? publishedChargesForDestination(visibleCharges, country, "broker")
    : [];
  const destinationCouriersPublished = country
    ? publishedChargesForDestination(visibleCharges, country, "courier")
    : [];
  const catalogBrokers = country ? destinationBrokersForCountry(country) : [];
  const catalogCouriers = country ? destinationCouriersForCountry(country) : [];
  const hasBrokers =
    destinationBrokersPublished.length > 0 || catalogBrokers.length > 0;
  const publishedBrokerInCart = destinationBrokersPublished.some(
    (charge) => charge.inCart,
  );
  const publishedCourierInCart = destinationCouriersPublished.some(
    (charge) => charge.inCart,
  );

  if (!country) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a destination shipping address to see the clearance policy, brokers,
        and local couriers for that country.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Select how this container will be cleared at destination customs in{" "}
        <span className="font-medium text-foreground">{country}</span>.{" "}
        <CustomsClearancePolicyLink country={country} />
      </p>

      <fieldset className="relative z-10 space-y-2.5">
        <legend className="sr-only">Destination customs clearance</legend>
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
              courierKey:
                value.courierKey === OWN_TRANSPORT_COURIER_KEY
                  ? OWN_TRANSPORT_COURIER_KEY
                  : destinationCouriersPublished.length > 0 || publishedCourierInCart
                    ? PUBLISHED_COURIER_KEY
                    : null,
            })
          }
        />
        {brokerAbsorbed ?
          null
        : (
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
                destinationBrokersPublished.length > 0 || publishedBrokerInCart
                  ? PUBLISHED_BROKER_KEY
                  : value.brokerKey,
              courierKey:
                value.courierKey === OWN_TRANSPORT_COURIER_KEY
                  ? OWN_TRANSPORT_COURIER_KEY
                  : destinationCouriersPublished.length > 0 ||
                      publishedCourierInCart
                    ? PUBLISHED_COURIER_KEY
                    : value.courierKey,
            })
          }
        />
        )}
      </fieldset>

      {value.deliveryMethod === "broker_delivery" && hasBrokers && !brokerAbsorbed ?
        <fieldset className="relative z-10 space-y-2.5">
          <legend className="text-sm font-medium tracking-tight text-foreground">
            Customs brokers — {country}
          </legend>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Only licensed brokers for {country} are shown.
          </p>
          {destinationBrokersPublished.length > 0 ?
            <BarrelPublishedOutboundCharges
              charges={destinationBrokersPublished}
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

      {value.deliveryMethod ?
        <fieldset className="relative z-10 space-y-2.5">
          <legend className="text-sm font-medium tracking-tight text-foreground">
            Local transportation — {country}
          </legend>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {value.deliveryMethod === "broker_delivery"
              ? `After customs clearance, arrange local delivery in ${country} or provide your own transportation.`
              : `After you clear customs, arrange local delivery in ${country} or provide your own transportation.`}
          </p>
          {destinationCouriersPublished.length > 0 && !courierAbsorbed ?
            <BarrelPublishedOutboundCharges
              charges={destinationCouriersPublished}
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
          : catalogCouriers.length > 0 && !courierAbsorbed ?
            <div className="grid gap-2.5">
              {catalogCouriers.map((courier) => (
                <ChoiceCard
                  key={courier.key}
                  id={`${namePrefix}-courier-${courier.key}`}
                  name={`${namePrefix}-courier`}
                  checked={value.courierKey === courier.key}
                  disabled={disabled}
                  title={courier.name}
                  description={`${courier.location} — ${courier.summary}`}
                  onSelect={() =>
                    onChange({ ...value, courierKey: courier.key })
                  }
                />
              ))}
            </div>
          : null}
          <ChoiceCard
            id={`${namePrefix}-courier-own-transport`}
            name={`${namePrefix}-courier`}
            checked={value.courierKey === OWN_TRANSPORT_COURIER_KEY}
            disabled={disabled}
            title="Customer will provide their own transportation"
            description={`Collect the container in person or arrange a private driver after customs release in ${country}.`}
            onSelect={() =>
              onChange({
                ...value,
                courierKey: OWN_TRANSPORT_COURIER_KEY,
              })
            }
          />
        </fieldset>
      : null}
    </div>
  );
}

export function isDestinationClearanceChoiceComplete(
  value: DestinationClearanceChoiceValue,
  bundle: BarrelOutboundShippingChargeView["chargeBundle"] = [],
): boolean {
  if (!value.deliveryMethod) return false;
  const courierAbsorbed = isOutboundChargeKindAbsorbed("courier", bundle);
  const brokerAbsorbed = isOutboundChargeKindAbsorbed("broker", bundle);
  if (!courierAbsorbed && !value.courierKey) return false;
  if (
    value.deliveryMethod === "broker_delivery" &&
    !brokerAbsorbed &&
    !value.brokerKey
  ) {
    return false;
  }
  return true;
}
