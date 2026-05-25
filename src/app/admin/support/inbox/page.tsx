import { AdminSupportInbox } from "@/components/admin/admin-support-inbox";
import { listAdminSupportInboxGroups } from "@/data/support-tickets";

export default async function AdminSupportInboxPage() {
  const groups = await listAdminSupportInboxGroups();

  return (
    <section>
      <h2 className="mb-4 text-lg font-medium text-foreground">
        Inbox — grouped by customer
      </h2>
      <AdminSupportInbox groups={groups} />
    </section>
  );
}
