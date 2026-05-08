import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fulfillPaidCheckoutFromStripeSession } from "@/data/fulfill-stripe-checkout-session";
import { orderListSelect } from "@/data/order-list-select";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import { getStripeServer, isStripeSecretConfigured } from "@/lib/stripe-server";

type PageProps = {
  searchParams?: Promise<{ session_id?: string }>;
};

export default async function CartCheckoutSuccessPage({ searchParams }: PageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const sp = (await searchParams) ?? {};
  const sessionId =
    typeof sp.session_id === "string" && sp.session_id.length > 0
      ? sp.session_id
      : null;
  if (!sessionId) {
    redirect("/dashboard/cart");
  }

  if (!isStripeSecretConfigured()) {
    redirect("/dashboard/cart");
  }

  const stripe = getStripeServer();
  let stripeSession;
  try {
    stripeSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });
  } catch {
    redirect("/dashboard/cart");
  }

  if (stripeSession.client_reference_id !== userId) {
    redirect("/dashboard/cart");
  }

  const orderId = stripeSession.metadata?.orderId;
  if (!orderId) {
    redirect("/dashboard/cart");
  }

  const db = getDb();
  const [initial] = await db
    .select(orderListSelect)
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!initial || initial.clerkUserId !== userId) {
    redirect("/dashboard/cart");
  }

  let order = initial;
  if (stripeSession.payment_status === "paid") {
    await fulfillPaidCheckoutFromStripeSession(stripeSession);
    const [refetched] = await db
      .select(orderListSelect)
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (refetched) {
      order = refetched;
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Thank you
        </h1>
        <p className="text-sm text-muted-foreground">
          {order.status === "paid"
            ? "Your payment was received. We will move your order into fulfillment."
            : "Your payment is being confirmed. Refresh this page in a moment if status still shows pending."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order summary</CardTitle>
          <CardDescription className="font-mono text-xs">
            {order.id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-lg font-semibold text-foreground">
            {formatUsd(order.totalAmount)}
          </p>
          <p className="text-sm capitalize text-muted-foreground">
            Status: {order.status}
          </p>
          <Link
            href="/dashboard/orders"
            className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View orders
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
