import { HomeSpotlightCarousel } from "@/components/marketing/home-spotlight-carousel";
import { listPublishedSpotlightStorefront } from "@/data/spotlight-category-products";

type HomeSpotlightSectionProps = {
  isSignedIn: boolean;
};

/** Loads spotlight catalog data in a Suspense boundary so the home shell can render first. */
export async function HomeSpotlightSection({ isSignedIn }: HomeSpotlightSectionProps) {
  let productsByCategory = {};
  let publishedSlugs: Awaited<
    ReturnType<typeof listPublishedSpotlightStorefront>
  >["publishedSlugs"] = [];
  let categories: Awaited<
    ReturnType<typeof listPublishedSpotlightStorefront>
  >["categories"] = [];
  try {
    const catalog = await listPublishedSpotlightStorefront();
    productsByCategory = catalog.productsByCategory;
    publishedSlugs = catalog.publishedSlugs;
    categories = catalog.categories;
  } catch {
    productsByCategory = {};
    publishedSlugs = [];
    categories = [];
  }

  if (publishedSlugs.length === 0) return null;

  return (
    <HomeSpotlightCarousel
      isSignedIn={isSignedIn}
      categories={categories}
      productsByCategory={productsByCategory}
      publishedSlugs={publishedSlugs}
    />
  );
}
