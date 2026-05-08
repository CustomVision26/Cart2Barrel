"use client";

import { type FormEvent, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";

import { Button } from "@/components/ui/button";

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
const stripePromise = pk ? loadStripe(pk) : null;

type CartEmbeddedCheckoutClientProps = {
  checkoutSessionId: string;
  clientSecret: string;
};

function EmbeddedCheckoutPaymentForm({
  checkoutSessionId,
}: {
  checkoutSessionId: string;
}) {
  const checkoutState = useCheckoutElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [elementError, setElementError] = useState<string | null>(null);

  if (checkoutState.type === "loading") {
    return (
      <p className="text-sm text-muted-foreground">Loading checkout…</p>
    );
  }

  if (checkoutState.type === "error") {
    return (
      <p className="text-sm text-destructive">{checkoutState.error.message}</p>
    );
  }

  const { checkout } = checkoutState;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      const confirmResult = await checkout.confirm({
        redirect: "if_required",
      });
      if (confirmResult.type === "error") {
        setMessage(confirmResult.error.message);
        setIsSubmitting(false);
        return;
      }
      const st = confirmResult.session.status;
      if (st.type === "complete" && st.paymentStatus === "paid") {
        window.location.assign(
          `/dashboard/cart/success?session_id=${encodeURIComponent(checkoutSessionId)}`
        );
        return;
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
    setIsSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        onLoadError={(ev) => {
          setElementError(
            ev.error?.message ?? "Payment form failed to load."
          );
        }}
      />
      {elementError ? (
        <p className="text-sm text-destructive">{elementError}</p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto"
        disabled={isSubmitting || !checkout.canConfirm}
      >
        {isSubmitting
          ? "Processing…"
          : `Pay ${checkout.total.total.amount} now`}
      </Button>
      {message ? (
        <p className="text-sm text-destructive">{message}</p>
      ) : null}
    </form>
  );
}

export function CartEmbeddedCheckoutClient({
  checkoutSessionId,
  clientSecret,
}: CartEmbeddedCheckoutClientProps) {
  if (!stripePromise) {
    return (
      <p className="text-sm text-destructive">
        Stripe publishable key is not configured (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <CheckoutElementsProvider
        stripe={stripePromise}
        options={{
          clientSecret,
          elementsOptions: {
            appearance: { theme: "night" },
          },
        }}
      >
        <EmbeddedCheckoutPaymentForm checkoutSessionId={checkoutSessionId} />
      </CheckoutElementsProvider>
    </div>
  );
}
