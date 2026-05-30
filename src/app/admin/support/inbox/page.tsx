import { AdminSupportInbox } from "@/components/admin/admin-support-inbox";
import { loadAdminSupportInboxGroups } from "@/data/support-tickets";

export const dynamic = "force-dynamic";

export default async function AdminSupportInboxPage() {
  const groups = await loadAdminSupportInboxGroups();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Messages grouped by customer. Open a ticket to view the full thread and
        reply.
      </p>
      <AdminSupportInbox groups={groups} />
    </div>
  );
}
