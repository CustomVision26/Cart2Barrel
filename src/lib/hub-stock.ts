import type { ItemRequest } from "@/db/schema";
import { isUnitedStatesShippingCountry } from "@/lib/shipping-countries";
import { isUsState } from "@/lib/us-states";
import type {
  HubStockDestinationInput,
  HubStockUsAddressInput,
} from "@/lib/validations/hub-stock";

const HUB_STOCK_URL_PREFIX = "https://hub.cart2barrel.invalid/in-hub/";

export const HUB_STOCK_SITE_NAME = "In-hub stock";

/** Max images stored per in-hub catalog SKU. */
export const HUB_STOCK_PRODUCT_IMAGES_MAX = 12;

/** Max files per upload request. */
export const HUB_STOCK_PRODUCT_IMAGE_UPLOAD_BATCH_MAX = 6;

/** At this quantity or below, shopper-facing stock copy is shown in red. */
export const HUB_STOCK_LOW_QTY_THRESHOLD = 5;

export function hubStockQtyIsLow(qty: number): boolean {
  return qty <= HUB_STOCK_LOW_QTY_THRESHOLD;
}

export function hubStockProductUrl(productId: string): string {
  return `${HUB_STOCK_URL_PREFIX}${encodeURIComponent(productId.trim())}`;
}

export function isHubStockProductUrl(productUrl: string): boolean {
  return productUrl.trim().startsWith(HUB_STOCK_URL_PREFIX);
}

export function parseHubStockProductIdFromUrl(productUrl: string): string | null {
  const trimmed = productUrl.trim();
  if (!trimmed.startsWith(HUB_STOCK_URL_PREFIX)) return null;
  try {
    const rest = trimmed.slice(HUB_STOCK_URL_PREFIX.length);
    const id = decodeURIComponent(rest.split(/[?#]/)[0] ?? "").trim();
    return id || null;
  } catch {
    return null;
  }
}

export type HubStockRequestLike = Pick<ItemRequest, "source" | "productUrl">;

export function isHubStockRequest(row: HubStockRequestLike): boolean {
  if (row.source === "hub_stock") return true;
  return isHubStockProductUrl(row.productUrl);
}

export function hubStockUsShipToKey(item: {
  destination: HubStockDestinationInput;
  shipLine1: string | null;
  shipLine2: string | null;
  shipCity: string | null;
  shipState: string | null;
  shipPostalCode: string | null;
}): string | null {
  if (item.destination !== "us_address") return null;
  if (!item.shipLine1 || !item.shipCity || !item.shipState || !item.shipPostalCode) {
    return null;
  }
  return [
    item.shipLine1.trim().toLowerCase(),
    (item.shipLine2 ?? "").trim().toLowerCase(),
    item.shipCity.trim().toLowerCase(),
    item.shipState.trim().toLowerCase(),
    item.shipPostalCode.trim(),
  ].join("|");
}

export function hubStockDestinationLabel(
  destination: HubStockDestinationInput,
): string {
  switch (destination) {
    case "us_address":
      return "US address";
    case "overseas_container":
      return "Overseas packaging container";
    default: {
      const _x: never = destination;
      return _x;
    }
  }
}

const US_ZIP = /^\d{5}(?:-\d{4})?$/;

export const HUB_STOCK_US_ADDRESS_REQUIRED_MESSAGE =
  "US delivery requires a United States shipping address. Choose a US address or add one under Shipping → Address.";

export function savedAddressToHubStockUsAddress(address: {
  line1: string;
  line2?: string | null;
  cityOrTown: string | null;
  parish: string | null;
  postalCode: string | null;
  country: string;
}): HubStockUsAddressInput | null {
  if (!isUnitedStatesShippingCountry(address.country)) return null;
  const city = address.cityOrTown?.trim() ?? "";
  const state = address.parish?.trim() ?? "";
  const postalCode = address.postalCode?.trim() ?? "";
  if (
    address.line1.trim().length < 3 ||
    city.length < 2 ||
    !isUsState(state) ||
    !US_ZIP.test(postalCode)
  ) {
    return null;
  }
  return {
    line1: address.line1.trim(),
    line2: address.line2?.trim() || undefined,
    city,
    state,
    postalCode,
  };
}

export function usDeliveryAddressPrompt(
  address:
    | {
        country: string;
        line1: string;
        line2?: string | null;
        cityOrTown: string | null;
        parish: string | null;
        postalCode: string | null;
      }
    | null
    | undefined,
): string | null {
  if (!address) {
    return "Select a shipping address.";
  }
  if (!isUnitedStatesShippingCountry(address.country)) {
    return HUB_STOCK_US_ADDRESS_REQUIRED_MESSAGE;
  }
  if (!savedAddressToHubStockUsAddress(address)) {
    return "This US address needs a valid state and ZIP. Edit it under Shipping → Address.";
  }
  return null;
}

export function formatHubStockUsAddress(parts: {
  line1: string | null;
  line2?: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country?: string | null;
}): string {
  const street = [parts.line1?.trim(), parts.line2?.trim()]
    .filter(Boolean)
    .join(", ");
  const cityLine = [parts.city?.trim(), parts.state?.trim(), parts.postalCode?.trim()]
    .filter(Boolean)
    .join(" ");
  const country = parts.country?.trim() || "United States";
  return [street, cityLine, country].filter(Boolean).join(", ");
}

export function hubStockLineNote(params: {
  destination: HubStockDestinationInput;
  shipLine1: string | null;
  shipLine2: string | null;
  shipCity: string | null;
  shipState: string | null;
  shipPostalCode: string | null;
  shipCountry: string | null;
}): string {
  if (params.destination === "overseas_container") {
    return "In-hub product · pack into overseas packaging container.";
  }
  return `In-hub product · ship to US address: ${formatHubStockUsAddress({
    line1: params.shipLine1,
    line2: params.shipLine2,
    city: params.shipCity,
    state: params.shipState,
    postalCode: params.shipPostalCode,
    country: params.shipCountry,
  })}`;
}
