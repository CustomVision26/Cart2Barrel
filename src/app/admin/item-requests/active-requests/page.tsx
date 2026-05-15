import { redirect } from "next/navigation";

import { ADMIN_ITEM_REQUESTS_ROUTES } from "@/lib/admin-item-requests-routes";

/** Default landing for Active requests — Queue is the first sub-tab. */
export default function AdminActiveRequestsIndexPage() {
  redirect(ADMIN_ITEM_REQUESTS_ROUTES.activeRequestsQueue);
}
