"use client";

import { DashboardPageTitleWithHelp } from "@/components/dashboard/dashboard-page-title-with-help";

export function DashboardProductToBarrelHeader() {
  return (
    <DashboardPageTitleWithHelp
      title="Product to barrel"
      tooltipClassName="w-80"
      help={
        <>
          Track products that arrived in good condition and staff container assignments.
          Assignment and moves are handled by Cart2Barrel staff — this page shows fulfillment
          status, container alias, and when each product was assigned.
        </>
      }
    />
  );
}
