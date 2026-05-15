"use client";

import { UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";

/**
 * Clerk’s UserButton mounts via ClerkHostRenderer and often mismatches server HTML vs client
 * hydration (Next 15+ / React 19). Render a stable placeholder until the client mounts.
 */
export function ClerkUserButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        aria-hidden
        className="h-9 w-9 shrink-0 rounded-full border border-border/60 bg-muted/40"
      />
    );
  }

  return <UserButton />;
}
