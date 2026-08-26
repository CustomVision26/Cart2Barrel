import "server-only";

import type { HubStockProduct } from "@/db/schema";
import {
  isHubShipFromComplete,
  loadHubShipFromSettings,
} from "@/data/hub-ship-from";
import {
  combineHubStockParcels,
  hubStockParcelFromProduct,
} from "@/lib/hub-stock-parcel";
import { quoteShippoUsdRate, type ShippoQuotedRate } from "@/lib/shippo";

export { combineHubStockParcels, hubStockParcelFromProduct } from "@/lib/hub-stock-parcel";

export async function quoteHubStockUsBundleShipping(input: {
  products: {
    product: Pick<
      HubStockProduct,
      "parcelWeightOz" | "parcelLengthIn" | "parcelWidthIn" | "parcelHeightIn"
    >;
    quantity: number;
    name?: string;
  }[];
  to: {
    name?: string | null;
    phone?: string | null;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
  };
}): Promise<
  { ok: true; rate: ShippoQuotedRate } | { ok: false; message: string }
> {
  const parcels: {
    parcel: { weightOz: number; lengthIn: number; widthIn: number; heightIn: number };
    quantity: number;
  }[] = [];
  for (const row of input.products) {
    const parcel = hubStockParcelFromProduct(row.product);
    if (!parcel) {
      return {
        ok: false,
        message:
          row.name ?
            `${row.name} is missing package weight and size. Staff must add them before US shipping.`
          : "This product is missing package weight and size. Staff must add them before US shipping.",
      };
    }
    parcels.push({ parcel, quantity: row.quantity });
  }
  const combined = combineHubStockParcels(parcels);
  if (!combined) {
    return {
      ok: false,
      message: "Package weight and size are required for US shipping rates.",
    };
  }
  const from = await loadHubShipFromSettings();
  if (!isHubShipFromComplete(from)) {
    return {
      ok: false,
      message:
        "The hub ship-from address is incomplete. Staff must save a US warehouse address on In-hub products.",
    };
  }

  return quoteShippoUsdRate({
    from: {
      name: from.name,
      phone: from.phone,
      street1: from.line1,
      street2: from.line2,
      city: from.city,
      state: from.state,
      zip: from.postalCode,
      country: "US",
    },
    to: {
      name: input.to.name,
      phone: input.to.phone,
      street1: input.to.line1,
      street2: input.to.line2,
      city: input.to.city,
      state: input.to.state,
      zip: input.to.postalCode,
      country: "US",
    },
    parcel: combined,
  });
}

export async function quoteHubStockUsShipping(input: {
  product: Pick<
    HubStockProduct,
    "parcelWeightOz" | "parcelLengthIn" | "parcelWidthIn" | "parcelHeightIn"
  >;
  quantity: number;
  to: {
    name?: string | null;
    phone?: string | null;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
  };
}): Promise<
  { ok: true; rate: ShippoQuotedRate } | { ok: false; message: string }
> {
  return quoteHubStockUsBundleShipping({
    products: [{ product: input.product, quantity: input.quantity }],
    to: input.to,
  });
}
