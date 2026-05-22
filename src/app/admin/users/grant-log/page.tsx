import { AdminRoleGrantsLogTable } from "@/components/admin/admin-role-grants-log-table";
import { listAdminRoleGrantLog } from "@/data/admin-role-grants";

export const dynamic = "force-dynamic";

export default async function AdminUsersGrantLogPage() {
  const rows = await listAdminRoleGrantLog();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        History of admin role assignments, including which staff member granted
        access.
      </p>
      <AdminRoleGrantsLogTable rows={rows} />
    </div>
  );
}
