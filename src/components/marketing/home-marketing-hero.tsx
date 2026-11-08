import type { ReactNode } from "react";

import { HomeHeroSlideshow } from "@/components/marketing/home-hero-slideshow";

/** Full-bleed still-life hero with quote and browse CTAs. */
export function HomeMarketingHero({
  promo,
}: {
  promo?: ReactNode;
}) {
  return (
    <section className="space-y-6">
      {promo}
      <HomeHeroSlideshow />
    </section>
  );
}
