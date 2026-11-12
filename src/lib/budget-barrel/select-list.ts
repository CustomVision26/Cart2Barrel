import {
  BUDGET_BARREL_LIST_SIZE,
  type BudgetBarrelRetailerKey,
} from "@/lib/budget-barrel/constants";
import {
  judgeClothingSize,
  judgeColor,
  judgePackSize,
  type SizeJudgment,
} from "@/lib/budget-barrel/constraints";
import { lineMerchandiseCents } from "@/lib/budget-barrel/money";
import { offerSearchText } from "@/lib/budget-barrel/normalize";
import type {
  BudgetBarrelLineSelection,
  BudgetBarrelListPlan,
  BudgetBarrelOffer,
  PricedBudgetSelection,
  PlannedQuery,
} from "@/lib/budget-barrel/types";

function brandRank(offer: BudgetBarrelOffer): number {
  const brand = offer.preferredBrand?.trim();
  if (!brand) return 0;
  return offer.productName.toLowerCase().includes(brand.toLowerCase()) ? 0 : 1;
}

function constraintJudgment(offer: BudgetBarrelOffer): {
  size: SizeJudgment;
  pack: SizeJudgment;
  color: SizeJudgment;
} {
  const text = offerSearchText(offer);
  return {
    size:
      offer.category === "clothing" && offer.requiredSize
        ? judgeClothingSize(text, offer.requiredSize)
        : "match",
    pack: offer.requiredPack ? judgePackSize(text, offer.requiredPack) : "match",
    color:
      offer.category === "clothing" && offer.requiredColor
        ? judgeColor(text, offer.requiredColor)
        : "match",
  };
}

export function offerCanFillRequirement(offer: BudgetBarrelOffer): boolean {
  if (offer.availability === "out_of_stock") return false;
  if (lineMerchandiseCents(offer.priceCents, offer.currency, 1) == null) return false;
  if (!/^https:\/\//i.test(offer.productUrl)) return false;
  const judgment = constraintJudgment(offer);
  if (offer.requiredSize && judgment.size === "conflict") return false;
  if (offer.requiredPack && judgment.pack === "conflict") return false;
  if (offer.requiredColor && judgment.color === "conflict") return false;
  return true;
}

function explainMiss(
  query: PlannedQuery,
  offers: BudgetBarrelOffer[],
  remainingCents: number,
  quantity: number,
): string {
  const related = offers.filter((offer) => offer.queryId === query.id);
  const label = query.label;
  if (related.length === 0) return `${label}: no matching product was found.`;

  const eligible = related.filter((offer) => offerCanFillRequirement(offer));
  if (eligible.length === 0) {
    if (query.size && related.every((offer) => constraintJudgment(offer).size === "conflict")) {
      return `${label}: no offer in size ${query.size}. A different size was not substituted.`;
    }
    if (query.size && related.every((offer) => constraintJudgment(offer).size !== "match")) {
      return `${label}: no listing confirmed size ${query.size}.`;
    }
    if (query.packSize && related.every((offer) => constraintJudgment(offer).pack === "conflict")) {
      return `${label}: no offer in pack size ${query.packSize}. A different pack size was not substituted.`;
    }
    if (related.every((offer) => offer.priceCents == null || offer.currency !== "USD")) {
      return `${label}: offers were missing a USD price, so they were not added.`;
    }
    if (related.every((offer) => offer.availability === "out_of_stock")) {
      return `${label}: matching offers were out of stock.`;
    }
    return `${label}: no usable offer was found.`;
  }

  const affordable = eligible.some((offer) => {
    const total = lineMerchandiseCents(offer.priceCents, offer.currency, quantity);
    return total != null && total <= remainingCents;
  });
  if (!affordable) return `${label}: nothing fit the remaining merchandise budget.`;
  return `${label}: no usable offer was found.`;
}

function unsatisfiedStillMissing(
  messages: string[],
  offers: BudgetBarrelOffer[],
  lines: BudgetBarrelLineSelection[],
): string[] {
  return messages.filter((message) => {
    const label = message.split(":")[0]?.trim().toLowerCase() ?? "";
    if (label.length < 3) return true;
    return !lines.some((line) => {
      const offer = offers.find((row) => row.id === line.offerId);
      if (!offer) return false;
      const hay = `${offer.queryLabel} ${offer.productName}`.toLowerCase();
      return hay.includes(label);
    });
  });
}

function pickCheapest(
  candidates: BudgetBarrelOffer[],
  remainingCents: number,
  quantity: number,
  usedUrls: Set<string>,
): BudgetBarrelOffer | null {
  const affordable = candidates.filter((offer) => {
    if (usedUrls.has(offer.productUrl.toLowerCase())) return false;
    const total = lineMerchandiseCents(offer.priceCents, offer.currency, quantity);
    return total != null && total <= remainingCents;
  });
  affordable.sort((a, b) => {
    const brand = brandRank(a) - brandRank(b);
    if (brand !== 0) return brand;
    return (a.priceCents ?? 0) - (b.priceCents ?? 0);
  });
  return affordable[0] ?? null;
}

function pickSpread(
  candidates: BudgetBarrelOffer[],
  remainingCents: number,
  quantity: number,
  usedUrls: Set<string>,
  retailerUses: Map<string, number>,
): BudgetBarrelOffer | null {
  const affordable = candidates.filter((offer) => {
    if (usedUrls.has(offer.productUrl.toLowerCase())) return false;
    const total = lineMerchandiseCents(offer.priceCents, offer.currency, quantity);
    return total != null && total <= remainingCents;
  });
  affordable.sort((a, b) => {
    const spread = (retailerUses.get(a.retailerKey) ?? 0) - (retailerUses.get(b.retailerKey) ?? 0);
    if (spread !== 0) return spread;
    const brand = brandRank(a) - brandRank(b);
    if (brand !== 0) return brand;
    return (a.priceCents ?? 0) - (b.priceCents ?? 0);
  });
  const picked = affordable[0] ?? null;
  if (picked) retailerUses.set(picked.retailerKey, (retailerUses.get(picked.retailerKey) ?? 0) + 1);
  return picked;
}

export function selectOffersWithinBudget(input: {
  offers: BudgetBarrelOffer[];
  queries: PlannedQuery[];
  budgetCents: number;
  quantity: number;
  excludeUrls?: string[];
  /** Use every selected retailer that can fill a line, instead of only the cheapest store. */
  balanceRetailers?: boolean;
}): {
  lines: BudgetBarrelLineSelection[];
  unsatisfied: string[];
  partial: boolean;
} {
  const quantity = Math.max(1, input.quantity);
  let remaining = input.budgetCents;
  const lines: BudgetBarrelLineSelection[] = [];
  const usedUrls = new Set((input.excludeUrls ?? []).map((url) => url.toLowerCase()));
  const unsatisfied: string[] = [];
  const filledQueries = new Set<string>();
  const retailerUses = new Map<string, number>();

  const take = (offer: BudgetBarrelOffer) => {
    const total = lineMerchandiseCents(offer.priceCents, offer.currency, quantity);
    if (total == null || total > remaining) return false;
    lines.push({ offerId: offer.id, quantity });
    usedUrls.add(offer.productUrl.toLowerCase());
    remaining -= total;
    filledQueries.add(offer.queryId);
    return true;
  };

  for (const query of input.queries) {
    if (lines.length >= BUDGET_BARREL_LIST_SIZE) break;
    const candidates = input.offers.filter(
      (offer) => offer.queryId === query.id && offerCanFillRequirement(offer),
    );
    const picked = input.balanceRetailers
      ? pickSpread(candidates, remaining, quantity, usedUrls, retailerUses)
      : pickCheapest(candidates, remaining, quantity, usedUrls);
    if (picked) {
      take(picked);
      continue;
    }
    if (query.mustHave) {
      unsatisfied.push(explainMiss(query, input.offers, remaining, quantity));
    }
  }

  const missingOptional = input.queries.some(
    (query) => !query.mustHave && !filledQueries.has(query.id) && !unsatisfied.some((row) => row.startsWith(query.label)),
  );

  const stillMissing = unsatisfiedStillMissing(unsatisfied, input.offers, lines);
  return {
    lines,
    unsatisfied: stillMissing,
    partial: stillMissing.length > 0 || (lines.length === 0 && input.offers.length === 0) || missingOptional,
  };
}

function deliveryForLines(
  offers: BudgetBarrelOffer[],
  lines: BudgetBarrelLineSelection[],
): { deliveryCents: number | null; deliveryIncomplete: boolean } {
  if (lines.length === 0) return { deliveryCents: null, deliveryIncomplete: true };
  let sum = 0;
  for (const line of lines) {
    const offer = offers.find((row) => row.id === line.offerId);
    if (!offer || offer.deliveryCents == null) {
      return { deliveryCents: null, deliveryIncomplete: true };
    }
    sum += offer.deliveryCents;
  }
  return { deliveryCents: sum, deliveryIncomplete: false };
}

function merchandiseOf(
  offers: BudgetBarrelOffer[],
  lines: BudgetBarrelLineSelection[],
): number {
  let sum = 0;
  for (const line of lines) {
    const offer = offers.find((row) => row.id === line.offerId);
    if (!offer) continue;
    const total = lineMerchandiseCents(offer.priceCents, offer.currency, line.quantity);
    if (total != null) sum += total;
  }
  return sum;
}

function sameLines(a: BudgetBarrelLineSelection[], b: BudgetBarrelLineSelection[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].map((line) => line.offerId).sort();
  const right = [...b].map((line) => line.offerId).sort();
  return left.every((id, index) => id === right[index]);
}

function toPlan(
  kind: BudgetBarrelListPlan["kind"],
  offers: BudgetBarrelOffer[],
  lines: BudgetBarrelLineSelection[],
  unsatisfied: string[],
  partial: boolean,
): BudgetBarrelListPlan {
  const retailerKeys = [
    ...new Set(
      lines
        .map((line) => offers.find((offer) => offer.id === line.offerId)?.retailerKey)
        .filter((key): key is BudgetBarrelRetailerKey => Boolean(key)),
    ),
  ];
  const delivery = deliveryForLines(offers, lines);
  return {
    kind,
    retailerKeys,
    lines,
    merchandiseSubtotalCents: merchandiseOf(offers, lines),
    deliveryCents: delivery.deliveryCents,
    deliveryIncomplete: delivery.deliveryIncomplete,
    unsatisfied,
    partial,
  };
}

export function buildBudgetBarrelLists(input: {
  offers: BudgetBarrelOffer[];
  queries: PlannedQuery[];
  budgetCents: number;
  quantity: number;
  retailers: BudgetBarrelRetailerKey[];
}): { oneStore: BudgetBarrelListPlan | null; multiStore: BudgetBarrelListPlan | null; unsatisfied: string[] } {
  const oneStorePlans = input.retailers
    .map((retailerKey) => {
      const pool = input.offers.filter((offer) => offer.retailerKey === retailerKey);
      const selected = selectOffersWithinBudget({
        offers: pool,
        queries: input.queries,
        budgetCents: input.budgetCents,
        quantity: input.quantity,
      });
      if (selected.lines.length === 0) return null;
      return toPlan("one_store", pool, selected.lines, selected.unsatisfied, selected.partial);
    })
    .filter((plan): plan is BudgetBarrelListPlan => plan != null);

  oneStorePlans.sort((a, b) => {
    const aMiss = a.unsatisfied.length;
    const bMiss = b.unsatisfied.length;
    if (aMiss !== bMiss) return aMiss - bMiss;
    return b.merchandiseSubtotalCents - a.merchandiseSubtotalCents;
  });
  const oneStore = oneStorePlans[0] ?? null;

  const multiSelected = selectOffersWithinBudget({
    offers: input.offers,
    queries: input.queries,
    budgetCents: input.budgetCents,
    quantity: input.quantity,
    balanceRetailers: input.retailers.length > 1,
  });
  const multi = toPlan(
    "multi_store",
    input.offers,
    multiSelected.lines,
    multiSelected.unsatisfied,
    multiSelected.partial,
  );
  const multiViable =
    multi.retailerKeys.length >= 2 &&
    multi.lines.length > 0 &&
    (oneStore == null || !sameLines(oneStore.lines, multi.lines));

  return {
    oneStore,
    multiStore: multiViable ? multi : null,
    unsatisfied: multiSelected.unsatisfied,
  };
}

export function priceSelection(
  offers: BudgetBarrelOffer[],
  lines: BudgetBarrelLineSelection[],
  budgetCents: number,
): PricedBudgetSelection {
  const priced = lines.map((line) => {
    const offer = offers.find((row) => row.id === line.offerId);
    if (!offer) {
      return null;
    }
    return {
      offer,
      quantity: line.quantity,
      lineTotalCents: lineMerchandiseCents(offer.priceCents, offer.currency, line.quantity),
    };
  }).filter((row): row is PricedBudgetSelection["lines"][number] => row != null);

  let merchandiseSubtotalCents = 0;
  let missingPriceCount = 0;
  for (const line of priced) {
    if (line.lineTotalCents == null) missingPriceCount += 1;
    else merchandiseSubtotalCents += line.lineTotalCents;
  }
  const overBudgetCents =
    merchandiseSubtotalCents > budgetCents
      ? merchandiseSubtotalCents - budgetCents
      : 0;
  const delivery = deliveryForLines(
    offers,
    priced.map((line) => ({ offerId: line.offer.id, quantity: line.quantity })),
  );

  return {
    lines: priced,
    merchandiseSubtotalCents,
    remainingCents: budgetCents - merchandiseSubtotalCents,
    overBudgetCents,
    missingPriceCount,
    deliveryCents: delivery.deliveryCents,
    deliveryIncomplete: delivery.deliveryIncomplete,
  };
}

export function applyHeldOffers(input: {
  held: { offer: BudgetBarrelOffer; quantity: number }[];
  offers: BudgetBarrelOffer[];
  lists: {
    oneStore: BudgetBarrelListPlan | null;
    multiStore: BudgetBarrelListPlan | null;
    unsatisfied: string[];
  };
}): {
  oneStore: BudgetBarrelListPlan | null;
  multiStore: BudgetBarrelListPlan | null;
  unsatisfied: string[];
} {
  if (input.held.length === 0) return input.lists;
  const heldLines = input.held.map((row) => ({
    offerId: row.offer.id,
    quantity: row.quantity,
  }));
  const heldIds = new Set(heldLines.map((line) => line.offerId));
  const heldUrls = new Set(input.held.map((row) => row.offer.productUrl.toLowerCase()));

  const merge = (existing: BudgetBarrelLineSelection[]) => {
    const rest = existing.filter((line) => {
      if (heldIds.has(line.offerId)) return false;
      const offer = input.offers.find((row) => row.id === line.offerId);
      return Boolean(offer && !heldUrls.has(offer.productUrl.toLowerCase()));
    });
    return [...heldLines, ...rest].slice(0, BUDGET_BARREL_LIST_SIZE);
  };

  const oneLines = merge(input.lists.oneStore?.lines ?? []);
  const multiLines = merge(input.lists.multiStore?.lines ?? input.lists.oneStore?.lines ?? []);
  const oneUnsatisfied = unsatisfiedStillMissing(input.lists.unsatisfied, input.offers, oneLines);
  const multiUnsatisfied = unsatisfiedStillMissing(input.lists.unsatisfied, input.offers, multiLines);
  const oneStore = toPlan(
    "one_store",
    input.offers,
    oneLines,
    oneUnsatisfied,
    oneUnsatisfied.length > 0,
  );
  const multiStore = toPlan(
    "multi_store",
    input.offers,
    multiLines,
    multiUnsatisfied,
    multiUnsatisfied.length > 0,
  );
  const multiViable =
    multiStore.retailerKeys.length >= 2 &&
    multiStore.lines.length > 0 &&
    !sameLines(oneStore.lines, multiStore.lines);

  return {
    oneStore: oneStore.lines.length > 0 ? oneStore : null,
    multiStore: multiViable ? multiStore : null,
    unsatisfied: multiUnsatisfied,
  };
}

export function selectionExceedsBudget(
  merchandiseSubtotalCents: number,
  budgetCents: number,
): boolean {
  return merchandiseSubtotalCents > budgetCents;
}
