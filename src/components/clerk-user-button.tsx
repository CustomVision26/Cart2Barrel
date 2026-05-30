"use client";

import dynamic from "next/dynamic";
import { UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import { BillingReceiptsAccountIcon } from "@/components/account/billing-receipts-account-panel";

const BillingReceiptsAccountPanel = dynamic(
  () =>
    import("@/components/account/billing-receipts-account-panel").then(
      (mod) => mod.BillingReceiptsAccountPanel,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground">Loading billing receipts…</p>
    ),
  },
);

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
        className="h-9 w-9 shrink-0 rounded-full border border-border/60 bg-muted"
      />
    );
  }

  return (
    <UserButton>
      <UserButton.UserProfilePage
        label="Billing Receipt"
        url="billing-receipt"
        labelIcon={<BillingReceiptsAccountIcon />}
      >
        <BillingReceiptsAccountPanel />
      </UserButton.UserProfilePage>
    </UserButton>
  );
}
