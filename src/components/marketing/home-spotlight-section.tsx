import { HomeSpotlightCarousel } from "@/components/marketing/home-spotlight-carousel";
import { listActiveSpotlightProductsByCategory } from "@/data/spotlight-category-products";

type HomeSpotlightSectionProps = {
  isSignedIn: boolean;
};

/** Loads spotlight catalog data in a Suspense boundary so the home shell can render first. */
export async function HomeSpotlightSection({ isSignedIn }: HomeSpotlightSectionProps) {
  let productsByCategory = {};
  try {
    productsByCategory = await listActiveSpotlightProductsByCategory();
  } catch {
    productsByCategory = {};
  }

  return (
    <HomeSpotlightCarousel
      isSignedIn={isSignedIn}
      productsByCategory={productsByCategory}
    />
  );
}
