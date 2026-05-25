"use client";

import { DashboardPageTitleWithHelp } from "@/components/dashboard/dashboard-page-title-with-help";

export function DashboardShippingAddressHeader() {
  return (
    <DashboardPageTitleWithHelp
      title="Profile & address"
      tooltipClassName="w-80"
      help={
        <>
          Account contact (billing / legal) and your international shipping label used for
          barrel delivery.
        </>
      }
    />
  );
}
