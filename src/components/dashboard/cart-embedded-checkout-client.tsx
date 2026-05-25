"use client";

import { type FormEvent, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { CreditCard, Info, Lock, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
const stripePromise = pk ? loadStripe(pk) : null;

/** Stripe Payment Element appearance aligned with dark dashboard (no CSS var refs). */
const stripeCheckoutAppearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#e5e5e5",
    colorBackground: "#252525",
    colorText: "#fafafa",
    colorTextSecondary: "#a3a3a3",
    colorDanger: "#f87171",
    fontFamily: "Poppins, ui-sans-serif, system-ui, sans-serif",
    borderRadius: "8px",
    spacingUnit: "3px",
  },
};

type CartEmbeddedCheckoutClientProps = {
  checkoutSessionId: string;
  clientSecret: string;
};

/** Mirrors Stripe `ConfirmError` from @stripe/stripe-js (not re-exported as a named type). */
function formatStripeCheckoutConfirmError(error: {
  message?: string;
  code?: string | null;
  paymentFailed?: { declineCode: string | null };
}): string {
  if (typeof error.message === "string" && error.message.trim()) {
    const base = error.message.trim();
    if ("code" in error && error.code === "paymentFailed" && "paymentFailed" in error) {
      const code = error.paymentFailed?.declineCode?.trim();
      return code ? `${base} (${code})` : base;
    }
    return base;
  }
  return "We were unable to complete your payment.";
}

function EmbeddedCheckoutPaymentForm({
  checkoutSessionId,
}: {
  checkoutSessionId: string;
}) {
  const checkoutState = useCheckoutElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [elementError, setElementError] = useState<string | null>(null);

  if (checkoutState.type === "loading") {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading payment form">
        <div className="space-y-3">
          <div className="h-12 animate-pulse rounded-lg bg-muted" />
          <div className="h-12 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Establishing a secure payment connection…
        </p>
      </div>
    );
  }

  if (checkoutState.type === "error") {
    return (
      <div
        className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        role="alert"
      >
        {checkoutState.error.message}
      </div>
    );
  }

  const { checkout } = checkoutState;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);
    try {
      /** Must match Checkout Session `return_url` set in create-cart-checkout; do not pass `returnUrl` to `confirm()` if the session already has `return_url` (Stripe throws IntegrationError). */
      const successUrl = `${window.location.origin}/dashboard/cart/success?session_id=${encodeURIComponent(checkoutSessionId)}`;
      const confirmResult = await checkout.confirm({
        redirect: "if_required",
      });

      if (confirmResult.type === "error") {
        setErrorMessage(formatStripeCheckoutConfirmError(confirmResult.error));
        setIsSubmitting(false);
        return;
      }

      const layered = confirmResult.session as unknown as Record<string, unknown>;

      const topPaid =
        layered.payment_status === "paid" ||
        layered.payment_status === "no_payment_required";

      const statusObjRaw = layered.status;
      const statusObj =
        statusObjRaw &&
        typeof statusObjRaw === "object" &&
        statusObjRaw !== null ?
          (statusObjRaw as { type?: string; paymentStatus?: string | null })
        : null;

      const nestedPaid =
        statusObj?.type === "complete" &&
        (statusObj.paymentStatus === "paid" ||
          statusObj.paymentStatus === "no_payment_required" ||
          statusObj.paymentStatus === "processing");

      if (topPaid || nestedPaid) {
        window.location.assign(successUrl);
        return;
      }

      if (
        statusObj?.type === "complete" &&
        statusObj.paymentStatus === "unpaid"
      ) {
        setErrorMessage(
          "Payment was unsuccessful. Use another payment method or contact your card issuer.",
        );
        setIsSubmitting(false);
        return;
      }

      if (statusObj?.type === "expired") {
        setErrorMessage(
          "This checkout session has expired. Return to your cart to begin checkout again.",
        );
        setIsSubmitting(false);
        return;
      }

      /*
       * Selecting a saved card / Link wallet only attaches a payment method; the session stays
       * `open` until `confirm()` succeeds. Never send shoppers to `/success` unless paid above.
       */
      if (statusObj?.type === "open") {
        setInfoMessage(
          "Payment method selected. Selecting a card or Link in this form authorizes Stripe to use it upon submission—it does not complete the charge until you complete payment below.",
        );
        setIsSubmitting(false);
        return;
      }

      console.warn("[cart embedded checkout] unexpected confirm status", statusObj);
      setErrorMessage(
        "We could not confirm payment automatically. Submit complete payment again, or refresh this page and retry.",
      );
      setIsSubmitting(false);
    } catch (err) {
      console.error("[cart embedded checkout confirm]", err);
      const fallback =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "An unexpected error occurred.";
      setErrorMessage(fallback);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div
        className="flex gap-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-3 text-sm text-muted-foreground"
        role="note"
      >
        <Info
          className="mt-0.5 size-4 shrink-0 text-primary"
          aria-hidden
        />
        <p className="min-w-0 leading-relaxed">
          <span className="font-medium text-foreground">
            Checkout is in two steps.
          </span>{" "}
          Use this form to select Link, a saved payment method, or enter card details as prompted.
          When you are ready, submit your order using{" "}
          <span className="font-medium text-foreground">Complete payment</span>{" "}
          below. Selecting a payment method alone does not capture funds.
        </p>
      </div>
      <PaymentElement
        onLoadError={(ev) => {
          setElementError(
            ev.error?.message ??
              "The payment form could not be loaded. Refresh the page or try again shortly."
          );
        }}
      />
      {elementError ? (
        <p className="text-sm text-destructive" role="alert">
          {elementError}
        </p>
      ) : null}
      {infoMessage ?
        <p className="text-sm text-muted-foreground" role="status">
          {infoMessage}
        </p>
      : null}
      {errorMessage ?
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      : null}
      <div className="flex flex-col gap-3 border-t border-border/40 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-1">
          {!checkout.canConfirm && !elementError ?
            <p className="text-xs text-muted-foreground" role="status">
              If Stripe is validating your selection, briefly wait until prompts above are
              dismissed, then select{" "}
              <span className="font-medium text-foreground">
                Complete payment ({checkout.total.total.amount})
              </span>
              .
            </p>
          : null}
          <Button
            type="submit"
            variant="default"
            size="lg"
            aria-disabled={isSubmitting}
            className={cn(
              "w-full shrink-0 justify-center whitespace-normal px-6 py-3 text-base leading-snug",
              "min-h-12 rounded-xl sm:w-auto sm:min-w-[min(100%,16rem)]"
            )}
            disabled={isSubmitting}
          >
            <Lock className="size-4 shrink-0 opacity-80" aria-hidden />
            <span className="text-center">
              {isSubmitting ?
                "Processing payment…"
              : `Complete payment (${checkout.total.total.amount})`}
            </span>
          </Button>
        </div>
      </div>
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
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-md",
        "ring-1 ring-border/30"
      )}
    >
      <div className="border-b border-border/50 bg-secondary px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card text-primary">
            <CreditCard className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Payment
            </p>
            <h2 className="text-lg font-semibold leading-tight text-foreground">
              Payment information
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Card and wallet details are collected securely by Stripe. Submit your order with
              complete payment when all fields are finalized.
            </p>
          </div>
        </div>
      </div>
      <div className="p-5">
        <CheckoutElementsProvider
          stripe={stripePromise}
          options={{
            clientSecret,
            elementsOptions: {
              appearance: stripeCheckoutAppearance,
            },
          }}
        >
          <EmbeddedCheckoutPaymentForm checkoutSessionId={checkoutSessionId} />
        </CheckoutElementsProvider>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/50 bg-muted px-5 py-3">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="size-3.5 shrink-0 text-primary/80" aria-hidden />
          <span>Payments processed by Stripe, Inc.</span>
        </p>
        <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
        <p className="text-[11px] text-muted-foreground">
          TLS-encrypted checkout · Major cards accepted
        </p>
      </div>
    </div>
  );
}
