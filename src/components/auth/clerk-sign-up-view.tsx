"use client";

import dynamic from "next/dynamic";

import { ClerkAuthFormSkeleton } from "@/components/auth/clerk-auth-form-skeleton";

const ClerkSignUpForm = dynamic(
  () =>
    import("@/components/auth/clerk-sign-up-form").then((m) => m.ClerkSignUpForm),
  { ssr: false, loading: () => <ClerkAuthFormSkeleton /> }
);

export function ClerkSignUpView() {
  return <ClerkSignUpForm />;
}
