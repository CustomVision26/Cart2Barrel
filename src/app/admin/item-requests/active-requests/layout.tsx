import type { ReactNode } from "react";

import { AdminActiveRequestsSubTabNav } from "@/components/admin/admin-active-requests-sub-tab-nav";
import { loadAdminItemRequestsNavState } from "@/data/admin-item-requests-page-payload";

export default async function AdminActiveRequestsSegmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const result = await loadAdminItemRequestsNavState();

  if (!result.ok || result.nav.noData) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-4">
      <AdminActiveRequestsSubTabNav
        quoteHistoryCount={result.nav.quoteHistoryCount}
        outsidePurchaseCount={result.nav.outsidePurchaseCount}
      />
      {children}
    </div>
  );
}
