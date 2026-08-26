"use client";

import { useActionState, useState } from "react";

import type { SaveShippingAddressState } from "@/actions/shipping-address";
import { saveShippingAddressAction } from "@/actions/shipping-address";
import { OnboardingSkipButton } from "@/components/onboarding-skip-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HelpBalloon } from "@/components/ui/help-balloon";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { FieldLabelWithHelp } from "@/components/ui/field-label-with-help";
import { Input, nativeSelectFieldClassName } from "@/components/ui/input";
import type { Address } from "@/db/schema";
import { JAMAICA_PARISHES } from "@/lib/parishes";
import {
  isJamaicaShippingCountry,
  isUnitedStatesShippingCountry,
  SHIPPING_COUNTRIES,
} from "@/lib/shipping-countries";
import { US_STATES } from "@/lib/us-states";
import type { AfterSaveRedirect } from "@/lib/validations/shipping-address-payload";

const initialState: SaveShippingAddressState = {};

export type ShippingContactDefaults = {
  fullName: string;
  phone: string;
};

type ShippingAddressFormProps = {
  address: Address | undefined;
  contactDefaults?: ShippingContactDefaults;
  afterSaveRedirect?: AfterSaveRedirect;
  /** Show skip control (onboarding only). */
  showSkip?: boolean;
  /** First address / onboarding — always saved as primary. */
  forcePrimary?: boolean;
  /** Compact title when used inside the address book. */
  variant?: "card" | "embedded";
  onCancel?: () => void;
};

/** Recipient contact and street lines saved as one shipping record. */
export function ShippingAddressForm({
  address,
  contactDefaults,
  afterSaveRedirect = "/",
  showSkip = false,
  forcePrimary = false,
  variant = "card",
  onCancel,
}: ShippingAddressFormProps) {
  const [country, setCountry] = useState(address?.country?.trim() ?? "");
  const isJamaica = isJamaicaShippingCountry(country);
  const isUnitedStates = isUnitedStatesShippingCountry(country);
  const isPrimaryByDefault = forcePrimary || Boolean(address?.isDefault);

  const [state, formAction, pending] = useActionState(
    saveShippingAddressAction,
    initialState,
  );

  const defaultName =
    address?.recipientName?.trim() || contactDefaults?.fullName || "";
  const defaultPhone =
    address?.recipientPhone?.trim() || contactDefaults?.phone || "";

  const formBody = (
    <form action={formAction}>
      <input type="hidden" name="afterSaveRedirect" value={afterSaveRedirect} />
      {address?.id ?
        <input type="hidden" name="id" value={address.id} />
      : null}
      {forcePrimary ?
        <input type="hidden" name="isPrimary" value="true" />
      : null}
      <CardContent className={variant === "embedded" ? "px-0" : undefined}>
        <FieldSet className="gap-6">
          <FieldLegend variant="label">Recipient contact</FieldLegend>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="fullName">Full name</FieldLabel>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                placeholder="e.g. Alex Morgan"
                defaultValue={defaultName}
                aria-invalid={!!state.fieldErrors?.fullName}
              />
              <FieldError errors={fieldErr(state.fieldErrors?.fullName)} />
            </Field>
            <Field>
              <FieldLabelWithHelp
                htmlFor="phone"
                label="Phone number"
                help="Number we use for this delivery and account coordination."
                helpLabel="About phone number"
              />
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="e.g. 876-555-1234"
                defaultValue={defaultPhone}
                aria-invalid={!!state.fieldErrors?.phone}
              />
              <FieldError errors={fieldErr(state.fieldErrors?.phone)} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSet className="mt-8 gap-6">
          <FieldLegend variant="label">Delivery address</FieldLegend>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="label">
                Label{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Input
                id="label"
                name="label"
                placeholder="Home, work, family…"
                defaultValue={address?.label ?? ""}
                aria-invalid={!!state.fieldErrors?.label}
              />
              <FieldError errors={fieldErr(state.fieldErrors?.label)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="country">Country</FieldLabel>
              <select
                id="country"
                name="country"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                aria-invalid={!!state.fieldErrors?.country}
                className={nativeSelectFieldClassName}
              >
                <option value="">Select country</option>
                {SHIPPING_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <FieldError errors={fieldErr(state.fieldErrors?.country)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="line1">Street address</FieldLabel>
              <Input
                id="line1"
                name="line1"
                autoComplete="address-line1"
                placeholder="Street number, route, or P.O. box details"
                defaultValue={address?.line1 ?? ""}
                aria-invalid={!!state.fieldErrors?.line1}
              />
              <FieldError errors={fieldErr(state.fieldErrors?.line1)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="line2">
                Address line 2{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </FieldLabel>
              <Input
                id="line2"
                name="line2"
                autoComplete="address-line2"
                placeholder="Apartment, suite, unit, building"
                defaultValue={address?.line2 ?? ""}
                aria-invalid={!!state.fieldErrors?.line2}
              />
              <FieldError errors={fieldErr(state.fieldErrors?.line2)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="cityOrTown">City or town</FieldLabel>
              <Input
                id="cityOrTown"
                name="cityOrTown"
                autoComplete="address-level2"
                placeholder="City or town"
                defaultValue={address?.cityOrTown ?? ""}
                aria-invalid={!!state.fieldErrors?.cityOrTown}
              />
              <FieldError errors={fieldErr(state.fieldErrors?.cityOrTown)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="stateOrRegion">
                {isJamaica ?
                  "Parish"
                : isUnitedStates ?
                  "State"
                : "State / province / region"}
              </FieldLabel>
              {isJamaica ?
                <select
                  id="stateOrRegion"
                  name="stateOrRegion"
                  key="parish-select"
                  defaultValue={address?.parish ?? ""}
                  aria-invalid={!!state.fieldErrors?.stateOrRegion}
                  className={nativeSelectFieldClassName}
                >
                  <option value="">Select parish</option>
                  {JAMAICA_PARISHES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              : isUnitedStates ?
                <select
                  id="stateOrRegion"
                  name="stateOrRegion"
                  key="us-state-select"
                  defaultValue={address?.parish ?? ""}
                  aria-invalid={!!state.fieldErrors?.stateOrRegion}
                  className={nativeSelectFieldClassName}
                >
                  <option value="">Select state</option>
                  {US_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              : <Input
                  id="stateOrRegion"
                  name="stateOrRegion"
                  key="state-input"
                  autoComplete="address-level1"
                  placeholder="State, province, or region"
                  defaultValue={address?.parish ?? ""}
                  aria-invalid={!!state.fieldErrors?.stateOrRegion}
                />
              }
              <FieldError errors={fieldErr(state.fieldErrors?.stateOrRegion)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="postalCode">
                Postal / ZIP code
                {isJamaica ?
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    (optional)
                  </span>
                : null}
              </FieldLabel>
              <Input
                id="postalCode"
                name="postalCode"
                autoComplete="postal-code"
                placeholder={
                  isUnitedStates ? "12345"
                  : isJamaica ? "Optional"
                  : "Postal or ZIP code"
                }
                defaultValue={address?.postalCode ?? ""}
                aria-invalid={!!state.fieldErrors?.postalCode}
              />
              <FieldError errors={fieldErr(state.fieldErrors?.postalCode)} />
            </Field>
            {!forcePrimary ?
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isPrimary"
                  value="true"
                  defaultChecked={isPrimaryByDefault}
                  disabled={Boolean(address?.isDefault)}
                  className="size-4 rounded border-border accent-primary"
                />
                <span>Primary shipping address</span>
              </label>
            : null}
          </FieldGroup>
        </FieldSet>
      </CardContent>
      <CardFooter
        className={
          variant === "embedded" ?
            "flex flex-col items-stretch gap-3 px-0 sm:flex-row sm:justify-end"
          : "flex flex-col items-stretch gap-3 sm:flex-row sm:justify-end"
        }
      >
        {state.message && !state.ok && (
          <p className="text-sm text-destructive sm:mr-auto">{state.message}</p>
        )}
        {showSkip ?
          <OnboardingSkipButton />
        : null}
        {onCancel ?
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        : null}
        <Button type="submit" disabled={pending || !country} size="lg">
          {pending ? "Saving…" : address ? "Save address" : "Save shipping address"}
        </Button>
      </CardFooter>
    </form>
  );

  if (variant === "embedded") {
    return formBody;
  }

  return (
    <Card className="w-full max-w-lg border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          Contact &amp; shipping address
          <HelpBalloon label="About this address" tooltipClassName="w-80">
            Name, phone, and delivery street are saved together as one shipping
            record. Mark one address as primary for barrels and invoices.
          </HelpBalloon>
        </CardTitle>
      </CardHeader>
      {formBody}
    </Card>
  );
}

function fieldErr(messages?: string[]) {
  if (!messages?.length) return undefined;
  return messages.map((message) => ({ message }));
}
