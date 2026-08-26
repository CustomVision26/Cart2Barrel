import type { Address } from "@/db/schema";

type AddressLike = Pick<
  Address,
  | "line1"
  | "line2"
  | "cityOrTown"
  | "parish"
  | "postalCode"
  | "country"
  | "recipientName"
  | "recipientPhone"
>;

/** Format a shipping address into tidy display lines, skipping empty parts. */
export function formatShippingDestinationLines(address: AddressLike): string[] {
  const lines: string[] = [];

  const recipient = address.recipientName?.trim();
  if (recipient) {
    lines.push(recipient);
  }
  const phone = address.recipientPhone?.trim();
  if (phone) {
    lines.push(phone);
  }

  const street = [address.line1, address.line2]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
  if (street) {
    lines.push(street);
  }

  const cityLine = [address.cityOrTown, address.parish, address.postalCode]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
  if (cityLine) {
    lines.push(cityLine);
  }

  if (address.country?.trim()) {
    lines.push(address.country.trim());
  }

  return lines;
}

export function formatShippingAddressOneLine(address: AddressLike): string {
  return formatShippingDestinationLines(address).join(" · ");
}

export function formatShippingStreetOneLine(
  address: Pick<
    AddressLike,
    "line1" | "line2" | "cityOrTown" | "parish" | "postalCode" | "country"
  >,
): string {
  const street = [address.line1, address.line2]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
  const cityLine = [address.cityOrTown, address.parish, address.postalCode]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
  return [street, cityLine, address.country?.trim()]
    .filter(Boolean)
    .join(", ");
}
