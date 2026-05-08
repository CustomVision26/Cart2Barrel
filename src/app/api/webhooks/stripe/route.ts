import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import Stripe from "stripe";

import { fulfillPaidCheckoutFromStripeSession } from "@/data/fulfill-stripe-checkout-session";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { getStripeServer } from "@/lib/stripe-server";

export const runtime = "nodejs";

async function deletePendingOrderFromExpiredSession(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    return;
  }

  const db = getDb();
  await db
    .delete(orders)
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")));

  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard");
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return new Response("STRIPE_WEBHOOK_SECRET is not set.", { status: 500 });
  }

  const body = await req.text();
  const headerList = await headers();
  const sig = headerList.get("stripe-signature");
  if (!sig) {
    return new Response("Missing stripe-signature.", { status: 400 });
  }

  const stripe = getStripeServer();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return new Response("Invalid signature.", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await fulfillPaidCheckoutFromStripeSession(session);
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      await deletePendingOrderFromExpiredSession(session);
      break;
    }
    default:
      break;
  }

  return new Response(null, { status: 200 });
}
