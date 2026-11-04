"use server";

import { revalidatePath } from "next/cache";

import { applySaveShoppingListEstimate } from "@/data/shopping-list-quotes";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { safeCurrentUser } from "@/lib/safe-current-user";
import { saveShoppingListEstimateSchema } from "@/lib/validations/shopping-list-quote";

export type SaveShoppingListEstimateState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function saveShoppingListEstimateAction(
  raw: unknown,
): Promise<SaveShoppingListEstimateState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = saveShoppingListEstimateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return { ok: false, message: first ?? "Invalid shopping list estimate." };
  }

  const result = await applySaveShoppingListEstimate(parsed.data, cu.user.id);
  if (!result.ok) return result;

  revalidatePath("/admin/overview");
  revalidatePath("/admin/item-requests", "layout");
  revalidatePath("/dashboard/items");
  revalidateDashboardAddItem();
  revalidatePath("/dashboard/cart");

  return {
    ok: true,
    message: "Estimate sent. The shopper can preview and accept it on Add item.",
  };
}
