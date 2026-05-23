"use client";

import dynamic from "next/dynamic";

import { ClerkAuthFormSkeleton } from "@/components/auth/clerk-auth-form-skeleton";

const ClerkSignInForm = dynamic(
  () =>
    import("@/components/auth/clerk-sign-in-form").then((m) => m.ClerkSignInForm),
  { ssr: false, loading: () => <ClerkAuthFormSkeleton /> }
);

export function ClerkSignInView() {
  return <ClerkSignInForm />;
}
