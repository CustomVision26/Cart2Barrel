import type { ReactNode } from "react";

import { AdminUsersTabNav } from "@/components/admin/admin-users-tab-nav";

export default function AdminUsersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Users
        </h1>
        <p className="text-sm text-muted-foreground">
          View registered accounts, grant admin access, and review assignment
          history.
        </p>
      </div>
      <AdminUsersTabNav />
      {children}
    </div>
  );
}
