/** Amani-selected destination customs brokers and local couriers, keyed by country. */

export type DestinationPartner = {
  key: string;
  country: string;
  name: string;
  location: string;
  summary: string;
};

export const DESTINATION_CUSTOMS_BROKERS: DestinationPartner[] = [
  {
    key: "jm-kingston-broker",
    country: "Jamaica",
    name: "Kingston port customs broker",
    location: "Kingston / Newport West",
    summary: "Licensed broker selected for Jamaica. Clears barrels and bins at Kingston customs.",
  },
  {
    key: "jm-montego-bay-broker",
    country: "Jamaica",
    name: "Montego Bay customs broker",
    location: "Montego Bay",
    summary: "Licensed broker selected for Jamaica. Clears barrels and bins at Montego Bay customs.",
  },
  {
    key: "us-licensed-broker",
    country: "United States",
    name: "U.S. licensed customs broker",
    location: "Destination port of entry",
    summary: "Amani-selected licensed broker for U.S. customs clearance.",
  },
  {
    key: "ca-licensed-broker",
    country: "Canada",
    name: "Canada licensed customs broker",
    location: "Destination CBSA office",
    summary: "Amani-selected licensed broker for Canadian customs clearance.",
  },
  {
    key: "uk-licensed-broker",
    country: "United Kingdom",
    name: "UK customs clearance agent",
    location: "Destination UK port",
    summary: "Amani-selected agent for UK import clearance.",
  },
];

export const DESTINATION_LOCAL_COURIERS: DestinationPartner[] = [
  {
    key: "jm-knutsford-cargo",
    country: "Jamaica",
    name: "Knutsford Express Cargo",
    location: "Island-wide depots",
    summary: "Depot pickup and parish-to-parish delivery after the container is released.",
  },
  {
    key: "jm-jamaica-post",
    country: "Jamaica",
    name: "Jamaica Post",
    location: "Island-wide",
    summary: "Postal pickup and delivery after customs release.",
  },
  {
    key: "jm-dhl",
    country: "Jamaica",
    name: "DHL Express Jamaica",
    location: "Island-wide",
    summary: "Express courier collection and delivery after release.",
  },
  {
    key: "jm-ups",
    country: "Jamaica",
    name: "UPS Jamaica",
    location: "Island-wide",
    summary: "Courier collection and delivery after release.",
  },
  {
    key: "jm-bonded-truck",
    country: "Jamaica",
    name: "Local bonded trucking",
    location: "Kingston and surrounding parishes",
    summary: "Port or warehouse pickup to your destination address.",
  },
  {
    key: "us-local-courier",
    country: "United States",
    name: "Local U.S. courier",
    location: "Destination metro",
    summary: "Last-mile pickup after customs release.",
  },
  {
    key: "ca-local-courier",
    country: "Canada",
    name: "Local Canada courier",
    location: "Destination metro",
    summary: "Last-mile pickup after customs release.",
  },
  {
    key: "uk-local-courier",
    country: "United Kingdom",
    name: "Local UK courier",
    location: "Destination metro",
    summary: "Last-mile pickup after customs release.",
  },
];

export const OWN_TRANSPORT_COURIER_KEY = "own-transport";
export const PUBLISHED_BROKER_KEY = "published-broker";
export const PUBLISHED_COURIER_KEY = "published-courier";

const OWN_TRANSPORT_PARTNER: DestinationPartner = {
  key: OWN_TRANSPORT_COURIER_KEY,
  country: "*",
  name: "Customer will provide their own transportation",
  location: "Destination",
  summary:
    "You will collect the container or hire your own driver after customs release.",
};

const PUBLISHED_BROKER_PARTNER: DestinationPartner = {
  key: PUBLISHED_BROKER_KEY,
  country: "*",
  name: "Published destination broker",
  location: "Destination",
  summary: "Staff-published broker for this destination country.",
};

const PUBLISHED_COURIER_PARTNER: DestinationPartner = {
  key: PUBLISHED_COURIER_KEY,
  country: "*",
  name: "Published local courier",
  location: "Destination",
  summary: "Staff-published local courier for this destination country.",
};

function normalizeCountry(country: string | null | undefined): string {
  return country?.trim() ?? "";
}

function partnersForCountry(
  catalog: DestinationPartner[],
  country: string | null | undefined,
): DestinationPartner[] {
  const normalized = normalizeCountry(country);
  return catalog.filter(
    (p) => p.country.trim().toLowerCase() === normalized.toLowerCase(),
  );
}

export function destinationBrokersForCountry(
  country: string | null | undefined,
): DestinationPartner[] {
  return partnersForCountry(DESTINATION_CUSTOMS_BROKERS, country);
}

export function destinationCouriersForCountry(
  country: string | null | undefined,
): DestinationPartner[] {
  return partnersForCountry(DESTINATION_LOCAL_COURIERS, country);
}

export function findDestinationBroker(
  key: string | null | undefined,
  country?: string | null,
): DestinationPartner | null {
  const trimmed = key?.trim();
  if (!trimmed) return null;
  if (trimmed === PUBLISHED_BROKER_KEY) return PUBLISHED_BROKER_PARTNER;
  const list = country
    ? destinationBrokersForCountry(country)
    : DESTINATION_CUSTOMS_BROKERS;
  return list.find((p) => p.key === trimmed) ?? null;
}

export function isOwnTransportCourierKey(
  key: string | null | undefined,
): boolean {
  const trimmed = key?.trim();
  return trimmed === OWN_TRANSPORT_COURIER_KEY || trimmed === "self-arrange-local";
}

/** Staff-published courier or customer own-transport — never destination catalog couriers. */
export function isAllowedCustomerCourierKey(
  key: string | null | undefined,
): boolean {
  const trimmed = key?.trim();
  if (!trimmed) return false;
  return trimmed === PUBLISHED_COURIER_KEY || isOwnTransportCourierKey(trimmed);
}

export function findDestinationCourier(
  key: string | null | undefined,
  country?: string | null,
): DestinationPartner | null {
  const trimmed = key?.trim();
  if (!trimmed) return null;
  if (isOwnTransportCourierKey(trimmed)) {
    return OWN_TRANSPORT_PARTNER;
  }
  if (trimmed === PUBLISHED_COURIER_KEY) return PUBLISHED_COURIER_PARTNER;
  const list = country
    ? destinationCouriersForCountry(country)
    : DESTINATION_LOCAL_COURIERS;
  return list.find((p) => p.key === trimmed) ?? null;
}
