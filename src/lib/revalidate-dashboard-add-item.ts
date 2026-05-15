import { revalidatePath } from "next/cache";

/** Invalidates Add item pages (including nested tab routes). */
export function revalidateDashboardAddItem(): void {
  revalidatePath("/dashboard/items/new", "layout");
  revalidatePath("/dashboard/items/new/add-item", "layout");
}
