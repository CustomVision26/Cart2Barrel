import { revalidatePath } from "next/cache";

export function revalidateProductReturnBarrelPaths(): void {
  revalidatePath("/dashboard/barrels");
  revalidatePath("/dashboard/barrels/product-to-barrel");
  revalidatePath("/dashboard/barrels/product-to-barrel-history");
  revalidatePath("/admin/barrels");
  revalidatePath("/admin/barrels/assign-to-barrel");
  revalidatePath("/admin/barrels/assign-to-barrel-history");
  revalidatePath("/admin/packages");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/orders-history");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders-history");
}
