import { AdminRegisteredUsersTable } from "@/components/admin/admin-registered-users-table";
import { listRegisteredUsersForAdmin } from "@/data/admin-registered-users";

export const dynamic = "force-dynamic";

export default async function AdminUsersAllUsersPage() {
  const users = await listRegisteredUsersForAdmin();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        All registered accounts from your database. Banning suspends the linked
        Clerk user and revokes their sessions.
      </p>
      <AdminRegisteredUsersTable users={users} />
    </div>
  );
}
