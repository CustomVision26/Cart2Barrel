import { BrandLogoLink } from "@/components/brand/brand-logo-link";
import { HomeStorefront } from "@/components/marketing/home-storefront";
import { listActiveSpotlightProductsByCategory } from "@/data/spotlight-category-products";

/** Static marketing shell shown behind sign-in / sign-up (non-interactive). */
export async function AuthMarketingBackdrop() {
  let productsByCategory = {};
  try {
    productsByCategory = await listActiveSpotlightProductsByCategory();
  } catch {
    productsByCategory = {};
  }

  return (
    <div
      className="flex min-h-full flex-1 flex-col bg-background"
      aria-hidden
      inert
    >
      <header className="border-b border-border/80 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <BrandLogoLink
            className="pointer-events-none"
            showWordmark={false}
          />
        </div>
      </header>
      <HomeStorefront isSignedIn={false} productsByCategory={productsByCategory} />
    </div>
  );
}
