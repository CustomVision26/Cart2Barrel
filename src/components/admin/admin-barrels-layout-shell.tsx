"use client";

import { AdminBarrelsTabNav } from "@/components/admin/admin-barrels-tab-nav";

export function AdminBarrelsLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <AdminBarrelsTabNav />
      {children}
    </div>
  );
}
