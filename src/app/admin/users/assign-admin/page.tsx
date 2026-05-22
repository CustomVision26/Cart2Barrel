import { AdminGrantAdminRolePanel } from "@/components/admin/admin-grant-admin-role-panel";
import { listProfilesForAdminUserManagement } from "@/data/customer-pricing-packages";

export const dynamic = "force-dynamic";

export default async function AdminUsersAssignAdminPage() {
  const users = await listProfilesForAdminUserManagement();

  return <AdminGrantAdminRolePanel users={users} />;
}
