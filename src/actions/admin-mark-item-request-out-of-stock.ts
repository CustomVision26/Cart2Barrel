"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { markItemRequestOutOfStockForAdmin } from "@/data/mark-item-request-out-of-stock";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { adminMarkItemRequestOutOfStockSchema } from "@/lib/validations/admin-mark-item-request-out-of-stock";

export type AdminMarkItemRequestOutOfStockState = {
  ok: boolean;
  message?: string;
};

export async function adminMarkItemRequestOutOfStockAction(
  raw: unknown
): Promise<AdminMarkItemRequestOutOfStockState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminMarkItemRequestOutOfStockSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  try {
    await markItemRequestOutOfStockForAdmin(parsed.data.itemRequestId);
    revalidateDashboardAddItem();
    revalidatePath("/admin/item-requests", "layout");
    revalidatePath("/admin/overview");
    return { ok: true, message: "Marked as out of stock. Customer will be notified on their Products tab." };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Could not mark this product as out of stock.";
    return { ok: false, message: msg };
  }
}
