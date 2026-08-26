import { cache } from "react";

import { countApprovedCartItemsForUser } from "@/data/cart";
import { countUserOutboundShippingCartLineRows } from "@/data/barrel-outbound-shipping-charges";
import { countUserMerchandiseTopupCartLineRows } from "@/data/merchandise-topup-cart";
import { countUserContainerCartLineRows } from "@/data/user-container-cart";
import { countHubStockCartLineRows } from "@/data/hub-stock-cart";

/** Cart badge total for header — deduped per request via React cache. */
export const getUserCartHeaderCount = cache(async (clerkUserId: string): Promise<number> => {
  const [merchandise, containers, outboundShipping, merchandiseTopups, hubStock] =
    await Promise.all([
      countApprovedCartItemsForUser(clerkUserId),
      countUserContainerCartLineRows(clerkUserId),
      countUserOutboundShippingCartLineRows(clerkUserId),
      countUserMerchandiseTopupCartLineRows(clerkUserId),
      countHubStockCartLineRows(clerkUserId),
    ]);
  return merchandise + containers + outboundShipping + merchandiseTopups + hubStock;
});
