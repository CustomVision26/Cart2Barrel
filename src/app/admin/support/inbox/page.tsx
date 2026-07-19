import { AdminNewSupportChatDialog } from "@/components/admin/admin-new-support-chat-dialog";
import { AdminSupportInbox } from "@/components/admin/admin-support-inbox";
import { listProfilesForAdminPicker } from "@/data/customer-pricing-packages";
import { loadAdminSupportInboxGroups } from "@/data/support-tickets";

export const dynamic = "force-dynamic";

export default async function AdminSupportInboxPage() {
  const [groups, customers] = await Promise.all([
    loadAdminSupportInboxGroups(),
    listProfilesForAdminPicker(),
  ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Messages grouped by customer. Open a ticket to view the full thread and
          reply, or start a new chat.
        </p>
        <AdminNewSupportChatDialog customers={customers} />
      </div>
      <AdminSupportInbox groups={groups} />
    </div>
  );
}
