"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

/**
 * Clerk must be initialized from a client module so `UserButton` and other
 * `@clerk/react` hooks receive context under Next.js App Router + Turbopack.
 */
export function AppClerkProvider({ children }: { children: ReactNode }) {
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
