import { redirect } from "next/navigation";

import { ADMIN_ITEM_REQUESTS_ROUTES } from "@/lib/admin-item-requests-routes";

/** Old top-level tab — kept for bookmarks and external links. */
export default function AdminItemRequestsQuoteHistoryRedirectPage() {
  redirect(ADMIN_ITEM_REQUESTS_ROUTES.activeRequestsQuoteHistory);
}
