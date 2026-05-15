"use server";

import { revalidatePath } from "next/cache";

import { applyWarehouseReceiptLines } from "@/data/apply-warehouse-receipt-lines";
import { safeCurrentUser } from "@/lib/safe-current-user";
import { saveWarehouseReceiptSnapshotsSchema } from "@/lib/validations/admin-warehouse-receipt";

export type SubmitCustomerWarehouseReceiptState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function submitCustomerWarehouseReceiptAction(
  raw: unknown,
): Promise<SubmitCustomerWarehouseReceiptState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user?.id) {
    return { ok: false, message: "You must be signed in to submit a receipt." };
  }

  const parsed = saveWarehouseReceiptSnapshotsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid receipt data." };
  }

  const res = await applyWarehouseReceiptLines(parsed.data, {
    kind: "customer",
    clerkUserId: cu.user.id,
  });

  if (res.ok) {
    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard", "layout");
  }

  return res;
}
