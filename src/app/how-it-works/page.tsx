import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

import { BrandLogoLink } from "@/components/brand/brand-logo-link";
import { HowItWorksPageMain } from "@/components/marketing/how-it-works-page-main";
import { ContactUsHeaderButton } from "@/components/support/contact-us-header-button";
import { UserHeaderControls } from "@/components/user-header-controls";
import { Button } from "@/components/ui/button";
import { listActiveContainerOfferingsWithImages } from "@/data/container-offerings";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import { DEFAULT_MERCHANT_SERVICE_TIERS } from "@/lib/admin-markup";
import { buildContainerCatalogChartRows, buildContainerPackingFeeChartRows } from "@/lib/container-packing-fee-chart";
import { DEFAULT_CONTAINER_PACKING_RATES } from "@/lib/container-packing-fee";
import { buildServiceHandlingFeeChartRows } from "@/lib/service-handling-fee-chart";

export default async function HowItWorksPage() {
  const { userId } = await auth();

  let inAppServiceFeeChartRows = buildServiceHandlingFeeChartRows(
    DEFAULT_MERCHANT_SERVICE_TIERS,
  );
  let outsidePurchaseServiceFeeChartRows = buildServiceHandlingFeeChartRows(
    DEFAULT_MERCHANT_SERVICE_TIERS,
  );
  let containerCatalogChartRows: ReturnType<typeof buildContainerCatalogChartRows> =
    [];
  let containerPackingChartRows = buildContainerPackingFeeChartRows(
    DEFAULT_CONTAINER_PACKING_RATES,
  );
  try {
    const catalog = await listActiveContainerOfferingsWithImages();
    containerCatalogChartRows = buildContainerCatalogChartRows(catalog);
  } catch {
    containerCatalogChartRows = [];
  }

  try {
    const pricing = await getMerchantPricingForEstimates(userId);
    inAppServiceFeeChartRows = buildServiceHandlingFeeChartRows(pricing.serviceTiers);
    outsidePurchaseServiceFeeChartRows = buildServiceHandlingFeeChartRows(
      pricing.outsidePurchaseServiceTiers,
    );
    containerPackingChartRows = buildContainerPackingFeeChartRows(
      pricing.containerPackingRates,
    );
  } catch {
    inAppServiceFeeChartRows = buildServiceHandlingFeeChartRows(
      DEFAULT_MERCHANT_SERVICE_TIERS,
    );
    outsidePurchaseServiceFeeChartRows = buildServiceHandlingFeeChartRows(
      DEFAULT_MERCHANT_SERVICE_TIERS,
    );
    containerPackingChartRows = buildContainerPackingFeeChartRows(
      DEFAULT_CONTAINER_PACKING_RATES,
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="border-b border-border/80 px-4 py-4 md:py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <BrandLogoLink />
          <nav className="flex items-center gap-2 sm:gap-3">
            {userId ?
              <>
                <span
                  className="px-3 py-2 text-sm font-medium text-foreground"
                  aria-current="page"
                >
                  How it works
                </span>
                <Button
                  variant="ghost"
                  size="lg"
                  nativeButton={false}
                  render={<Link href="/dashboard" />}
                >
                  Dashboard
                </Button>
                <ContactUsHeaderButton />
                <UserHeaderControls />
              </>
            : <>
                <span
                  className="px-3 py-2 text-sm font-medium text-foreground"
                  aria-current="page"
                >
                  How it works
                </span>
                <Button
                  variant="ghost"
                  size="lg"
                  nativeButton={false}
                  render={<Link href="/login" />}
                >
                  Sign in
                </Button>
                <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
                  Sign up
                </Button>
              </>
            }
          </nav>
        </div>
      </header>

      <HowItWorksPageMain
        isSignedIn={Boolean(userId)}
        inAppServiceFeeChartRows={inAppServiceFeeChartRows}
        outsidePurchaseServiceFeeChartRows={outsidePurchaseServiceFeeChartRows}
        containerCatalogChartRows={containerCatalogChartRows}
        containerPackingChartRows={containerPackingChartRows}
      />
    </div>
  );
}
