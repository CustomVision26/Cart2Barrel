"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { listApprovedCartLinesForUser } from "@/data/cart";
import { insertCheckoutOrderItems } from "@/data/insert-checkout-order-items";
import { getOrCreateProfile } from "@/data/profiles";
import {
  combinedErrorText,
  getPgErrorCode,
  isUndefinedColumnError,
} from "@/lib/db-column-missing";
import {
  formatStripeApiErrorForUi,
  getAppOrigin,
  getStripeServer,
  isStripeCartCheckoutConfigured,
  stripeCheckoutUiMode,
} from "@/lib/stripe-server";
import { checkoutExcludedPaymentMethodTypes } from "@/lib/stripe-checkout-exclusions";
import type Stripe from "stripe";

export type CreateCartCheckoutState =
  | { ok: true; mode: "hosted"; checkoutUrl: string }
  | { ok: true; mode: "embedded_page"; sessionId: string }
  | { ok: false; message: string };

export async function createCartCheckoutAction(): Promise<CreateCartCheckoutState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  if (!isStripeCartCheckoutConfigured()) {
    const ui = stripeCheckoutUiMode();
    const base =
      "Payments are not fully configured. Add STRIPE_SECRET_KEY to your .env file (see .env.example), restart the dev server";
    if (ui === "embedded_page") {
      return {
        ok: false,
        message: `${base}, and set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY for embedded checkout (or set STRIPE_CHECKOUT_UI_MODE=hosted for redirect-only Checkout).`,
      };
    }
    return {
      ok: false,
      message: `${base}.`,
    };
  }

  const checkoutUiMode = stripeCheckoutUiMode();

  const lines = await listApprovedCartLinesForUser(userId);
  if (lines.length === 0) {
    return { ok: false, message: "Your cart is empty." };
  }

  const cu = await currentUser();
  try {
    await getOrCreateProfile(
      userId,
      cu?.primaryEmailAddress?.emailAddress ??
        cu?.emailAddresses?.[0]?.emailAddress ??
        null
    );
  } catch {
    return { ok: false, message: "Could not prepare your account for checkout." };
  }

  const totalAmount = lines.reduce((sum, line) => sum + line.quote.totalPrice, 0);
  /** Stripe minimum charge for USD card payments (see Stripe currency docs). */
  const minUsdLineCents = 50;
  const shortfallLine = lines.find(
    (l) =>
      !Number.isFinite(l.quote.totalPrice) ||
      l.quote.totalPrice < minUsdLineCents
  );
  if (shortfallLine) {
    return {
      ok: false,
      message:
        "Each cart line must total at least $0.50 USD (Stripe minimum). Ask staff to revise the estimate, then refresh.",
    };
  }
  if (!Number.isFinite(totalAmount) || totalAmount < minUsdLineCents) {
    return {
      ok: false,
      message:
        "Cart total is too small for checkout (Stripe requires at least $0.50 USD). Ask staff to revise estimates.",
    };
  }

  const requestIds = lines.map((l) => l.request.id);

  const db = getDb();
  const taken = await db
    .select({ itemRequestId: orderItems.itemRequestId })
    .from(orderItems)
    .where(inArray(orderItems.itemRequestId, requestIds));

  if (taken.length > 0) {
    return {
      ok: false,
      message: "Your cart changed while checking out. Refresh the page and try again.",
    };
  }

  const [order] = await db
    .insert(orders)
    .values({
      clerkUserId: userId,
      status: "pending",
      totalAmount,
    })
    .returning();

  if (!order) {
    return { ok: false, message: "Could not create order." };
  }

  const reserve = await insertCheckoutOrderItems(order.id, lines);
  if (!reserve.ok) {
    await db.delete(orders).where(eq(orders.id, order.id));
    const code = getPgErrorCode(reserve.cause);
    console.error("[createCartCheckout] order_items insert failed", reserve.cause);

    let message = "Could not reserve your order lines.";
    if (code === "23505") {
      message =
        "Your cart changed while checking out. Refresh the page and try again.";
    } else if (code === "23503") {
      message =
        "A cart item is no longer valid. Refresh the page and try again.";
    } else if (isUndefinedColumnError(reserve.cause, "fulfillment_status")) {
      message =
        "Database is missing latest order columns. Run npm run db:migrate (see drizzle/), then try checkout again.";
    } else {
      const detail = combinedErrorText(reserve.cause).trim().slice(0, 280);
      if (detail) {
        message = `${message} (${detail})`;
      }
    }
    return { ok: false, message };
  }

  const origin = getAppOrigin();
  const stripe = getStripeServer();

  try {
    const excluded = checkoutExcludedPaymentMethodTypes();
    const common = {
      mode: "payment" as const,
      client_reference_id: userId,
      customer_email:
        cu?.primaryEmailAddress?.emailAddress ??
        cu?.emailAddresses?.[0]?.emailAddress ??
        undefined,
      ...(excluded && excluded.length > 0
        ? { excluded_payment_method_types: excluded }
        : {}),
      line_items: lines.map((line) => {
        const name = line.request.productName?.trim() || "Requested item";
        return {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: line.quote.totalPrice,
            product_data: {
              name,
              description: `Qty ${line.request.quantity}`,
            },
          },
        };
      }),
      metadata: {
        orderId: order.id,
      },
    };

    const session =
      checkoutUiMode === "embedded_page"
        ? await stripe.checkout.sessions.create({
            ...common,
            /* Embedded Checkout + Payment Element (`@stripe/react-stripe-js/checkout`). */
            ui_mode: "elements",
            return_url: `${origin}/dashboard/cart/success?session_id={CHECKOUT_SESSION_ID}`,
          } as Parameters<Stripe["checkout"]["sessions"]["create"]>[0])
        : await stripe.checkout.sessions.create({
            ...common,
            success_url: `${origin}/dashboard/cart/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/dashboard/cart?canceled=1&session_id={CHECKOUT_SESSION_ID}`,
          } as Parameters<Stripe["checkout"]["sessions"]["create"]>[0]);

    if (checkoutUiMode === "embedded_page") {
      if (!session.client_secret) {
        await db.delete(orders).where(eq(orders.id, order.id));
        return {
          ok: false,
          message: "Stripe did not return embedded checkout credentials.",
        };
      }
      revalidatePath("/dashboard/cart");
      revalidatePath("/dashboard");
      return { ok: true, mode: "embedded_page", sessionId: session.id };
    }

    if (!session.url) {
      await db.delete(orders).where(eq(orders.id, order.id));
      return { ok: false, message: "Stripe did not return a checkout URL." };
    }

    revalidatePath("/dashboard/cart");
    revalidatePath("/dashboard");

    return { ok: true, mode: "hosted", checkoutUrl: session.url };
  } catch (e) {
    await db.delete(orders).where(eq(orders.id, order.id));
    console.error("[createCartCheckout] Stripe checkout.sessions.create failed", e);
    const detail = formatStripeApiErrorForUi(e);
    const base = "Could not start Stripe checkout.";
    let message = detail ? `${base} ${detail}` : base;
    if (!detail && checkoutUiMode === "embedded_page") {
      message = `${base} Try STRIPE_CHECKOUT_UI_MODE=hosted for redirect-only Checkout, or check server logs.`;
    }
    return { ok: false, message };
  }
}
