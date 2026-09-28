import { Suspense, type ReactNode } from "react";

import { AdminBarrelsTabNav } from "@/components/admin/admin-barrels-tab-nav";

export default function AdminBarrelsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <AdminBarrelsTabNav />
      </Suspense>
      {children}
    </div>
  );
}
