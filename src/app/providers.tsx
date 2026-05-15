"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

/** Wraps Clerk on the client so Clerk UI (e.g. `<UserButton />`) always sees React context under Next.js App Router + Turbopack. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      dynamic
      appearance={{
        baseTheme: "dark",
      }}
    >
      {children}
    </ClerkProvider>
  );
}
