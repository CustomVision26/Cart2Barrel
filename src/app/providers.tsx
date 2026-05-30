"use client";

import { useMemo } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

import { ThemeProvider, useTheme } from "@/components/theme/theme-provider";

function ClerkWithTheme({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const appearance = useMemo(
    () => ({
      baseTheme: resolvedTheme,
    }),
    [resolvedTheme],
  );

  return (
    <ClerkProvider dynamic appearance={appearance}>
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
