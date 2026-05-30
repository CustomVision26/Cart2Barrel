import type { ReactNode } from "react";

import { AdminSupportTabNav } from "@/components/admin/admin-support-tab-nav";

export default function AdminSupportLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Support
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage hub contact details and respond to customer issues and
          complaints.
        </p>
      </div>
      <AdminSupportTabNav />
      {children}
    </div>
  );
}
