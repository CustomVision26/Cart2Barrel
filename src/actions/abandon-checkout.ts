"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { getStripeServer } from "@/lib/stripe-server";
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

  const stripe = getStripeServer();
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(
      parsed.data.checkoutSessionId
    );
  } catch {
    return { ok: false, message: "Invalid checkout session." };
  }

  if (session.client_reference_id !== userId) {
    return { ok: false, message: "Not your checkout session." };
  }

  const orderId = session.metadata?.orderId;
  if (!orderId) {
    return { ok: true };
  }

  const db = getDb();
  await db
    .delete(orders)
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")));

  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard");

  return { ok: true };
}
