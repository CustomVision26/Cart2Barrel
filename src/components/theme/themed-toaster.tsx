"use client";

import { useTheme } from "@/components/theme/theme-provider";
import { Toaster } from "sonner";

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      richColors
      closeButton
      position="bottom-right"
      theme={resolvedTheme === "light" ? "light" : "dark"}
    />
  );
}
