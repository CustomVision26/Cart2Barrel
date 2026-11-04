"use server";

import { applyUpdateStorePickupIntake } from "@/data/apply-company-purchase-store-pickup";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { revalidateCompanyPurchasePaths } from "@/lib/revalidate-company-purchase-paths";
import { safeCurrentUser } from "@/lib/safe-current-user";
import { updateStorePickupIntakeSchema } from "@/lib/validations/admin-order-item";

export type UpdateStorePickupIntakeState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function updateStorePickupIntakeAction(
  raw: unknown,
): Promise<UpdateStorePickupIntakeState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = updateStorePickupIntakeSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return { ok: false, message: first ?? "Invalid store pickup intake." };
  }

  const result = await applyUpdateStorePickupIntake(parsed.data, cu.user.id);
  if (result.ok) {
    revalidateCompanyPurchasePaths();
  }
  return result;
}
