"use client";

import { useTheme } from "@/components/theme/theme-provider";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Toaster
      richColors
      closeButton
      theme={mounted && resolvedTheme === "light" ? "light" : "dark"}
    />
  );
}
