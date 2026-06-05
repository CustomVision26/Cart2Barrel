import type { Address } from "@/db/schema";

/** Format a shipping address into tidy display lines, skipping empty parts. */
export function formatShippingDestinationLines(address: Address): string[] {
  const lines: string[] = [];

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
