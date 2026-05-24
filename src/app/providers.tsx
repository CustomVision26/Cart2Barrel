"use client";

import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/theme/theme-provider";

/** Client providers: theme, appearance, and Clerk (themed). */
export function AppProviders({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
