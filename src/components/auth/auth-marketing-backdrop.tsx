import { BrandLogoLink } from "@/components/brand/brand-logo-link";
import { HomeMarketingHero } from "@/components/marketing/home-marketing-hero";

/** Static marketing shell shown behind sign-in / sign-up (non-interactive, no DB reads). */
export function AuthMarketingBackdrop() {
  return (
    <div
      className="flex min-h-full flex-1 flex-col bg-background"
      aria-hidden
      inert
    >
      <header className="border-b border-border/80 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <BrandLogoLink className="pointer-events-none" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 md:py-14">
        <HomeMarketingHero />
      </main>
    </div>
  );
}
