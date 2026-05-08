import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { CartEmbeddedCheckoutClient } from "@/components/dashboard/cart-embedded-checkout-client";
import {
  getStripeServer,
  isStripeCartCheckoutConfigured,
  stripeCheckoutUiMode,
} from "@/lib/stripe-server";

type PageProps = {
  searchParams?: Promise<{ session_id?: string }>;
};

export default async function CartEmbeddedCheckoutPage({ searchParams }: PageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  if (
    stripeCheckoutUiMode() !== "embedded_page" ||
    !isStripeCartCheckoutConfigured()
  ) {
    redirect("/dashboard/cart");
  }

  const sp = (await searchParams) ?? {};
  const sessionId =
    typeof sp.session_id === "string" && sp.session_id.length > 0
      ? sp.session_id
      : null;
  if (!sessionId) {
    redirect("/dashboard/cart");
  }

  const stripe = getStripeServer();
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    redirect("/dashboard/cart");
  }

  if (session.client_reference_id !== userId) {
    redirect("/dashboard/cart");
  }

  if (session.status === "complete") {
    redirect(`/dashboard/cart/success?session_id=${encodeURIComponent(sessionId)}`);
  }

  if (session.status !== "open") {
    redirect("/dashboard/cart");
  }

  const clientSecret = session.client_secret;
  if (!clientSecret) {
    redirect("/dashboard/cart");
  }

  const uiMode = session.ui_mode as string | null | undefined;
  /* `elements` is current; `custom` kept for in-flight sessions created before Stripe renamed ui_mode. */
  if (uiMode !== "elements" && uiMode !== "custom") {
    redirect("/dashboard/cart");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Checkout
          </h1>
          <p className="text-sm text-muted-foreground">
            Pay securely on this page. When you finish, you will return to order
            confirmation.
          </p>
        </div>
        <Link
          href={`/dashboard/cart?canceled=1&session_id=${encodeURIComponent(sessionId)}`}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Cancel and return to cart
        </Link>
      </div>

      <CartEmbeddedCheckoutClient
        key={sessionId}
        checkoutSessionId={sessionId}
        clientSecret={clientSecret}
      />
    </div>
  );
}
