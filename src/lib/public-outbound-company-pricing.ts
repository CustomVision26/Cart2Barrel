import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS,
  outboundChargeBundleLabel,
  type BarrelOutboundShippingChargeKind,
  type OutboundShippingCompanyRateTableKind,
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
  customerNote: string | null;
  rateTables: {
    tableKind: OutboundShippingCompanyRateTableKind;
    rows: {
      rowLabel: string;
      destination: string | null;
      costOneCents: number;
      costTwoPlusCents: number;
    }[];
  }[];
  pickupRates: {
    rowLabel: string;
    costOneCents: number;
    costTwoPlusCents: number;
  }[];
};

export function publicCompanyServiceLabel(
  kinds: readonly BarrelOutboundShippingChargeKind[],
): string {
  const ordered = (["freight", "broker", "courier"] as const).filter((kind) =>
    kinds.includes(kind),
  );
  if (ordered.length >= 2) {
    return outboundChargeBundleLabel(ordered);
  }
  const kind = ordered[0];
  if (kind === "courier") return "Standalone local courier";
  if (kind === "broker") return "Standalone broker";
  return BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS.freight;
}

/** Freight companies sit under In-US; broker and courier under Overseas. Freight+broker bundles stay In-US only on How it works. */
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
