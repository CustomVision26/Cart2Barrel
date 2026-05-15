import type { ReactNode } from "react";

import { AdminActiveRequestsSubTabNav } from "@/components/admin/admin-active-requests-sub-tab-nav";
import { loadAdminItemRequestsPagePayload } from "@/data/admin-item-requests-page-payload";

export default async function AdminActiveRequestsSegmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const result = await loadAdminItemRequestsPagePayload();

  if (!result.ok || result.payload.noData) {
    return <>{children}</>;
  }

  const { quoteHistoryGroups } = result.payload;

  return (
    <div className="space-y-4">
      <AdminActiveRequestsSubTabNav quoteHistoryCount={quoteHistoryGroups.length} />
      {children}
    </div>
  );
}
