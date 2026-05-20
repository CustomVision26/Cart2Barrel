import { isJamaicaShippingCountry } from "@/lib/shipping-countries";

/** Admin default line items (published on Dashboard → Shipping → Pricing). */
export const ADMIN_OUTBOUND_SHIPPING_CHARGE_LABELS = [
  "Freight / shipper charge (US to destination)",
  "Customs clearance charges",
  "Freight / pickup company charges (local delivery)",
] as const;

/** Pre-filled on admin charge intake when no saved note exists. */
export const DEFAULT_ADMIN_OUTBOUND_SHIPPING_CUSTOMER_NOTE =
  "Tracking info and Custom Declaration form will be available after container is handover to freight/pickup company";

/** Shown on intake forms before preferences are submitted. */
export const EXPECTED_OUTBOUND_SHIPPING_CHARGE_ITEMS = [
  {
    id: "freight",
    label: "Freight / shipper charge",
    description: "To send your container from the United States to your destination.",
  },
  {
    id: "customs",
    label: "Customs clearance charges",
    description: "Fees to clear your container through destination customs before release.",
  },
] as const;

/** Destination customs policy pages (extend as you add supported countries). */
const CUSTOMS_CLEARANCE_POLICY_BY_COUNTRY: Record<string, string> = {
  Jamaica: "https://www.jcs.customs.gov.jm/",
  "United States": "https://www.cbp.gov/travel/international-visitors/know-before-you-go",
  Canada: "https://www.cbsa-asfc.gc.ca/import/menu-eng.html",
  "United Kingdom": "https://www.gov.uk/guidance/importing-goods-into-the-uk",
};

export function customsClearancePolicyUrl(
  country: string | null | undefined,
): string | null {
  const trimmed = country?.trim();
  if (!trimmed) {
    return CUSTOMS_CLEARANCE_POLICY_BY_COUNTRY.Jamaica ?? null;
  }
  if (CUSTOMS_CLEARANCE_POLICY_BY_COUNTRY[trimmed]) {
    return CUSTOMS_CLEARANCE_POLICY_BY_COUNTRY[trimmed]!;
  }
  if (isJamaicaShippingCountry(trimmed)) {
    return CUSTOMS_CLEARANCE_POLICY_BY_COUNTRY.Jamaica ?? null;
  }
  return null;
}

export function customsClearancePolicyLabel(
  country: string | null | undefined,
): string {
  const trimmed = country?.trim();
  return trimmed ? `${trimmed} customs clearance policy` : "Destination customs clearance policy";
}
