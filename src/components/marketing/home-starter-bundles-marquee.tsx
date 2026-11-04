import { HomeStarterBundlesMarqueeClient } from "@/components/marketing/home-starter-bundles-marquee-client";
import { isStarterBundleMarqueePublished } from "@/data/starter-bundle-marquee-settings";
import { listPublishedStarterBundles } from "@/data/starter-bundles";
import { formatUsd } from "@/lib/admin-markup";

export async function HomeStarterBundlesMarquee() {
  let bundles: Awaited<ReturnType<typeof listPublishedStarterBundles>> = [];
  let marqueePublished = false;
  try {
    [bundles, marqueePublished] = await Promise.all([
      listPublishedStarterBundles(),
      isStarterBundleMarqueePublished(),
    ]);
  } catch {
    bundles = [];
    marqueePublished = false;
  }
  if (!marqueePublished || bundles.length === 0) return null;

  return (
    <HomeStarterBundlesMarqueeClient
      bundles={bundles.map((bundle) => ({
        id: bundle.id,
        name: bundle.name,
        priceLabel: formatUsd(bundle.merchandiseSubtotalCents),
      }))}
    />
  );
}
