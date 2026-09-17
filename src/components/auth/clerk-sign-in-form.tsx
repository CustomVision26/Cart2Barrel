"use client";

import { SignIn } from "@clerk/nextjs";

import { clerkAuthCardAppearance } from "@/components/auth/clerk-auth-appearance";
import {
  CLERK_AFTER_AUTH_PATH,
  CLERK_SIGN_IN_PATH,
  CLERK_SIGN_UP_PATH,
} from "@/lib/clerk-auth-paths";

export function ClerkSignInForm() {
  return (
    <SignIn
      routing="path"
      path={CLERK_SIGN_IN_PATH}
      signUpUrl={CLERK_SIGN_UP_PATH}
      forceRedirectUrl={CLERK_AFTER_AUTH_PATH}
      fallbackRedirectUrl={CLERK_AFTER_AUTH_PATH}
      appearance={clerkAuthCardAppearance}
    />
  );
}
