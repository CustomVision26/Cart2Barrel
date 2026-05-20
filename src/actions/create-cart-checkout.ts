"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { orderItems, orders } from "@/db/schema";
import {
  assembleApprovedCartForUser,
  buildCheckoutOrderLinesFromAssembledCart,
  buildStripeLineItemsFromAssembledCart,
  buildStripeLineItemsFromContainerCheckoutLines,
} from "@/data/cart";
import { deletePendingOrderAndRestoreContainerCart } from "@/data/delete-pending-order-with-container-restore";
import { getPrimaryShippingAddress } from "@/data/addresses";
import { insertCheckoutOrderItems } from "@/data/insert-checkout-order-items";
import { insertOrderContainerItems } from "@/data/insert-order-container-items";
import { getOrCreateProfile } from "@/data/profiles";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import {
  clearUserContainerCartLinesForOfferings,
  listContainerCheckoutLinesForUser,
  sumContainerQuantitiesByKind,
  sumContainerCheckoutLinesCents,
} from "@/data/user-container-cart";
import { resolveContainerPackingForUserCart } from "@/data/user-cart-container-packing";
import {
  buildStripeLineItemsFromOutboundShippingCart,
  clearOutboundShippingCartForCharges,
  listUserOutboundShippingCartLines,
  sumOutboundShippingCartLinesCents,
} from "@/data/barrel-outbound-shipping-charges";
import {
  checkoutProcessingFeeRegionLabel,
  computeCheckoutProcessingSurchargeCents,
  processingFeeRegionFromShippingCountry,
} from "@/lib/checkout-processing-surcharge";
import { checkoutExcludedPaymentMethodTypes } from "@/lib/stripe-checkout-exclusions";
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

  const assembled = await assembleApprovedCartForUser(userId);
  const containerCheckoutLines = await listContainerCheckoutLinesForUser(userId);
  const containerSubtotalCents = sumContainerCheckoutLinesCents(containerCheckoutLines);
  const { containerPackingRates } = await getMerchantPricingForEstimates(userId);
  const { barrelCount, binCount } = sumContainerQuantitiesByKind(
    containerCheckoutLines.map((l) => ({ quantity: l.quantity, kind: l.kind })),
  );
  const containerPacking = await resolveContainerPackingForUserCart(
    userId,
    barrelCount,
    binCount,
    containerPackingRates,
  );
  const outboundShippingCartLines = await listUserOutboundShippingCartLines(userId);
  const outboundShippingSubtotalCents = sumOutboundShippingCartLinesCents(
    outboundShippingCartLines,
  );

  if (
    assembled.batchGroups.length === 0 &&
    assembled.standaloneLines.length === 0 &&
    containerCheckoutLines.length === 0 &&
    outboundShippingCartLines.length === 0
  ) {
    return { ok: false, message: "Your cart is empty." };
  }

  const orderLines = buildCheckoutOrderLinesFromAssembledCart(assembled);
  const builtLines = buildStripeLineItemsFromAssembledCart(assembled);
  const stripeLineItems = [
    ...builtLines.lineItems,
    ...buildStripeLineItemsFromContainerCheckoutLines(containerCheckoutLines, {
      barrelCount: containerPacking.barrelCount,
      binCount: containerPacking.binCount,
      rates: containerPackingRates,
    }),
    ...buildStripeLineItemsFromOutboundShippingCart(outboundShippingCartLines),
  ];

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

  const merchandiseSubtotalCents =
    assembled.estimatedTotalCents +
    containerSubtotalCents +
    containerPacking.totalPackingFeeCents +
    outboundShippingSubtotalCents;
  const shipAddr = await getPrimaryShippingAddress(userId);
  const processingFeeRegion = processingFeeRegionFromShippingCountry(
    shipAddr?.country,
  );
  const processingFeeCents = computeCheckoutProcessingSurchargeCents(
    merchandiseSubtotalCents,
    processingFeeRegion,
  );
  if (processingFeeCents > 0) {
    const regionLabel = checkoutProcessingFeeRegionLabel(processingFeeRegion);
    stripeLineItems.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: processingFeeCents,
        product_data: {
          name: "Card processing fee",
          description: `Estimated pass-through for ${regionLabel} (non-refundable)`,
        },
      },
    });
  }

  const totalAmount = merchandiseSubtotalCents + processingFeeCents;
  /** Stripe minimum charge for USD card payments (see Stripe currency docs). */
  const minUsdLineCents = 50;
  const shortfallStripe = stripeLineItems.find(
    (row) =>
      !Number.isFinite(row.price_data.unit_amount) ||
      row.price_data.unit_amount < minUsdLineCents
  );
  if (shortfallStripe) {
    return {
      ok: false,
      message:
        "Each checkout line must total at least $0.50 USD (Stripe minimum). Ask staff to revise the estimate, then refresh.",
    };
  }
  if (!Number.isFinite(totalAmount) || totalAmount < minUsdLineCents) {
    return {
      ok: false,
      message:
        "Cart total is too small for checkout (Stripe requires at least $0.50 USD). Ask staff to revise estimates.",
    };
  }

  const requestIds = orderLines.map((l) => l.itemRequestId);

  const db = getDb();
  if (requestIds.length > 0) {
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
  }

  const [order] = await db
    .insert(orders)
    .values({
      clerkUserId: userId,
      status: "pending",
      totalAmount,
      internalQuotedSaleTaxCents: builtLines.quotedSalesTaxIntentCents,
    })
    .returning();

  if (!order) {
    return { ok: false, message: "Could not create order." };
  }

  const reserve = await insertCheckoutOrderItems(order.id, orderLines);
  if (!reserve.ok) {
    await deletePendingOrderAndRestoreContainerCart(order.id, userId);
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

  const containerReserve = await insertOrderContainerItems(
    order.id,
    containerCheckoutLines,
  );
  if (!containerReserve.ok) {
    await deletePendingOrderAndRestoreContainerCart(order.id, userId);
    console.error(
      "[createCartCheckout] order_container_items insert failed",
      containerReserve.cause,
    );
    return {
      ok: false,
      message:
        "Could not reserve container lines. If this persists, run database migrations and try again.",
    };
  }

  if (containerCheckoutLines.length > 0) {
    await clearUserContainerCartLinesForOfferings(
      userId,
      containerCheckoutLines.map((l) => l.offeringId),
    );
  }

  const outboundChargeIds = outboundShippingCartLines.map((l) => l.chargeId);
  if (outboundChargeIds.length > 0) {
    await clearOutboundShippingCartForCharges(userId, outboundChargeIds);
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
      line_items: stripeLineItems,
      metadata: {
        orderId: order.id,
        merchandiseSubtotalCents: String(merchandiseSubtotalCents),
        processingFeeCents: String(processingFeeCents),
        processingFeeRegion,
        quotedSalesTaxIntentCents: String(builtLines.quotedSalesTaxIntentCents),
        outboundChargeIds: outboundChargeIds.join(","),
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

    await db
      .update(orders)
      .set({ stripeCheckoutSessionId: session.id })
      .where(and(eq(orders.id, order.id), eq(orders.status, "pending")));

    if (checkoutUiMode === "embedded_page") {
      if (!session.client_secret) {
        await deletePendingOrderAndRestoreContainerCart(order.id, userId);
        return {
          ok: false,
          message: "Stripe did not return embedded checkout credentials.",
        };
      }
      /* Do not revalidate cart here: the user is still on /dashboard/cart with reserved
       * order_items; a refetch would flash an empty cart before `location.assign` to checkout. */
      return { ok: true, mode: "embedded_page", sessionId: session.id };
    }

    if (!session.url) {
      await deletePendingOrderAndRestoreContainerCart(order.id, userId);
      return { ok: false, message: "Stripe did not return a checkout URL." };
    }

    revalidatePath("/dashboard/cart");
    revalidatePath("/dashboard/shipping");
    revalidatePath("/dashboard");

    return { ok: true, mode: "hosted", checkoutUrl: session.url };
  } catch (e) {
    await deletePendingOrderAndRestoreContainerCart(order.id, userId);
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
