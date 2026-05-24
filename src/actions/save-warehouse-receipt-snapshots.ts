"use server";

import { revalidatePath } from "next/cache";

import { applyWarehouseReceiptLines } from "@/data/apply-warehouse-receipt-lines";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";
import { saveWarehouseReceiptSnapshotsSchema } from "@/lib/validations/admin-warehouse-receipt";

export type SaveWarehouseReceiptSnapshotsState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function saveWarehouseReceiptSnapshotsAction(
  raw: unknown,
): Promise<SaveWarehouseReceiptSnapshotsState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = saveWarehouseReceiptSnapshotsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid receipt data." };
  }

  const res = await applyWarehouseReceiptLines(parsed.data, {
    kind: "admin",
    clerkUserId: cu.user.id,
  });

  if (res.ok) {
    revalidatePath("/admin/purchase-orders");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/packages");
    revalidatePath("/admin/barrels/assign-to-barrel");
    revalidatePath("/admin/barrels/assign-to-barrel-history");
    revalidatePath("/dashboard/barrels/product-to-barrel");
    revalidatePath("/dashboard/barrels/product-to-barrel-history");
    revalidatePath("/admin/item-requests", "layout");
    revalidatePath("/dashboard/orders");
  }

  return res;
}
