"use client";

import { useActionState, useState } from "react";

import type { SaveShippingAddressState } from "@/actions/shipping-address";
import { saveShippingAddressAction } from "@/actions/shipping-address";
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
import { Input } from "@/components/ui/input";
import type { Address } from "@/db/schema";
import { JAMAICA_PARISHES } from "@/lib/parishes";
import {
  isJamaicaShippingCountry,
  SHIPPING_COUNTRIES,
} from "@/lib/shipping-countries";
import type { AfterSaveRedirect } from "@/lib/validations/shipping-address-payload";
import { cn } from "@/lib/utils";

const initialState: SaveShippingAddressState = {};

const selectClassName = cn(
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none md:text-sm",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "dark:bg-input/30",
);

type ShippingAddressFormProps = {
  address: Address | undefined;
  afterSaveRedirect?: AfterSaveRedirect;
};

/** International shipping label for barrel delivery. Not used for billing identity. */
export function ShippingAddressForm({
  address,
  afterSaveRedirect = "/",
}: ShippingAddressFormProps) {
  const [country, setCountry] = useState(address?.country?.trim() ?? "");
  const isJamaica = isJamaicaShippingCountry(country);

  const [state, formAction, pending] = useActionState(
    saveShippingAddressAction,
    initialState,
  );

  return (
    <Card className="w-full max-w-lg border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          Shipping address
          <HelpBalloon label="About shipping address" tooltipClassName="w-80">
            Where we deliver your packed barrel worldwide. This is your shipping label, separate
            from the account name on your profile.
          </HelpBalloon>
        </CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="afterSaveRedirect" value={afterSaveRedirect} />
        <CardContent>
          <FieldSet className="gap-6">
            <FieldLegend variant="label">Delivery address</FieldLegend>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="country">Country</FieldLabel>
                <select
                  id="country"
                  name="country"
                  required
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  aria-invalid={!!state.fieldErrors?.country}
                  className={selectClassName}
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
                  {isJamaica ? "Parish" : "State / province / region"}
                </FieldLabel>
                {isJamaica ?
                  <select
                    id="stateOrRegion"
                    name="stateOrRegion"
                    key="parish-select"
                    defaultValue={address?.parish ?? ""}
                    aria-invalid={!!state.fieldErrors?.stateOrRegion}
                    className={selectClassName}
                  >
                    <option value="">Select parish</option>
                    {JAMAICA_PARISHES.map((p) => (
                      <option key={p} value={p}>
                        {p}
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
                  placeholder={isJamaica ? "Optional" : "Postal or ZIP code"}
                  defaultValue={address?.postalCode ?? ""}
                  aria-invalid={!!state.fieldErrors?.postalCode}
                />
                <FieldError errors={fieldErr(state.fieldErrors?.postalCode)} />
              </Field>
            </FieldGroup>
          </FieldSet>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-end">
          {state.message && !state.ok && (
            <p className="text-sm text-destructive sm:mr-auto">{state.message}</p>
          )}
          <Button type="submit" disabled={pending || !country} size="lg">
            {pending ? "Saving…" : "Save shipping address"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function fieldErr(messages?: string[]) {
  if (!messages?.length) return undefined;
  return messages.map((message) => ({ message }));
}
