"use client";

import { SignIn } from "@clerk/nextjs";

import { clerkAuthCardAppearance } from "@/components/auth/clerk-auth-appearance";

export function ClerkSignInForm() {
  return (
    <SignIn
      routing="path"
      path="/login"
      signUpUrl="/signup"
      appearance={clerkAuthCardAppearance}
    />
  );
}
