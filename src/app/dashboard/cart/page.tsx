import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AlertCircle, ShoppingCart } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CartBatchBundleCard } from "@/components/dashboard/cart-batch-bundle-card";
import { CartContainerLineItem } from "@/components/dashboard/cart-container-line-item";
import { CartMerchandiseTopupLineItem } from "@/components/dashboard/cart-merchandise-topup-line-item";
import { CartHubStockPackage } from "@/components/dashboard/cart-hub-stock-package";
import { CartOutboundShippingLineItem } from "@/components/dashboard/cart-outbound-shipping-line-item";
import { CartOrderSummaryPanel } from "@/components/dashboard/cart-order-summary-panel";
import { CartQuoteLineItem } from "@/components/dashboard/cart-quote-line-item";
import { CartSection } from "@/components/dashboard/cart-section";
import { buttonVariants } from "@/components/ui/button";
import { abandonPendingOrderFromStripeCheckoutSession } from "@/data/abandon-stripe-checkout-session";
import { getPrimaryShippingAddress, listShippingAddressesForUser, toSerializableShippingAddress } from "@/data/addresses";
import { assembleApprovedCartForUser } from "@/data/cart";
import { syncPendingCartCheckoutsBeforeCartPage } from "@/data/sync-pending-cart-checkouts";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import {
  listUserContainerCartWithOfferings,
  sumContainerCartQuantitiesByKind,
  buildSpecialSuitcaseBaggageAllocation,
} from "@/data/user-container-cart";
import { getSpecialFeatureCartPricingByOfferingIds } from "@/data/special-feature-offers";
import { resolveContainerPackingForUserCart } from "@/data/user-cart-container-packing";
import {
  listUserOutboundShippingCartLines,
  sumOutboundShippingCartLinesCents,
} from "@/data/barrel-outbound-shipping-charges";
import {
  listUserMerchandiseTopupCartLines,
  sumMerchandiseTopupCartLinesCents,
} from "@/data/merchandise-topup-cart";
import {
  groupHubStockCartPackages,
  listHubStockCartLinesForUser,
  refreshHubStockCartShippingForUser,
  sumHubStockCartLinesCents,
} from "@/data/hub-stock-cart";
import {
  checkoutProcessingFeeRegionLabel,
  computeCheckoutProcessingSurchargeCents,
  isCheckoutProcessingSurchargeEnabled,
  processingFeeRegionFromShippingCountry,
} from "@/lib/checkout-processing-surcharge";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { isStripeCartCheckoutConfigured } from "@/lib/stripe-server";
import { cn } from "@/lib/utils";

type PageProps = {
  searchParams?: Promise<{
    canceled?: string;
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
  const containerCartRows = await listUserContainerCartWithOfferings(userId);
  const specialPricingByOfferingId = await getSpecialFeatureCartPricingByOfferingIds(
    containerCartRows.map((r) => r.offering),
  );
  const specialBaggageAllocation = buildSpecialSuitcaseBaggageAllocation(
    containerCartRows.map((r) => ({
      offeringId: r.offering.id,
      quantity: r.quantity,
      addedAt: r.addedAt,
    })),
    specialPricingByOfferingId,
  );
  const containerSubtotalCents = containerCartRows.reduce((s, r) => {
    const pricing = specialPricingByOfferingId.get(r.offering.id);
    const transportUnit = pricing?.transportationFeeUnitCents ?? 0;
    const baggage = specialBaggageAllocation.get(r.offering.id)?.feeCents ?? 0;
    return (
      s +
      r.offering.priceUsdCents * r.quantity +
      transportUnit * r.quantity +
      baggage
    );
  }, 0);
  const { containerPackingRates } = await getMerchantPricingForEstimates(userId);
  const { barrelCount, binCount } =
    sumContainerCartQuantitiesByKind(containerCartRows);
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
  const merchandiseTopupCartLines =
    await listUserMerchandiseTopupCartLines(userId);
  const merchandiseTopupSubtotalCents = sumMerchandiseTopupCartLinesCents(
    merchandiseTopupCartLines,
  );
  let hubStockCartLines = await listHubStockCartLinesForUser(userId);
  if (
    hubStockCartLines.some((line) => line.cartItem.destination === "us_address")
  ) {
    const rated = await refreshHubStockCartShippingForUser(userId);
    if (rated.ok) {
      hubStockCartLines = await listHubStockCartLinesForUser(userId);
    }
  }
  const hubStockPackages = groupHubStockCartPackages(hubStockCartLines);
  const hubStockSubtotalCents = sumHubStockCartLinesCents(hubStockCartLines);

  const hasQuotedLines =
    assembled.batchGroups.length > 0 || assembled.standaloneLines.length > 0;
  const hasAny =
    hasQuotedLines ||
    containerCartRows.length > 0 ||
    outboundShippingCartLines.length > 0 ||
    merchandiseTopupCartLines.length > 0 ||
    hubStockCartLines.length > 0;
  const quotedLineCount =
    assembled.batchGroups.reduce((n, g) => n + g.lines.length, 0) +
    assembled.standaloneLines.length;
  const lineCount =
    quotedLineCount +
    containerCartRows.length +
    outboundShippingCartLines.length +
    merchandiseTopupCartLines.length +
    hubStockCartLines.length;

  const merchandiseSubtotalCents =
    assembled.estimatedTotalCents +
    containerSubtotalCents +
    containerPacking.totalPackingFeeCents +
    outboundShippingSubtotalCents +
    merchandiseTopupSubtotalCents +
    hubStockSubtotalCents;
  const shipAddr = hasAny ? await getPrimaryShippingAddress(userId) : undefined;
  const savedAddresses = hubStockCartLines.length > 0
    ? (await listShippingAddressesForUser(userId)).map(toSerializableShippingAddress)
    : [];
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
    <div className="space-y-8">
      {canceled && !resumeCheckout ?
        <div
          className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
          role="status"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <p>
            Checkout was canceled. Your items are still saved here when you are ready to
            continue.
          </p>
        </div>
      : null}

      {checkoutSync.openCheckouts.length > 0 ?
        <Card className="overflow-hidden rounded-xl border-primary/30 bg-primary/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Checkout in progress</CardTitle>
            <CardDescription>
              Payment was started for this cart. Resume to complete checkout, or return
              items if the payment page is stuck.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {checkoutSync.openCheckouts.map(({ sessionId }) => (
              <div
                key={sessionId}
                className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 sm:flex-row sm:items-center sm:gap-3"
              >
                <Link
                  href={`/dashboard/cart/checkout?session_id=${encodeURIComponent(sessionId)}`}
                  className={cn(buttonVariants({ size: "sm" }), "font-semibold")}
                >
                  Resume checkout
                </Link>
                <Link
                  href={`/dashboard/cart?resume=1&session_id=${encodeURIComponent(sessionId)}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Return items to cart
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      : null}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted text-primary">
              <ShoppingCart className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Your cart
              </h1>
              {hasAny ?
                <p className="text-sm text-muted-foreground">
                  {lineCount} {lineCount === 1 ? "item" : "items"} ready for checkout
                </p>
              : null}
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Accepted estimates, in-hub products, and shipping containers from{" "}
            <Link
              href="/dashboard/barrels"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Barrels
            </Link>{" "}
            appear below. Bundled batch quotes use the staff combined subtotal at checkout.
          </p>
        </div>
        {hasAny ?
          <p className="text-sm text-muted-foreground sm:text-right">
            <Link
              href="/dashboard/barrels"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Add containers
            </Link>
          </p>
        : null}
      </header>

      {!hasAny ?
        <Card className="overflow-hidden rounded-xl border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
              <ShoppingCart className="size-7" aria-hidden />
            </span>
            <div className="space-y-1">
              <CardTitle className="font-heading text-xl">Your cart is empty</CardTitle>
              <CardDescription className="max-w-md text-sm leading-relaxed">
                Accept a quote on a requested item, add an in-hub product from the home page,
                or add barrels and bins from the Barrels page.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href={DASHBOARD_ADD_ITEM_ROUTES.productsActive}
                className={buttonVariants()}
              >
                View requests
              </Link>
              <Link
                href="/dashboard/barrels"
                className={buttonVariants({ variant: "outline" })}
              >
                Browse containers
              </Link>
            </div>
          </CardContent>
        </Card>
      : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start xl:gap-10">
          <div className="min-w-0 space-y-8">
            {hasQuotedLines ?
              <CartSection
                title="Quoted items"
                description="Accepted product estimates. Batch bundles use one combined checkout price."
                count={quotedLineCount}
              >
                <ul className="divide-y divide-border" role="list">
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
                        outsidePurchaseReceiptImageUrl:
                          bl.request.outsidePurchaseReceiptImageUrl,
                      }))}
                    />
                  ))}
                  {assembled.standaloneLines.map(
                    ({ request: r, quote: q, taxCents, displayProductImageUrl }) => (
                      <CartQuoteLineItem
                        key={r.id}
                        itemRequestId={r.id}
                        productName={r.productName}
                        productUrl={r.productUrl}
                        quantity={r.quantity}
                        productSize={r.productSize}
                        productColor={r.productColor}
                        displayProductImageUrl={displayProductImageUrl}
                        itemCostCents={q.itemCost}
                        serviceFeeCents={q.serviceFee}
                        estimatedShippingCents={q.estimatedShipping}
                        taxCents={taxCents}
                        lineTotalCents={q.totalPrice}
                        staffNote={q.staffNote}
                        outsidePurchaseReceiptImageUrl={r.outsidePurchaseReceiptImageUrl}
                      />
                    ),
                  )}
                </ul>
              </CartSection>
            : null}

            {hubStockCartLines.length > 0 ?
              <CartSection
                tone="warehouse"
                title="In-hub warehouse package"
                help="These SKUs ship from hub inventory, separate from retailer quotes, containers, specials, and outside purchases. US items to the same address pack as one shipment with a single Shippo rate."
                count={hubStockCartLines.length}
              >
                <ul className="divide-y divide-primary/20" role="list">
                  {hubStockPackages.map((pkg) => (
                    <CartHubStockPackage
                      key={pkg.key}
                      pkg={pkg}
                      savedAddresses={savedAddresses}
                    />
                  ))}
                </ul>
              </CartSection>
            : null}

            {containerCartRows.length > 0 ?
              <CartSection
                title="Shipping containers"
                description="Barrels and bins for consolidated shipping, plus packaging fees by quantity."
                count={containerCartRows.length}
              >
                <ul className="divide-y divide-border" role="list">
                  {containerCartRows.map(({ offering, quantity, images }) => {
                    const pricing = specialPricingByOfferingId.get(offering.id);
                    const baggage = specialBaggageAllocation.get(offering.id);
                    return (
                    <CartContainerLineItem
                      key={offering.id}
                      offeringId={offering.id}
                      name={offering.name}
                      kind={offering.kind}
                      sizeLabel={offering.sizeLabel}
                      quantity={quantity}
                      unitPriceCents={offering.priceUsdCents}
                      transportationFeeUnitCents={
                        pricing?.transportationFeeUnitCents ?? 0
                      }
                      airlineName={pricing?.airlineName ?? ""}
                      airlineBaggageFeeCents={baggage?.feeCents ?? 0}
                      airlineBaggageFeeDetail={baggage?.detail ?? ""}
                      imageUrl={images[0]?.imageUrl ?? null}
                      barrelCount={barrelCount}
                      binCount={binCount}
                      containerPackingRates={containerPackingRates}
                    />
                    );
                  })}
                </ul>
              </CartSection>
            : null}

            {outboundShippingCartLines.length > 0 ?
              <CartSection
                title="Outbound container shipping"
                description="Courier and customs costs for containers ready to ship from Jamaica."
                count={outboundShippingCartLines.length}
              >
                <ul className="divide-y divide-border" role="list">
                  {outboundShippingCartLines.map((line) => (
                    <CartOutboundShippingLineItem key={line.chargeId} line={line} />
                  ))}
                </ul>
              </CartSection>
            : null}

            {merchandiseTopupCartLines.length > 0 ?
              <CartSection
                title="Add-on charges"
                description="Purchase-price top-ups after a retailer price change."
                count={merchandiseTopupCartLines.length}
              >
                <ul className="divide-y divide-border" role="list">
                  {merchandiseTopupCartLines.map((line) => (
                    <CartMerchandiseTopupLineItem
                      key={line.reconciliationId}
                      line={line}
                    />
                  ))}
                </ul>
              </CartSection>
            : null}
          </div>

          <aside className="min-w-0">
            <CartOrderSummaryPanel
              lineCount={lineCount}
              merchandiseSubtotalCents={merchandiseSubtotalCents}
              estimatedTotalCents={estimatedChargeAtCheckoutCents}
              quotedAndContainerSubtotalCents={
                assembled.estimatedTotalCents +
                containerSubtotalCents +
                hubStockSubtotalCents
              }
              containerPacking={containerPacking}
              outboundShippingSubtotalCents={outboundShippingSubtotalCents}
              merchandiseTopupSubtotalCents={merchandiseTopupSubtotalCents}
              processingPreviewCents={processingPreviewCents}
              processingRegionLabel={processingRegionLabel}
              shipCountry={shipAddr?.country?.trim() ?? null}
              surchargesDisabled={!isCheckoutProcessingSurchargeEnabled()}
              checkoutEnabled={isStripeCartCheckoutConfigured()}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
