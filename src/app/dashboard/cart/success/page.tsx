import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { redirect } from "next/navigation";

import { CartCheckoutSuccessToast } from "@/components/dashboard/cart-checkout-success-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  fulfillPaidCheckoutFromStripeSession,
  revalidateAfterPaidCheckoutFulfillment,
} from "@/data/fulfill-stripe-checkout-session";
import { orderListSelect } from "@/data/order-list-select";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { formatUsd } from "@/lib/admin-markup";
import { CART_CHECKOUT_USD_DISCLAIMER } from "@/lib/cart-checkout-disclaimer";
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
    const fulfilledOnce = await fulfillPaidCheckoutFromStripeSession(stripeSession);
    let [latest] = await db
      .select(orderListSelect)
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    order = latest ?? order;

    let fulfilledAgain = false;
    if (latest?.status === "pending") {
      const refreshedSession = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });
      fulfilledAgain = await fulfillPaidCheckoutFromStripeSession(refreshedSession);
      const [second] = await db
        .select(orderListSelect)
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      order = second ?? order;
    }

    if (fulfilledOnce || fulfilledAgain) {
      after(() => {
        revalidateAfterPaidCheckoutFulfillment();
      });
    }
  }

  return (
    <div className="space-y-6">
      <CartCheckoutSuccessToast
        variant={order.status === "paid" ? "paid" : "pending"}
        dedupeKey={sessionId}
        headline={
          order.status === "paid"
            ? "Payment successful"
            : "Checking payment status"
        }
        body={
          order.status === "paid"
            ? `Order ${order.id.slice(0, 8)}… · ${formatUsd(order.totalAmount)} — your paid items appear on Orders with fulfillment status.`
            : `${formatUsd(order.totalAmount)} · Stripe reports ${stripeSession.payment_status}; if our order still shows pending, wait a moment and refresh, or contact support.`
        }
      />
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
          {stripeSession.payment_status === "paid" && order.status !== "paid" ?
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Stripe reports a successful charge, but this order is still marked pending in our
              database. Wait a few seconds and refresh; if it stays pending, contact support with
              your order id above.
            </p>
          : null}
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
          <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
            {CART_CHECKOUT_USD_DISCLAIMER}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
