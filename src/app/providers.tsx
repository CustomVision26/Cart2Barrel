"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

import { clerkBaseAppearance } from "@/components/auth/clerk-auth-appearance";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { clerkFrontendApiProxyUrl } from "@/lib/clerk-middleware-options";

function ClerkWithTheme({ children }: { children: ReactNode }) {
  const proxyUrl = clerkFrontendApiProxyUrl();
  return (
    <ClerkProvider
      dynamic
      appearance={clerkBaseAppearance}
      {...(proxyUrl ? { proxyUrl } : {})}
    >
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
