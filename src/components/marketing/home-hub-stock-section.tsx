import { auth } from "@clerk/nextjs/server";

import { HomeHubStockProductGrid } from "@/components/marketing/home-hub-stock-product-grid";
import {
  listShippingAddressesForUser,
  toSerializableShippingAddress,
} from "@/data/addresses";
import { listActiveHubStockProductsForStorefront } from "@/data/hub-stock-products";

export async function HomeHubStockSection({ isSignedIn }: { isSignedIn: boolean }) {
  let products: Awaited<ReturnType<typeof listActiveHubStockProductsForStorefront>> = [];
  try {
    products = await listActiveHubStockProductsForStorefront();
  } catch {
    products = [];
  }

  if (products.length === 0) return null;

  let savedAddresses: ReturnType<typeof toSerializableShippingAddress>[] = [];
  if (isSignedIn) {
    const { userId } = await auth();
    if (userId) {
      savedAddresses = (await listShippingAddressesForUser(userId)).map(
        toSerializableShippingAddress,
      );
    }
  }

  return (
    <HomeHubStockProductGrid
      products={products}
      isSignedIn={isSignedIn}
      savedAddresses={savedAddresses}
    />
  );
}
