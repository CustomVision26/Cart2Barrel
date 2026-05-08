"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import {
  getItemRequestById,
  updateItemRequestLineDetailsForOwner,
} from "@/data/item-requests";
import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import { parseCustomerItemRequestLineDetails } from "@/lib/validations/customer-item-request-line-details";

export type SaveCustomerItemRequestLineDetailsState = {
  ok: boolean;
  message?: string;
};

export async function saveCustomerItemRequestLineDetailsAction(
  raw: unknown
): Promise<SaveCustomerItemRequestLineDetailsState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = parseCustomerItemRequestLineDetails(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid details." };
  }

  const d = parsed.data;
  const updated = await updateItemRequestLineDetailsForOwner(d.itemRequestId, userId, {
    quantity: d.quantity,
    productSize: d.productSize,
    productColor: d.productColor,
  });

  if (!updated) {
    return {
      ok: false,
      message: "Could not save. Item may no longer be editable.",
    };
  }

  const row = await getItemRequestById(d.itemRequestId);
  if (row && row.clerkUserId === userId) {
    await insertItemRequestLineSnapshot({
      itemRequestId: row.id,
      phase: "customer_line_edit",
      line: lineSnapshotPayloadFromItemRequest(row),
    });
  }

  revalidatePath("/dashboard/items/new");
  revalidatePath("/dashboard/items");
  revalidatePath("/admin/item-requests");

  return { ok: true, message: "Saved." };
}
