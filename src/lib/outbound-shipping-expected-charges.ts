import {
  isJamaicaShippingCountry,
  isUnitedStatesShippingCountry,
} from "@/lib/shipping-countries";

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

/**
 * Official destination-customs import/clearance pages keyed by country display name.
 * Only include government (or customs-agency) pages that are publicly available.
 */
const CUSTOMS_CLEARANCE_POLICY_BY_COUNTRY: Record<string, string> = {
  Jamaica: "https://jca.gov.jm/business/imports/import-clearance-commercial/",
  "United States": "https://www.cbp.gov/trade/basic-import-export",
  Canada: "https://www.cbsa-asfc.gc.ca/import/menu-eng.html",
  "United Kingdom": "https://www.gov.uk/import-goods-into-uk",
  "Trinidad and Tobago":
    "https://www.finance.gov.tt/services/customs-and-excise/importing-and-exporting/",
  Barbados: "https://www.customs.gov.bb/",
  Bahamas: "https://www.bahamas.gov.bs/customs",
  "Antigua and Barbuda": "https://ab.gov.ag/customs/",
  "Cayman Islands": "https://www.customs.gov.ky/",
  Guyana: "https://www.gra.gov.gy/customs/",
  Haiti: "https://www.agd.gouv.ht/",
  Australia: "https://www.abf.gov.au/importing-exporting-and-manufacturing/importing",
  "New Zealand": "https://www.customs.govt.nz/business/import/",
  Ireland: "https://www.revenue.ie/en/customs/index.aspx",
  France: "https://www.douane.gouv.fr/fiche/importing-goods-france",
  Germany: "https://www.zoll.de/EN/Businesses/Movement-of-goods/Import/import_node.html",
  India: "https://www.cbic.gov.in/htdocs-cbec/customs",
  Nigeria: "https://customs.gov.ng/",
  "South Africa": "https://www.sars.gov.za/customs-and-excise/",
  Ghana: "https://www.gra.gov.gh/customs/",
  Kenya: "https://www.kra.go.ke/individual/importing/learn-about-importing/importing-process",
  Philippines: "https://customs.gov.ph/",
  Singapore: "https://www.customs.gov.sg/businesses/importing-goods/overview/",
};

function normalizeCountryKey(country: string): string {
  return country.trim().toLowerCase().replace(/\s+/g, " ");
}

const POLICY_BY_NORMALIZED = new Map(
  Object.entries(CUSTOMS_CLEARANCE_POLICY_BY_COUNTRY).map(([name, url]) => [
    normalizeCountryKey(name),
    url,
  ]),
);

export function customsClearancePolicyUrl(
  country: string | null | undefined,
): string | null {
  const trimmed = country?.trim();
  if (!trimmed) return null;
  const direct = POLICY_BY_NORMALIZED.get(normalizeCountryKey(trimmed));
  if (direct) return direct;
  if (isJamaicaShippingCountry(trimmed)) {
    return CUSTOMS_CLEARANCE_POLICY_BY_COUNTRY.Jamaica ?? null;
  }
  if (isUnitedStatesShippingCountry(trimmed)) {
    return CUSTOMS_CLEARANCE_POLICY_BY_COUNTRY["United States"] ?? null;
  }
  return null;
}

export function customsClearancePolicyLabel(
  country: string | null | undefined,
): string {
  const trimmed = country?.trim();
  return trimmed
    ? `${trimmed} customs clearance policy`
    : "Destination customs clearance policy";
}
