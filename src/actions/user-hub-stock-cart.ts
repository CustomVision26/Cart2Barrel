"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { getShippingAddressForUser } from "@/data/addresses";
import {
  removeHubStockCartItemForUser,
  refreshHubStockCartShippingForUser,
  updateHubStockCartItemShipAddress,
  upsertHubStockCartItem,
} from "@/data/hub-stock-cart";
import { getOrCreateProfile } from "@/data/profiles";
import { savedAddressToHubStockUsAddress, usDeliveryAddressPrompt } from "@/lib/hub-stock";
import {
  addHubStockToCartSchema,
  removeHubStockCartItemSchema,
  updateHubStockCartAddressSchema,
} from "@/lib/validations/hub-stock";

export type HubStockCartActionState =
  | { ok: true }
  | { ok: false; message: string };

function revalidateHubStockCart(): void {
  revalidatePath("/");
  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard");
}

export async function addHubStockToCartAction(
  input: unknown,
): Promise<HubStockCartActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in to add this to your cart." };
  }

  const parsed = addHubStockToCartSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await getOrCreateProfile(userId, null);
  } catch {
    return { ok: false, message: "Could not prepare your account." };
  }

  let usAddress = parsed.data.usAddress;
  if (parsed.data.destination === "us_address") {
    if (parsed.data.addressId) {
      const address = await getShippingAddressForUser(userId, parsed.data.addressId);
      const mapped = address ? savedAddressToHubStockUsAddress(address) : null;
      if (!mapped) {
        return {
          ok: false,
          message:
            usDeliveryAddressPrompt(address) ??
            "Select a United States shipping address.",
        };
      }
      usAddress = mapped;
    } else if (!usAddress) {
      return { ok: false, message: "Select a US shipping address." };
    }
  }

  const result = await upsertHubStockCartItem({
    clerkUserId: userId,
    productId: parsed.data.productId,
    quantity: parsed.data.quantity,
    destination: parsed.data.destination,
    usAddress,
  });
  if (!result.ok) return result;

  revalidateHubStockCart();
  return { ok: true };
}

export async function updateHubStockCartAddressAction(
  input: unknown,
): Promise<HubStockCartActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }
  const parsed = updateHubStockCartAddressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const result = await updateHubStockCartItemShipAddress({
    clerkUserId: userId,
    cartItemId: parsed.data.cartItemId,
    addressId: parsed.data.addressId,
  });
  if (!result.ok) return result;
  revalidateHubStockCart();
  return { ok: true };
}

export async function removeHubStockCartItemAction(
  input: unknown,
): Promise<HubStockCartActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }
  const parsed = removeHubStockCartItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  await removeHubStockCartItemForUser(userId, parsed.data.cartItemId);
  await refreshHubStockCartShippingForUser(userId);
  revalidateHubStockCart();
  return { ok: true };
}
