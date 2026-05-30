import { redirect } from "next/navigation";

import { ADMIN_SUPPORT_ROUTES } from "@/lib/admin-support-routes";

export default function AdminSupportIndexPage() {
  redirect(ADMIN_SUPPORT_ROUTES.contact);
}
