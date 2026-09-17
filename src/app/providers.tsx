"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

import { clerkBaseAppearance } from "@/components/auth/clerk-auth-appearance";
import { ThemeProvider } from "@/components/theme/theme-provider";
import {
  CLERK_AFTER_AUTH_PATH,
  CLERK_SIGN_IN_PATH,
  CLERK_SIGN_UP_PATH,
} from "@/lib/clerk-auth-paths";
import { clerkFrontendApiProxyUrl } from "@/lib/clerk-middleware-options";

function ClerkWithTheme({ children }: { children: ReactNode }) {
  const proxyUrl = clerkFrontendApiProxyUrl();
  return (
    <ClerkProvider
      dynamic
      appearance={clerkBaseAppearance}
      signInUrl={CLERK_SIGN_IN_PATH}
      signUpUrl={CLERK_SIGN_UP_PATH}
      signInFallbackRedirectUrl={CLERK_AFTER_AUTH_PATH}
      signUpFallbackRedirectUrl={CLERK_AFTER_AUTH_PATH}
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
