"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { abandonPendingOrderFromStripeCheckoutSession } from "@/data/abandon-stripe-checkout-session";
import { abandonStripeCheckoutSchema } from "@/lib/validations/stripe-checkout";

export type AbandonStripeCheckoutState = { ok: boolean; message?: string };

export async function abandonStripeCheckoutAction(
  raw: unknown
): Promise<AbandonStripeCheckoutState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = abandonStripeCheckoutSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const result = await abandonPendingOrderFromStripeCheckoutSession(
    userId,
    parsed.data.checkoutSessionId,
  );
  if (!result.ok) {
    if (result.reason === "wrong_user") {
      return { ok: false, message: "Not your checkout session." };
    }
    return { ok: false, message: "Invalid checkout session." };
  }

  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard");

  return { ok: true };
}
