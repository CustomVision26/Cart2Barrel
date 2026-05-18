"use client";

import { DashboardBarrelsTabNav } from "@/components/dashboard/dashboard-barrels-tab-nav";

export function DashboardBarrelsLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <DashboardBarrelsTabNav />
      {children}
    </div>
  );
}
