import { Suspense } from "react";

import { HomeMarketingHero } from "@/components/marketing/home-marketing-hero";
import { HomePageHeader } from "@/components/marketing/home-page-header";
import { HomeHubStockSection } from "@/components/marketing/home-hub-stock-section";
import { HomeSpotlightCarouselFallback } from "@/components/marketing/home-spotlight-carousel-fallback";
import { HomeSpotlightSection } from "@/components/marketing/home-spotlight-section";
import { HomeStarterBundlesMarquee } from "@/components/marketing/home-starter-bundles-marquee";
import { RetailerToShippingSteps } from "@/components/marketing/retailer-to-shipping-steps";
import { SiteContactFooter } from "@/components/marketing/site-contact-footer";
import { SpecialFeaturePromoBanner } from "@/components/marketing/special-feature-promo-banner";

type Props = {
  userId: string | null;
};

/** Shared Home storefront (header, hero, steps, categories, in-hub, spotlight). */
export function HomePageContent({ userId }: Props) {
  const isSignedIn = Boolean(userId);

  return (
    <div className="amani-storefront flex min-h-full flex-1 flex-col">
      <HomePageHeader userId={userId} />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-4 py-8 md:gap-12 md:py-10">
        <HomeMarketingHero
          promo={
            <Suspense fallback={null}>
              <SpecialFeaturePromoBanner />
            </Suspense>
          }
        />
        <RetailerToShippingSteps />
        <Suspense fallback={null}>
          <HomeHubStockSection isSignedIn={isSignedIn} />
        </Suspense>
        <div className="flex flex-col gap-6">
          <Suspense fallback={null}>
            <HomeStarterBundlesMarquee />
          </Suspense>
          <Suspense fallback={<HomeSpotlightCarouselFallback />}>
            <HomeSpotlightSection isSignedIn={isSignedIn} />
          </Suspense>
        </div>
      </main>
      <Suspense fallback={null}>
        <SiteContactFooter />
      </Suspense>
    </div>
  );
}
