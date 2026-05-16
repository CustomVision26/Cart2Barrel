"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { withdrawCustomerActiveItemRequestsForOwner } from "@/data/withdraw-customer-item-requests";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import {
  withdrawCustomerProductRequestsSchema,
} from "@/lib/validations/withdraw-customer-product-requests";

export type WithdrawCustomerProductRequestsState = {
  ok: boolean;
  message?: string;
};

export async function withdrawCustomerProductRequestsAction(
  raw: unknown
): Promise<WithdrawCustomerProductRequestsState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "You must be signed in." };

  const parsed = withdrawCustomerProductRequestsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  try {
    const { withdrawnIds } = await withdrawCustomerActiveItemRequestsForOwner({
      clerkUserId: userId,
      itemRequestIds: parsed.data.itemRequestIds,
    });
    const count = withdrawnIds.length;
    revalidateDashboardAddItem();
    revalidatePath("/dashboard/items");
    revalidatePath("/dashboard/items/requested-items");
    revalidatePath("/dashboard");
    revalidatePath("/admin/item-requests", "layout");
    revalidatePath("/admin/overview");

    const message =
      count === 1
        ? "Request removed."
        : `${count} requests removed.`;

    return { ok: true, message };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not remove requests.";
    return { ok: false, message: msg };
  }
}
