import { Suspense } from "react";

import { HomeMarketingHero } from "@/components/marketing/home-marketing-hero";
import { HomePageHeader } from "@/components/marketing/home-page-header";
import { HomeHubStockSection } from "@/components/marketing/home-hub-stock-section";
import { HomeSpotlightCarouselFallback } from "@/components/marketing/home-spotlight-carousel-fallback";
import { HomeSpotlightSection } from "@/components/marketing/home-spotlight-section";
import { SpecialFeaturePromoBanner } from "@/components/marketing/special-feature-promo-banner";

type Props = {
  userId: string | null;
};

/** Shared Home storefront (header, hero, in-hub, spotlight). */
export function HomePageContent({ userId }: Props) {
  const isSignedIn = Boolean(userId);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <HomePageHeader userId={userId} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-10 md:py-14">
        <HomeMarketingHero
          promo={
            <Suspense fallback={null}>
              <SpecialFeaturePromoBanner />
            </Suspense>
          }
        />
        <Suspense fallback={null}>
          <HomeHubStockSection isSignedIn={isSignedIn} />
        </Suspense>
        <Suspense fallback={<HomeSpotlightCarouselFallback />}>
          <HomeSpotlightSection isSignedIn={isSignedIn} />
        </Suspense>
      </main>
    </div>
  );
}
