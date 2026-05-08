"use client";

import { useActionState } from "react";

import type { SaveShippingAddressState } from "@/actions/shipping-address";
import { saveShippingAddressAction } from "@/actions/shipping-address";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { AfterSaveRedirect } from "@/lib/validations/shipping-address-payload";
import { cn } from "@/lib/utils";

const initialState: SaveShippingAddressState = {};

type ShippingAddressFormProps = {
  address: Address | undefined;
  afterSaveRedirect?: AfterSaveRedirect;
};

/** Jamaican shipping label (barrel delivery). Not used for billing identity. */
export function ShippingAddressForm({
  address,
  afterSaveRedirect = "/",
}: ShippingAddressFormProps) {
  const [state, formAction, pending] = useActionState(
    saveShippingAddressAction,
    initialState
  );

  return (
    <Card className="w-full max-w-lg border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle>Shipping address</CardTitle>
        <CardDescription>
          Where we deliver packed barrels in Jamaica. This is your shipping label,
          separate from the account name on your profile.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="afterSaveRedirect" value={afterSaveRedirect} />
        <CardContent>
          <FieldSet className="gap-6">
            <FieldLegend variant="label">Address in Jamaica</FieldLegend>
            <FieldGroup>
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
                  placeholder="Apartment, building, district"
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
                  placeholder="e.g. May Pen, Montego Bay"
                  defaultValue={address?.cityOrTown ?? ""}
                  aria-invalid={!!state.fieldErrors?.cityOrTown}
                />
                <FieldError errors={fieldErr(state.fieldErrors?.cityOrTown)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="parish">Parish</FieldLabel>
                <select
                  id="parish"
                  name="parish"
                  defaultValue={address?.parish ?? ""}
                  aria-invalid={!!state.fieldErrors?.parish}
                  className={cn(
                    "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none md:text-sm",
                    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    "dark:bg-input/30"
                  )}
                >
                  <option value="">Select parish</option>
                  {JAMAICA_PARISHES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <FieldError errors={fieldErr(state.fieldErrors?.parish)} />
              </Field>
            </FieldGroup>
          </FieldSet>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-end">
          {state.message && !state.ok && (
            <p className="text-sm text-destructive sm:mr-auto">{state.message}</p>
          )}
          <Button type="submit" disabled={pending} size="lg">
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
