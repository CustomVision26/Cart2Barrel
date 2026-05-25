"use client";

import { useActionState } from "react";

import type { SaveProfileState } from "@/actions/profile";
import { saveContactProfileAction } from "@/actions/profile";
import { OnboardingSkipButton } from "@/components/onboarding-skip-button";
import { Button } from "@/components/ui/button";
import { HelpBalloon } from "@/components/ui/help-balloon";
import {
  Card,
  CardContent,
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
import { FieldLabelWithHelp } from "@/components/ui/field-label-with-help";
import { Input } from "@/components/ui/input";
import type { Profile } from "@/db/schema";
import type { AfterSaveRedirect } from "@/lib/validations/profile-payload";

const initialState: SaveProfileState = {};

type ProfileFormProps = {
  profile: Profile;
  /** Where to send the user after a successful save (allowlisted server-side). */
  afterSaveRedirect?: AfterSaveRedirect;
  /** Show skip control (onboarding only). */
  showSkip?: boolean;
};

/** Account name & phone (billing / legal contact). Shipping street lines use `ShippingAddressForm`. */
export function ProfileForm({
  profile,
  afterSaveRedirect = "/",
  showSkip = false,
}: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    saveContactProfileAction,
    initialState
  );

  return (
    <Card className="w-full max-w-lg border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          Account contact
          <HelpBalloon label="About account contact" tooltipClassName="w-80">
            Legal name and phone for receipts, billing, and how we reach you. Your Delivery
            address worldwide is saved separately as a shipping label.
          </HelpBalloon>
        </CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="afterSaveRedirect" value={afterSaveRedirect} />
        <CardContent>
          <FieldSet className="gap-6">
            <FieldLegend variant="label">Name &amp; phone</FieldLegend>
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
                <FieldLabelWithHelp
                  htmlFor="phone"
                  label="Phone number"
                  help="Number we use for account, billing, and delivery coordination."
                  helpLabel="About phone number"
                />
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
          {showSkip ?
            <OnboardingSkipButton />
          : null}
          <Button type="submit" disabled={pending} size="lg">
            {pending ? "Saving…" : "Save contact"}
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
