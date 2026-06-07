import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { HomeMarketingHero } from "@/components/marketing/home-marketing-hero";
import { HomePageHeader } from "@/components/marketing/home-page-header";
import { HomeSpotlightCarouselFallback } from "@/components/marketing/home-spotlight-carousel-fallback";
import { HomeSpotlightSection } from "@/components/marketing/home-spotlight-section";
import { getProfileByClerkId, isOnboardingComplete } from "@/data/profiles";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    const profile = await getProfileByClerkId(userId);
    if (!profile || !(await isOnboardingComplete(userId, profile))) {
      redirect("/onboarding");
    }
  }

  const isSignedIn = Boolean(userId);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <HomePageHeader userId={userId} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-10 md:py-14">
        <HomeMarketingHero />
        <Suspense fallback={<HomeSpotlightCarouselFallback />}>
          <HomeSpotlightSection isSignedIn={isSignedIn} />
        </Suspense>
      </main>
    </div>
  );
}
