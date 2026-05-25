import { redirect } from "next/navigation";

import { ADMIN_SUPPORT_ROUTES } from "@/lib/admin-support-routes";

export default function AdminSupportPage() {
  redirect(ADMIN_SUPPORT_ROUTES.inbox);
}
