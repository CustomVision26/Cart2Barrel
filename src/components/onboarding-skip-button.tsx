"use client";

import { useTransition } from "react";

import { skipOnboardingAction } from "@/actions/skip-onboarding";
import { Button } from "@/components/ui/button";

export function OnboardingSkipButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="shrink-0 text-muted-foreground hover:text-foreground"
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          void skipOnboardingAction();
        });
      }}
    >
      {pending ? "Skipping…" : "Skip"}
    </Button>
  );
}
