"use client";

import { useActionState } from "react";

import type { SaveProfileState } from "@/actions/profile";
import { saveDeliveryProfileAction } from "@/actions/profile";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { JAMAICA_PARISHES } from "@/lib/parishes";
import type { Profile } from "@/db/schema";
import { cn } from "@/lib/utils";

const initialState: SaveProfileState = {};

type ProfileFormProps = {
  profile: Profile;
};

export function ProfileForm({ profile }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    saveDeliveryProfileAction,
    initialState
  );

  return (
    <Card className="w-full max-w-lg border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle>Delivery details</CardTitle>
        <CardDescription>
          We ship consolidated barrel orders to addresses in Jamaica. Add your
          full name, phone, and local delivery address.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent>
          <FieldSet className="gap-6">
            <FieldLegend variant="label">Contact &amp; name</FieldLegend>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                <Input
                  id="fullName"
                  name="fullName"
                  autoComplete="name"
                  placeholder="e.g. Alex Morgan"
                  defaultValue={profile.fullName ?? ""}
                  aria-invalid={!!state.fieldErrors?.fullName}
                />
                <FieldError errors={fieldErr(state.fieldErrors?.fullName)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="phone">Phone number</FieldLabel>
                <FieldDescription>
                  Local or WhatsApp number you use for delivery coordination.
                </FieldDescription>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="e.g. 876-555-1234"
                  defaultValue={profile.phone ?? ""}
                  aria-invalid={!!state.fieldErrors?.phone}
                />
                <FieldError errors={fieldErr(state.fieldErrors?.phone)} />
              </Field>
            </FieldGroup>
            <FieldSeparator />
            <FieldLegend variant="label">Address in Jamaica</FieldLegend>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="addressLine1">Street address</FieldLabel>
                <Input
                  id="addressLine1"
                  name="addressLine1"
                  autoComplete="address-line1"
                  placeholder="Street number, route, or P.O. box details"
                  defaultValue={profile.addressLine1 ?? ""}
                  aria-invalid={!!state.fieldErrors?.addressLine1}
                />
                <FieldError errors={fieldErr(state.fieldErrors?.addressLine1)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="addressLine2">
                  Address line 2{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </FieldLabel>
                <Input
                  id="addressLine2"
                  name="addressLine2"
                  autoComplete="address-line2"
                  placeholder="Apartment, building, district"
                  defaultValue={profile.addressLine2 ?? ""}
                  aria-invalid={!!state.fieldErrors?.addressLine2}
                />
                <FieldError errors={fieldErr(state.fieldErrors?.addressLine2)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="cityOrTown">City or town</FieldLabel>
                <Input
                  id="cityOrTown"
                  name="cityOrTown"
                  autoComplete="address-level2"
                  placeholder="e.g. May Pen, Montego Bay"
                  defaultValue={profile.cityOrTown ?? ""}
                  aria-invalid={!!state.fieldErrors?.cityOrTown}
                />
                <FieldError errors={fieldErr(state.fieldErrors?.cityOrTown)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="parish">Parish</FieldLabel>
                <select
                  id="parish"
                  name="parish"
                  defaultValue={profile.parish ?? ""}
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
          {state.ok && state.message && (
            <p className="text-sm text-muted-foreground sm:mr-auto">
              {state.message}
            </p>
          )}
          <Button type="submit" disabled={pending} size="lg">
            {pending ? "Saving…" : "Save and continue"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function FieldSeparator() {
  return <div className="border-t border-border/60" aria-hidden />;
}

function fieldErr(messages?: string[]) {
  if (!messages?.length) return undefined;
  return messages.map((message) => ({ message }));
}
