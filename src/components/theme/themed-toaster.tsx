"use client";

import { useTheme } from "@/components/theme/theme-provider";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

function ThemedToasterInner() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      richColors
      closeButton
      theme={resolvedTheme === "light" ? "light" : "dark"}
    />
  );
}

export function ThemedToaster() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <ThemedToasterInner />;
}
