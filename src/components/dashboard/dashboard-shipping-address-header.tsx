"use client";

import { DashboardPageTitleWithHelp } from "@/components/dashboard/dashboard-page-title-with-help";

export function DashboardShippingAddressHeader() {
  return (
    <DashboardPageTitleWithHelp
      title="Profile & address"
      tooltipClassName="w-80"
      help={
        <>
          Name, phone, and street are saved together on each shipping record. You
          can keep several addresses; one must be marked primary for barrels and
          invoices.
        </>
      }
    />
  );
}
