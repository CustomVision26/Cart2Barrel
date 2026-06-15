import { revalidatePath } from "next/cache";

import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";

/** Paths touched by company purchase approve / store pickup flows. */
export function revalidateCompanyPurchasePaths(): void {
  revalidatePath("/admin/orders");
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/packages");
  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/admin/barrels");
  revalidatePath("/admin/barrels/assign-to-barrel");
  revalidatePath("/admin/barrels/assign-to-barrel-history");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/barrels/product-to-barrel");
  revalidatePath("/dashboard/barrels/product-to-barrel-history");
  revalidateDashboardAddItem();
}
