"use client";

import { SignUp } from "@clerk/nextjs";

import { clerkAuthCardAppearance } from "@/components/auth/clerk-auth-appearance";

export function ClerkSignUpForm() {
  return (
    <SignUp
      routing="path"
      path="/signup"
      signInUrl="/login"
      forceRedirectUrl="/welcome"
      fallbackRedirectUrl="/welcome"
      appearance={clerkAuthCardAppearance}
    />
  );
}
