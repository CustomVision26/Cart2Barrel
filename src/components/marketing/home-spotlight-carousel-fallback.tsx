import { Cart2BarrelLoadingScreen } from "@/components/brand/cart2barrel-loading-screen";

/** Placeholder while spotlight catalog data loads on the home page. */
export function HomeSpotlightCarouselFallback() {
  return (
    <section aria-busy="true" aria-label="Loading featured products">
      <Cart2BarrelLoadingScreen layout="inline" className="min-h-[22rem] sm:min-h-[24rem]" />
    </section>
  );
}
