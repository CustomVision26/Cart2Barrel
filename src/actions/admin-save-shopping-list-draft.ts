"use server";

import { revalidatePath } from "next/cache";

import { saveShoppingListStaffDraft } from "@/data/shopping-list-quotes";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";
import { saveShoppingListEstimateSchema } from "@/lib/validations/shopping-list-quote";

export type SaveShoppingListDraftState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function saveShoppingListDraftAction(
  raw: unknown,
): Promise<SaveShoppingListDraftState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = saveShoppingListEstimateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return { ok: false, message: first ?? "Invalid shopping list progress." };
  }

  const result = await saveShoppingListStaffDraft(parsed.data);
  if (!result.ok) return result;

  revalidatePath("/admin/overview");

  return {
    ok: true,
    message: "Progress saved. Send estimate when the rest of the list is priced.",
  };
}
