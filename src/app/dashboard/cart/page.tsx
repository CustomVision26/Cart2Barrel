import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CartBatchBundleCard } from "@/components/dashboard/cart-batch-bundle-card";
import { CartCheckoutButton } from "@/components/dashboard/cart-checkout-button";
import { CartRemoveButton } from "@/components/dashboard/cart-remove-button";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Separator } from "@/components/ui/separator";
import { abandonPendingOrderFromStripeCheckoutSession } from "@/data/abandon-stripe-checkout-session";
import { getPrimaryShippingAddress } from "@/data/addresses";
import { assembleApprovedCartForUser } from "@/data/cart";
import { syncPendingCartCheckoutsBeforeCartPage } from "@/data/sync-pending-cart-checkouts";
import { formatUsd } from "@/lib/admin-markup";
import { CART_CHECKOUT_USD_DISCLAIMER } from "@/lib/cart-checkout-disclaimer";
import {
  checkoutProcessingFeeRegionLabel,
  computeCheckoutProcessingSurchargeCents,
  isCheckoutProcessingSurchargeEnabled,
  processingFeeRegionFromShippingCountry,
} from "@/lib/checkout-processing-surcharge";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { isStripeCartCheckoutConfigured } from "@/lib/stripe-server";

type PageProps = {
  searchParams?: Promise<{
    canceled?: string;
    /** Abandon open Stripe checkout + pending order; no “canceled” banner (e.g. Back to cart). */
    resume?: string;
    session_id?: string;
  }>;
};

export default async function DashboardCartPage({ searchParams }: PageProps) {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const sp = (await searchParams) ?? {};
  const canceled = sp.canceled === "1";
  const resumeCheckout = sp.resume === "1";
  const cancelSessionId =
    typeof sp.session_id === "string" && sp.session_id.length > 0
      ? sp.session_id
      : null;

  if (cancelSessionId && (canceled || resumeCheckout)) {
    await abandonPendingOrderFromStripeCheckoutSession(
      userId,
      cancelSessionId,
    );
    if (resumeCheckout) {
      redirect("/dashboard/cart");
    }
    redirect("/dashboard/cart?canceled=1");
  }

  const checkoutSync = await syncPendingCartCheckoutsBeforeCartPage(userId);

  const assembled = await assembleApprovedCartForUser(userId);
  const hasAny =
    assembled.batchGroups.length > 0 || assembled.standaloneLines.length > 0;
  const lineCount =
    assembled.batchGroups.reduce((n, g) => n + g.lines.length, 0) +
    assembled.standaloneLines.length;

  const merchandiseSubtotalCents = assembled.estimatedTotalCents;
  const shipAddr = hasAny ? await getPrimaryShippingAddress(userId) : undefined;
  const processingFeeRegion = processingFeeRegionFromShippingCountry(
    shipAddr?.country,
  );
  const processingPreviewCents =
    hasAny && isCheckoutProcessingSurchargeEnabled() ?
      computeCheckoutProcessingSurchargeCents(
        merchandiseSubtotalCents,
        processingFeeRegion,
      )
    : 0;
  const estimatedChargeAtCheckoutCents =
    merchandiseSubtotalCents + processingPreviewCents;
  const processingRegionLabel = checkoutProcessingFeeRegionLabel(processingFeeRegion);
  return (
    <div className="space-y-6">
      {canceled && !resumeCheckout ? (
        <p className="text-sm text-muted-foreground">
          Checkout was canceled. Your items are still saved here when you are
          ready.
        </p>
      ) : null}
      {checkoutSync.openCheckouts.length > 0 ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Checkout still open</CardTitle>
            <CardDescription>
              Payment was started for this cart, so line items are reserved until the
              Stripe session completes, expires, or you release them. Use{" "}
              <span className="font-medium text-foreground">Resume</span> to pay, or{" "}
              <span className="font-medium text-foreground">Return items to cart</span>{" "}
              if the payment page is stuck after a connection drop.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {checkoutSync.openCheckouts.map(({ sessionId }) => (
              <div
                key={sessionId}
                className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/60 p-3 sm:flex-row sm:items-center sm:gap-3"
              >
                <Link
                  href={`/dashboard/cart/checkout?session_id=${encodeURIComponent(sessionId)}`}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Resume checkout
                </Link>
                <span className="hidden text-muted-foreground sm:inline" aria-hidden>
                  ·
                </span>
                <Link
                  href={`/dashboard/cart?resume=1&session_id=${encodeURIComponent(sessionId)}`}
                  className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Return items to cart
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Cart
        </h1>
        <p className="text-sm text-muted-foreground">
          Accepted quotes appear here. When you accepted a bundled batch estimate, the cart
          uses the staff&nbsp;combined subtotal at checkout (not the sum of each
          standalone line preview). Photos use your saved request image where available.
        </p>
      </div>

      {!hasAny ? (
        <Card>
          <CardHeader>
            <CardTitle>Your cart is empty</CardTitle>
            <CardDescription>
              When you receive a quote on a requested item, use{" "}
              <span className="font-medium text-foreground">Accept estimate</span>{" "}
              on your batch or product flows to add it here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={DASHBOARD_ADD_ITEM_ROUTES.productsActive}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Go to your requests
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {assembled.batchGroups.map((group) => (
              <CartBatchBundleCard
                key={group.sessionId}
                batchSessionId={group.sessionId}
                batchNumber={group.batchNumber}
                siteKey={group.siteKey}
                siteMerchandiseCents={group.estimate.siteMerchandiseTotalCents}
                serviceHandlingCents={group.estimate.serviceHandlingTotalCents}
                siteShippingCents={group.estimate.siteShippingTotalCents}
                siteSaleTaxCents={group.estimate.siteSaleTaxTotalCents}
                customerSubtotalCents={group.estimate.subtotalCents}
                lines={group.lines.map((bl) => ({
                  itemRequestId: bl.request.id,
                  productName: bl.request.productName,
                  productUrl: bl.request.productUrl,
                  quantity: bl.request.quantity,
                  productSize: bl.request.productSize,
                  productColor: bl.request.productColor,
                  displayProductImageUrl: bl.displayProductImageUrl,
                }))}
              />
            ))}

            {assembled.standaloneLines.map(({ request: r, quote: q, taxCents, displayProductImageUrl }) => (
              <li key={r.id} className="border-b border-border px-4 py-4 last:border-b-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <ProductRequestThumbnail
                    variant="cart"
                    imageUrl={displayProductImageUrl}
                    productLabel={r.productName}
                  />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-foreground">
                          {r.productName?.trim() || "Unnamed product"}
                        </p>
                        <a
                          href={r.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-xs text-primary underline-offset-2 hover:underline"
                        >
                          {r.productUrl}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          Qty {r.quantity}
                          {r.productSize?.trim()
                            ? ` · Size ${r.productSize.trim()}`
                            : ""}
                          {r.productColor?.trim()
                            ? ` · Color ${r.productColor.trim()}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-start gap-1 sm:gap-2">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">
                            {formatUsd(q.totalPrice)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Line estimate
                          </p>
                        </div>
                        <CartRemoveButton itemRequestId={r.id} />
                      </div>
                    </div>
                    <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <div className="flex justify-between gap-4 sm:block">
                        <dt>Item cost</dt>
                        <dd className="text-foreground sm:text-right">
                          {formatUsd(q.itemCost)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 sm:block">
                        <dt>Service &amp; handling</dt>
                        <dd className="text-foreground sm:text-right">
                          {formatUsd(q.serviceFee)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 sm:block">
                        <dt>Est. shipping</dt>
                        <dd className="text-foreground sm:text-right">
                          {formatUsd(q.estimatedShipping)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 sm:block">
                        <dt>Tax</dt>
                        <dd className="text-foreground sm:text-right">
                          {formatUsd(taxCents)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Separator />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Estimated total</CardTitle>
              <CardDescription>
                Quoted lines below, plus an estimated card-processing fee from your default
                shipping jurisdiction where surcharges are enabled.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {processingPreviewCents > 0 ?
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-4 text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-muted-foreground">Quoted subtotal</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatUsd(merchandiseSubtotalCents)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-muted-foreground">
                      Card processing (preview · {processingRegionLabel})
                    </span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatUsd(processingPreviewCents)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 border-t border-border/50 pt-3">
                    <span className="font-medium text-foreground">
                      Est. charge at checkout
                    </span>
                    <span className="text-lg font-semibold tabular-nums tracking-tight text-foreground">
                      {formatUsd(estimatedChargeAtCheckoutCents)}
                    </span>
                  </div>
                </div>
              : (
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {formatUsd(merchandiseSubtotalCents)}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {processingPreviewCents > 0 ?
                  <>
                    Preview uses your{" "}
                    <Link
                      href="/settings/delivery"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      default shipping address
                    </Link>
                    {shipAddr?.country?.trim() ?
                      <> ({shipAddr.country.trim()})</>
                    : null}
                    . The exact total is set when checkout opens.
                  </>
                : !isCheckoutProcessingSurchargeEnabled() ?
                  <>Surcharges are disabled in environment settings, so checkout should match this subtotal.</>
                : <>
                    With current rate settings there is no separate processing line for this
                    cart.
                  </>}
              </p>
              <p className="text-xs text-muted-foreground">
                {lineCount} quoted {lineCount === 1 ? "line" : "lines"} (
                {assembled.batchGroups.length}{" "}
                {assembled.batchGroups.length === 1 ? "batch" : "batches"},{" "}
                {assembled.standaloneLines.length}{" "}
                {assembled.standaloneLines.length === 1 ? "individual" : "individuals"})
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {CART_CHECKOUT_USD_DISCLAIMER}
              </p>
              <CartCheckoutButton
                checkoutEnabled={isStripeCartCheckoutConfigured()}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
