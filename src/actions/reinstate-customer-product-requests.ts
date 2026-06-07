"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { reinstateCustomerWithdrawnItemRequestsForOwner } from "@/data/reinstate-customer-item-requests";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { reinstateCustomerProductRequestsSchema } from "@/lib/validations/reinstate-customer-product-requests";

export type ReinstateCustomerProductRequestsState = {
  ok: boolean;
  message?: string;
};

export async function reinstateCustomerProductRequestsAction(
  raw: unknown,
): Promise<ReinstateCustomerProductRequestsState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "You must be signed in." };

  const parsed = reinstateCustomerProductRequestsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  try {
    const { reinstatedIds } = await reinstateCustomerWithdrawnItemRequestsForOwner({
      clerkUserId: userId,
      itemRequestIds: parsed.data.itemRequestIds,
    });
    const count = reinstatedIds.length;
    revalidateDashboardAddItem();
    revalidatePath("/dashboard/items");
    revalidatePath("/dashboard/cart");
    revalidatePath("/dashboard");
    revalidatePath("/admin/item-requests", "layout");

    const message =
      count === 1
        ? "Product moved back to Active."
        : `${count} products moved back to Active.`;

    return { ok: true, message };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Could not reinstate this product.";
    return { ok: false, message: msg };
  }
}
