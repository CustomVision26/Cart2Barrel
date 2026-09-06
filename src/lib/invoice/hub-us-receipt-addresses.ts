import type { Address, HubStockOrderItem } from "@/db/schema";
import { hubStockUsShipToKey } from "@/lib/hub-stock";
import type { InvoiceCompanyProfile } from "@/lib/invoice/company-profile";
import type { PaymentInvoiceBillTo } from "@/lib/invoice/payment-invoice-types";

/** Merchant name on in-hub US warehouse receipts (distinct from the Amani Cart2Barrel brand). */
export const HUB_INVOICE_COMPANY_NAME = "Amani Cart2Barrel";

type HubShipFromLike = {
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

function zipDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function matchSavedAddressToHubUsShipTo(
  addresses: Address[],
  snap: Pick<HubStockOrderItem, "shipLine1" | "shipPostalCode">,
): Address | undefined {
  const street = snap.shipLine1?.trim().toLowerCase() ?? "";
  const zip = zipDigits(snap.shipPostalCode);
  if (!street || !zip) return undefined;
  return addresses.find((row) => {
    const sameStreet = row.line1.trim().toLowerCase() === street;
    const sameZip = zipDigits(row.postalCode) === zip;
    return sameStreet && sameZip;
  });
}

export function pickHubUsShipToSnapshot(
  rows: HubStockOrderItem[],
): HubStockOrderItem | null {
  const usRows = rows.filter((row) => row.destination === "us_address");
  if (usRows.length === 0) return null;
  const seen = new Set<string>();
  for (const row of usRows) {
    const key = hubStockUsShipToKey({
      destination: "us_address",
      shipLine1: row.shipLine1,
      shipLine2: row.shipLine2,
      shipCity: row.shipCity,
      shipState: row.shipState,
      shipPostalCode: row.shipPostalCode,
    });
    if (key && !seen.has(key)) {
      seen.add(key);
      return row;
    }
  }
  return usRows[0] ?? null;
}

export function invoiceCompanyFromHubShipFrom(
  hub: HubShipFromLike,
  fallback: InvoiceCompanyProfile,
): InvoiceCompanyProfile {
  const cityLine = [hub.city.trim(), hub.state.trim(), hub.postalCode.trim()]
    .filter(Boolean)
    .join(" ");
  const addressLines = [
    hub.line1.trim() || null,
    hub.line2.trim() || null,
    cityLine || null,
    hub.country.trim() || "United States",
  ].filter((line): line is string => Boolean(line));

  return {
    name: HUB_INVOICE_COMPANY_NAME,
    addressLines: addressLines.length > 0 ? addressLines : fallback.addressLines,
    phone: hub.phone.trim() || fallback.phone,
    email: fallback.email,
  };
}

export function billToFromHubUsShipTo(input: {
  snap: HubStockOrderItem;
  matchedAddress?: Address;
  fallbackName: string;
  email: string | null;
}): PaymentInvoiceBillTo {
  const { snap, matchedAddress, fallbackName, email } = input;
  const lines: string[] = [];
  const name = matchedAddress?.recipientName?.trim() || fallbackName.trim();
  if (name) lines.push(name);
  if (matchedAddress?.recipientPhone?.trim()) {
    lines.push(matchedAddress.recipientPhone.trim());
  }
  if (snap.shipLine1?.trim()) lines.push(snap.shipLine1.trim());
  if (snap.shipLine2?.trim()) lines.push(snap.shipLine2.trim());
  const cityLine = [
    snap.shipCity?.trim(),
    snap.shipState?.trim(),
    snap.shipPostalCode?.trim(),
  ]
    .filter(Boolean)
    .join(" ");
  if (cityLine) lines.push(cityLine);
  lines.push(snap.shipCountry?.trim() || "United States");

  return {
    name: name || "Customer",
    addressLines: lines,
    email,
  };
}
