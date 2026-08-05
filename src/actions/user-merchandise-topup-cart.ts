"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import {
  addMerchandiseTopupToCart,
  removeMerchandiseTopupFromCart,
} from "@/data/merchandise-topup-cart";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import {
  addMerchandiseTopupToCartSchema,
  removeMerchandiseTopupFromCartSchema,
} from "@/lib/validations/merchandise-topup-cart";

export type MerchandiseTopupCartActionState =
  | { ok: true; message?: string }
  | { ok: false; message: string };

function revalidateTopupCartPaths() {
  revalidatePath(DASHBOARD_ADD_ITEM_ROUTES.productsActive);
  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard", "layout");
}

export async function addMerchandiseTopupToCartAction(
  raw: unknown,
): Promise<MerchandiseTopupCartActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = addMerchandiseTopupToCartSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const result = await addMerchandiseTopupToCart({
    clerkUserId: userId,
    reconciliationId: parsed.data.reconciliationId,
  });
  if (!result.ok) return result;

  revalidateTopupCartPaths();
  return { ok: true, message: "Added to cart." };
}

export async function removeMerchandiseTopupFromCartAction(
  raw: unknown,
): Promise<MerchandiseTopupCartActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = removeMerchandiseTopupFromCartSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  await removeMerchandiseTopupFromCart({
    clerkUserId: userId,
    reconciliationId: parsed.data.reconciliationId,
  });

  revalidateTopupCartPaths();
  return { ok: true };
}
