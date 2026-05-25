import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft, Lock } from "lucide-react";
import { redirect } from "next/navigation";
import type Stripe from "stripe";

import { CartCheckoutSummaryCard } from "@/components/dashboard/cart-checkout-summary-card";
import { CartEmbeddedCheckoutClient } from "@/components/dashboard/cart-embedded-checkout-client";
import { buttonVariants } from "@/components/ui/button";
import { getCartCheckoutOrderSummaryForUser } from "@/data/cart";
import {
  checkoutProcessingFeeRegionLabel,
  type CheckoutProcessingFeeRegion,
} from "@/lib/checkout-processing-surcharge";
import {
  getStripeServer,
  isStripeCartCheckoutConfigured,
  stripeCheckoutUiMode,
} from "@/lib/stripe-server";
import { cn } from "@/lib/utils";

function stripeCheckoutLinesFromSession(
  session: Stripe.Checkout.Session
): { description: string; quantity: number; amountCents: number }[] {
  const raw = session.line_items;
  if (!raw || typeof raw !== "object" || !("data" in raw)) return [];
  const data = (raw as { data: Stripe.LineItem[] }).data;
  if (!Array.isArray(data)) return [];
  return data.map((li) => ({
    description: li.description?.trim() || "Line item",
    quantity: typeof li.quantity === "number" ? li.quantity : 1,
    amountCents: li.amount_total ?? 0,
  }));
}

function parseCheckoutSessionFeeRegion(
  raw: string | undefined,
): CheckoutProcessingFeeRegion | null {
  if (raw === "domestic_us" || raw === "international") return raw;
  return null;
}

function parseNonNegativeIntMeta(value: string | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

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
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    });
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

  const stripeLines = stripeCheckoutLinesFromSession(session);
  const orderId = session.metadata?.orderId ?? null;
  const dbSummary = orderId
    ? await getCartCheckoutOrderSummaryForUser(userId, orderId)
    : null;
  const totalCents =
    dbSummary?.totalAmount ??
    session.amount_total ??
    stripeLines.reduce((s, l) => s + l.amountCents, 0);

  const processingFeeMeta = parseNonNegativeIntMeta(
    session.metadata?.processingFeeCents,
  );
  const feeRegion = parseCheckoutSessionFeeRegion(
    session.metadata?.processingFeeRegion,
  );
  const dbLinePresent = (() => {
    if (!dbSummary) return false;
    return (
      dbSummary.batchBundles.some((b) => b.lines.length > 0) ||
      dbSummary.standaloneLines.length > 0 ||
      dbSummary.containerLines.length > 0
    );
  })();
  const showProcessingFeeWithDbLines =
    dbLinePresent &&
    processingFeeMeta != null &&
    processingFeeMeta > 0;

  const cancelHref = `/dashboard/cart?canceled=1&session_id=${encodeURIComponent(sessionId)}`;
  /** Releases the pending order so cart lines reappear, without the “canceled” banner. */
  const resumeCartHref = `/dashboard/cart?resume=1&session_id=${encodeURIComponent(sessionId)}`;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 pb-14">
      <div className="flex flex-col gap-3 border-b border-border/50 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={resumeCartHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 w-fit gap-2 text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Return to cart
        </Link>
        <Link
          href={cancelHref}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "w-full border-border/70 text-muted-foreground hover:text-foreground sm:w-auto"
          )}
        >
          Cancel checkout
        </Link>
      </div>

      <header className="space-y-6 border-b border-border/50 pb-8">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Secure checkout
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground md:text-[2rem] md:leading-tight">
            Complete your order
          </h1>
          <p className="max-w-2xl pt-2 text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">
            Review the merchandise and totals below. Payment is submitted on the following step.
            You will receive an order confirmation with your reference number after payment is
            authorized.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2 rounded-none border border-border/60 bg-muted px-3 py-1.5 tabular-nums text-foreground/90">
            <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            SSL encrypted
          </span>
          <span className="hidden h-px w-7 bg-border sm:block" aria-hidden />
          <span className="leading-relaxed">
            Payments are handled by Stripe. Card credentials are transmitted securely and are not
            stored by Cart2Barrel.
          </span>
        </div>

        <nav aria-label="Checkout progress">
          <ol className="flex flex-wrap gap-0 divide-x divide-border border border-border/60 bg-muted text-xs md:text-[13px]">
            <li className="flex min-w-[10rem] flex-1 items-center gap-3 px-4 py-3">
              <span
                className="flex size-7 shrink-0 items-center justify-center border border-primary/40 bg-primary/15 text-[11px] font-semibold text-foreground tabular-nums"
                aria-hidden
              >
                1
              </span>
              <div className="min-w-0">
                <p className="font-medium text-foreground">Order review</p>
                <p className="truncate text-muted-foreground">Merchandise and pricing</p>
              </div>
            </li>
            <li className="flex min-w-[10rem] flex-1 items-center gap-3 px-4 py-3 opacity-90">
              <span
                className="flex size-7 shrink-0 items-center justify-center border border-border bg-background text-[11px] font-semibold text-muted-foreground tabular-nums"
                aria-hidden
              >
                2
              </span>
              <div className="min-w-0">
                <p className="font-medium text-foreground">Billing & payment</p>
                <p className="truncate text-muted-foreground">Stripe secure payment form</p>
              </div>
            </li>
          </ol>
        </nav>
      </header>

      <div
        className={cn(
          "flex flex-col gap-10",
          "lg:flex-row lg:items-start lg:justify-between lg:gap-10 xl:gap-14"
        )}
      >
        <section
          className="relative z-0 min-w-0 flex-1 space-y-2"
          aria-labelledby="checkout-order-summary-heading"
        >
          <h2 id="checkout-order-summary-heading" className="sr-only">
            Order summary
          </h2>
          <CartCheckoutSummaryCard
            dbSummary={dbSummary}
            stripeLines={stripeLines}
            totalCents={totalCents}
            processingFeeCents={
              showProcessingFeeWithDbLines ? processingFeeMeta : null
            }
            processingFeeGroupLabel={
              showProcessingFeeWithDbLines && feeRegion ?
                checkoutProcessingFeeRegionLabel(feeRegion)
              : null
            }
          />
        </section>
        <aside
          className={cn(
            "relative isolate z-[1] w-full shrink-0",
            "lg:sticky lg:top-6 lg:self-start xl:top-8",
            "lg:w-[min(100%,420px)] xl:w-[min(100%,448px)]"
          )}
          aria-labelledby="checkout-payment-heading"
        >
          <h2 id="checkout-payment-heading" className="sr-only">
            Payment
          </h2>
          <CartEmbeddedCheckoutClient
            key={sessionId}
            checkoutSessionId={sessionId}
            clientSecret={clientSecret}
          />
        </aside>
      </div>
    </div>
  );
}
