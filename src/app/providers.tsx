"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

import { clerkBaseAppearance } from "@/components/auth/clerk-auth-appearance";
import { ThemeProvider } from "@/components/theme/theme-provider";

function ClerkWithTheme({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider dynamic appearance={clerkBaseAppearance}>
      {children}
    </ClerkProvider>
  );
}

/** Client providers: theme, appearance, and Clerk (themed). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ClerkWithTheme>{children}</ClerkWithTheme>
    </ThemeProvider>
  );
}
