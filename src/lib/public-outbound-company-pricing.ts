import type {
  BarrelOutboundShippingChargeKind,
  OutboundShippingCompanyRateTableKind,
} from "@/lib/barrel-outbound-shipping-charge";

export type PublicOutboundCompanyPricingCard = {
  companyKey: string;
  companyName: string;
  heading: "in-us" | "overseas";
  serviceLabel: string;
  kinds: BarrelOutboundShippingChargeKind[];
  country: string | null;
  location: string | null;
  address: string | null;
  phone: string | null;
  imageUrl: string | null;
  rateTables: {
    tableKind: OutboundShippingCompanyRateTableKind;
    rows: {
      rowLabel: string;
      costOneCents: number;
      costTwoPlusCents: number;
    }[];
  }[];
};

const KIND_SHORT: Record<BarrelOutboundShippingChargeKind, string> = {
  freight: "freight",
  broker: "broker",
  courier: "local courier",
};

export function publicCompanyServiceLabel(
  kinds: readonly BarrelOutboundShippingChargeKind[],
): string {
  const ordered = (["freight", "broker", "courier"] as const).filter((kind) =>
    kinds.includes(kind),
  );
  if (ordered.length >= 2) {
    return ordered.map((kind) => KIND_SHORT[kind]).join(" + ");
  }
  const kind = ordered[0];
  if (kind === "courier") return "Standalone local courier";
  if (kind === "broker") return "Standalone broker";
  return "Standalone freight";
}

/** Freight companies sit under In-US; broker and courier under Overseas. Bundles can appear in both. */
export function publicCompanyVendorHeadings(
  kinds: readonly BarrelOutboundShippingChargeKind[],
): Array<"in-us" | "overseas"> {
  const headings: Array<"in-us" | "overseas"> = [];
  if (kinds.includes("freight")) headings.push("in-us");
  if (kinds.includes("broker") || kinds.includes("courier")) {
    headings.push("overseas");
  }
  return headings;
}
