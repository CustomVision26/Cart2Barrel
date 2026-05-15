import { redirect } from "next/navigation";

import { ADMIN_ITEM_REQUESTS_ROUTES } from "@/lib/admin-item-requests-routes";

export default function AdminBatchItemsIndexPage() {
  redirect(ADMIN_ITEM_REQUESTS_ROUTES.batchItemsSubmitted);
}
