import { redirect } from "next/navigation";

import { ADMIN_USERS_ROUTES } from "@/lib/admin-users-routes";

export default function AdminUsersPage() {
  redirect(ADMIN_USERS_ROUTES.assignAdmin);
}
