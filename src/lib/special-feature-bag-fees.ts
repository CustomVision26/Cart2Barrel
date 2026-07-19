import { formatUsd } from "@/lib/admin-markup";

/** Max in-app special suitcases per user (courier 2nd + 3rd bag capacity). */
export const SPECIAL_FEATURE_SUITCASE_MAX_QUANTITY = 2;

/** Remaining qty this offering may hold given cart totals across all special suitcases. */
export function maxSpecialSuitcaseQtyForOffering(
  specialSuitcaseCartTotal: number,
  currentOfferingCartQty: number,
): number {
  const otherQty = Math.max(0, specialSuitcaseCartTotal - currentOfferingCartQty);
  return Math.max(0, SPECIAL_FEATURE_SUITCASE_MAX_QUANTITY - otherQty);
}

/** True when courier capacity is full and this offering is not already in the cart. */
export function isSpecialSuitcaseOfferingUnavailable(
  specialSuitcaseCartTotal: number,
  currentOfferingCartQty: number,
): boolean {
  return (
    specialSuitcaseCartTotal >= SPECIAL_FEATURE_SUITCASE_MAX_QUANTITY &&
    currentOfferingCartQty <= 0
  );
}

export function clampSpecialSuitcaseQty(next: number, maxQty: number): number {
  const cap = Math.max(1, maxQty);
  return Math.max(1, Math.min(cap, next));
}

export type SpecialFeatureBagFees = {
  airlineSecondBagUsdCents: number;
  airlineThirdBagUsdCents: number;
  airlineFourthBagUsdCents: number;
};

export type SpecialSuitcaseBaggageAllocationLine = {
  offeringId: string;
  quantity: number;
  /** Cart line first-add time (`user_container_cart_lines.updatedAt`, kept stable on qty edits). */
  addedAt: string;
  airlineSecondBagUsdCents: number;
  airlineThirdBagUsdCents: number;
};

export type SpecialSuitcaseBaggageAllocation = {
  feeCents: number;
  detail: string;
};

/**
 * Assign 2nd / 3rd checked-bag fees across special suitcase cart lines in add order.
 * First unit added → 2nd bag; next unit → 3rd bag (may span two container SKUs).
 */
export function allocateSpecialFeatureAirlineBaggageFees(
  lines: SpecialSuitcaseBaggageAllocationLine[],
): Map<string, SpecialSuitcaseBaggageAllocation> {
  const sorted = [...lines]
    .filter((line) => line.quantity > 0)
    .sort(
      (a, b) =>
        a.addedAt.localeCompare(b.addedAt) ||
        a.offeringId.localeCompare(b.offeringId),
    );

  const result = new Map<string, SpecialSuitcaseBaggageAllocation>();
  let nextSlot: 2 | 3 | null = 2;

  for (const line of sorted) {
    const parts: string[] = [];
    let feeCents = 0;

    for (let unit = 0; unit < line.quantity && nextSlot !== null; unit++) {
      const cents =
        nextSlot === 2 ?
          Math.max(0, line.airlineSecondBagUsdCents)
        : Math.max(0, line.airlineThirdBagUsdCents);
      feeCents += cents;
      if (cents > 0) {
        parts.push(`${nextSlot === 2 ? "2nd" : "3rd"} bag · ${formatUsd(cents)}`);
      }
      nextSlot = nextSlot === 2 ? 3 : null;
    }

    result.set(line.offeringId, {
      feeCents,
      detail: parts.length > 0 ? parts.join(" · ") : "Travel day checked bags",
    });
  }

  return result;
}

/**
 * Airline checked-bag surcharges for a single line in isolation (preview before add).
 * When other special suitcases are already in cart, use {@link allocateSpecialFeatureAirlineBaggageFees}.
 */
export function computeSpecialFeatureAirlineBaggageFeeCents(
  quantity: number,
  fees: Pick<
    SpecialFeatureBagFees,
    "airlineSecondBagUsdCents" | "airlineThirdBagUsdCents"
  >,
): number {
  const q = Math.min(
    Math.max(0, Math.floor(quantity)),
    SPECIAL_FEATURE_SUITCASE_MAX_QUANTITY,
  );
  if (q <= 0) return 0;
  if (q === 1) return Math.max(0, fees.airlineSecondBagUsdCents);
  return (
    Math.max(0, fees.airlineSecondBagUsdCents) +
    Math.max(0, fees.airlineThirdBagUsdCents)
  );
}

/** Detail string for cart breakdown rows. */
export function formatSpecialFeatureAirlineBaggageFeeDetail(
  quantity: number,
  fees: Pick<
    SpecialFeatureBagFees,
    "airlineSecondBagUsdCents" | "airlineThirdBagUsdCents"
  >,
): string {
  const q = Math.min(
    Math.max(0, Math.floor(quantity)),
    SPECIAL_FEATURE_SUITCASE_MAX_QUANTITY,
  );
  if (q === 1 && fees.airlineSecondBagUsdCents > 0) {
    return `2nd bag · ${formatUsd(fees.airlineSecondBagUsdCents)}`;
  }
  if (q >= 2) {
    const parts: string[] = [];
    if (fees.airlineSecondBagUsdCents > 0) {
      parts.push(`2nd ${formatUsd(fees.airlineSecondBagUsdCents)}`);
    }
    if (fees.airlineThirdBagUsdCents > 0) {
      parts.push(`3rd ${formatUsd(fees.airlineThirdBagUsdCents)}`);
    }
    if (parts.length > 0) return parts.join(" · ");
  }
  return "Travel day checked bags";
}

/** Short shopper-facing summary of outside airline 2nd+ bag fees. */
export function formatSpecialFeatureOutsideBagFees(
  fees: SpecialFeatureBagFees,
): string | null {
  const parts: string[] = [];
  if (fees.airlineSecondBagUsdCents > 0) {
    parts.push(`2nd ${formatUsd(fees.airlineSecondBagUsdCents)}`);
  }
  if (fees.airlineThirdBagUsdCents > 0) {
    parts.push(`3rd ${formatUsd(fees.airlineThirdBagUsdCents)}`);
  }
  if (fees.airlineFourthBagUsdCents > 0) {
    parts.push(`4th ${formatUsd(fees.airlineFourthBagUsdCents)}`);
  }
  if (parts.length === 0) return null;
  return `Airline bag fees (travel day): ${parts.join(" · ")}`;
}
