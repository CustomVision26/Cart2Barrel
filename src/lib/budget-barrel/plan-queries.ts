import {
  BUDGET_BARREL_MAX_QUERIES,
  type BudgetBarrelCategory,
} from "@/lib/budget-barrel/constants";
import {
  clothingSizeFromInstructions,
  detectPackCount,
  packLabelFromText,
} from "@/lib/budget-barrel/constraints";
import type {
  BudgetBarrelCategoryAttributes,
  BudgetBarrelRequest,
  PlannedQuery,
} from "@/lib/budget-barrel/types";

const FOOD_STAPLES = [
  { label: "Rice", text: "rice" },
  { label: "Pasta", text: "pasta" },
  { label: "Canned beans", text: "canned beans" },
  { label: "Vegetable oil", text: "vegetable oil" },
  { label: "Flour", text: "all purpose flour" },
  { label: "Oatmeal", text: "oatmeal" },
] as const;

const EXTRA_FOOD = [
  { label: "Sugar", text: "sugar" },
  { label: "Peanut butter", text: "peanut butter" },
] as const;

const CATEGORY_FILLERS: Record<BudgetBarrelCategory, { label: string; text: string }[]> = {
  food: [...FOOD_STAPLES, ...EXTRA_FOOD],
  clothing: [
    { label: "Shirts", text: "shirts" },
    { label: "Pants", text: "pants" },
    { label: "Socks", text: "socks" },
  ],
  shoes: [
    { label: "Sneakers", text: "sneakers" },
    { label: "Sandals", text: "sandals" },
  ],
  electronics: [
    { label: "Headphones", text: "headphones" },
    { label: "Phone charger", text: "phone charger" },
  ],
  household: [
    { label: "Detergent", text: "laundry detergent" },
    { label: "Paper towels", text: "paper towels" },
    { label: "Dish soap", text: "dish soap" },
  ],
  beauty: [
    { label: "Lotion", text: "body lotion" },
    { label: "Shampoo", text: "shampoo" },
    { label: "Deodorant", text: "deodorant" },
  ],
};

function splitList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
    .slice(0, BUDGET_BARREL_MAX_QUERIES);
}

function inferCategory(
  text: string,
  selected: BudgetBarrelCategory[],
): BudgetBarrelCategory {
  if (/shoe|sneaker|boot|sandal/i.test(text) && selected.includes("shoes")) return "shoes";
  if (/phone|laptop|headphone|charger|tablet|television|\btv\b|electronic/i.test(text) && selected.includes("electronics")) {
    return "electronics";
  }
  if (/detergent|towel|kitchen|sheet|trash bag|dish soap|cookware/i.test(text) && selected.includes("household")) {
    return "household";
  }
  if (/lotion|shampoo|makeup|beauty|deodorant|sunscreen|moisturizer/i.test(text) && selected.includes("beauty")) {
    return "beauty";
  }
  if (/shirt|cloth|tee|hoodie|jacket|pant|jean|sock/i.test(text) && selected.includes("clothing")) {
    return "clothing";
  }
  if (selected.includes("food")) return "food";
  return selected[0] ?? "food";
}

function categoryAttributes(
  request: BudgetBarrelRequest,
  category: BudgetBarrelCategory,
): BudgetBarrelCategoryAttributes {
  const saved = request.preferences.attributes?.[category];
  const fallback: BudgetBarrelCategoryAttributes =
    category === "clothing"
      ? {
          size: request.preferences.clothingSize,
          color: request.preferences.color,
          packSize: null,
          brand: request.preferences.preferredBrands,
        }
      : category === "food"
        ? {
            size: null,
            color: null,
            packSize: request.preferences.packSize,
            brand: request.preferences.preferredBrands,
          }
        : { size: null, color: null, packSize: null, brand: null };
  if (!saved) return fallback;
  return {
    size: saved.size || fallback.size,
    color: saved.color || fallback.color,
    packSize: saved.packSize || fallback.packSize,
    brand: saved.brand || fallback.brand,
  };
}

function withBrand(text: string, brand: string | null): string {
  if (!brand?.trim()) return text;
  if (text.toLowerCase().includes(brand.trim().toLowerCase())) return text;
  return `${text} ${brand.trim()}`;
}

function sizeFor(
  request: BudgetBarrelRequest,
  category: BudgetBarrelCategory,
  text: string,
): string | null {
  if (category !== "clothing" && category !== "shoes") return null;
  const saved = categoryAttributes(request, category).size;
  if (saved) return saved;
  return clothingSizeFromInstructions(text) ?? clothingSizeFromInstructions(request.instructions);
}

function packFor(
  request: BudgetBarrelRequest,
  category: BudgetBarrelCategory,
  text: string,
): string | null {
  return (
    categoryAttributes(request, category).packSize ??
    packLabelFromText(text) ??
    (category === "food" && detectPackCount(request.instructions) != null
      ? packLabelFromText(request.instructions)
      : null)
  );
}

function pushQuery(
  queries: PlannedQuery[],
  draft: Omit<PlannedQuery, "id">,
  maxQueries: number,
) {
  if (queries.length >= maxQueries) return;
  const text = draft.text.trim();
  if (text.length < 2) return;
  if (queries.some((row) => row.text.toLowerCase() === text.toLowerCase())) return;
  queries.push({ ...draft, text, id: `q${queries.length + 1}` });
}

export function prioritizeFood(instructions: string | null | undefined): boolean {
  return /prioritiz\w*\s+food/i.test(instructions ?? "");
}

function queryFromItem(
  request: BudgetBarrelRequest,
  category: BudgetBarrelCategory,
  label: string,
  text: string,
  mustHave: boolean,
): Omit<PlannedQuery, "id"> {
  const attrs = categoryAttributes(request, category);
  const size = sizeFor(request, category, text);
  const described =
    size && !text.toLowerCase().includes(size.toLowerCase()) ? `${text} ${size}` : text;
  return {
    text: withBrand(described, attrs.brand),
    category,
    mustHave,
    label,
    size,
    color: attrs.color,
    packSize: packFor(request, category, text),
    brand: attrs.brand,
  };
}

/** Search queries from the form alone. AI can replace the query text, not the constraints. */
export function planBudgetBarrelQueries(
  request: BudgetBarrelRequest,
  maxQueries = BUDGET_BARREL_MAX_QUERIES,
): PlannedQuery[] {
  const queries: PlannedQuery[] = [];
  const instructions = request.instructions ?? "";
  const wantsPantry = /pantry|staple/i.test(instructions);
  const wantsShirts = /shirt/i.test(instructions);
  const foodFirst = prioritizeFood(instructions) || request.categories[0] === "food";
  const categories = foodFirst
    ? [...request.categories].sort((a, b) => (a === "food" ? -1 : b === "food" ? 1 : 0))
    : request.categories;
  const limit = Math.max(0, Math.min(maxQueries, BUDGET_BARREL_MAX_QUERIES));

  const explicit = splitList(request.preferences.mustHaveItems);
  for (const item of explicit) {
    const category = inferCategory(item, request.categories);
    if (!request.categories.includes(category)) continue;
    pushQuery(queries, queryFromItem(request, category, item, item, true), limit);
  }

  for (const category of categories) {
    const chosenType = categoryAttributes(request, category).size;
    if (
      chosenType &&
      (category === "electronics" || category === "household" || category === "beauty")
    ) {
      pushQuery(queries, queryFromItem(request, category, chosenType, chosenType, false), limit);
    }
    const fillers =
      category === "food"
        ? wantsPantry
          ? FOOD_STAPLES
          : FOOD_STAPLES.slice(0, 2)
        : CATEGORY_FILLERS[category].slice(0, 1);
    for (const filler of fillers) {
      const label =
        category === "clothing" && wantsShirts && filler.text === "shirts" ? "Men's shirts" : filler.label;
      const mustHave =
        (category === "food" && wantsPantry) ||
        (category === "clothing" && wantsShirts) ||
        explicit.some((item) => inferCategory(item, request.categories) === category);
      pushQuery(queries, queryFromItem(request, category, label, filler.text, mustHave), limit);
    }
  }

  let cursor = 0;
  while (queries.length < limit && categories.length > 0) {
    const category = categories[cursor % categories.length];
    cursor += 1;
    const filler = CATEGORY_FILLERS[category].find(
      (row) => !queries.some((query) => query.text.toLowerCase().includes(row.text)),
    );
    if (!filler) {
      if (cursor > categories.length * CATEGORY_FILLERS.food.length) break;
      continue;
    }
    pushQuery(queries, queryFromItem(request, category, filler.label, filler.text, false), limit);
  }

  return queries;
}

export function heldOfferCoversQuery(
  held: { productName: string; queryLabel: string }[],
  query: { label: string; text: string },
): boolean {
  const needles = [query.label, query.text]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length >= 3);
  if (needles.length === 0) return false;
  return held.some((row) => {
    const hay = `${row.queryLabel} ${row.productName}`.toLowerCase();
    return needles.some((needle) => hay.includes(needle));
  });
}

/** Keeps open list slots for items the shopper is not already holding. */
export function fillQueriesAroundHeld(
  request: BudgetBarrelRequest,
  candidates: PlannedQuery[],
  held: { productName: string; queryLabel: string }[],
  openSlots: number,
): PlannedQuery[] {
  const chosen: PlannedQuery[] = [];
  const push = (row: Omit<PlannedQuery, "id">) => {
    if (chosen.length >= openSlots) return;
    const text = row.text.trim().toLowerCase();
    if (!text || chosen.some((existing) => existing.text.toLowerCase() === text)) return;
    if (heldOfferCoversQuery(held, row)) return;
    chosen.push({ ...row, id: `q${chosen.length + 1}` });
  };
  for (const row of candidates) push(row);
  if (chosen.length < openSlots) {
    for (const row of planBudgetBarrelQueries(request, BUDGET_BARREL_MAX_QUERIES)) push(row);
  }
  return coverSelectedCategories(request, chosen, openSlots);
}

/** A selected category keeps a search even when the instructions already fill every slot. */
function coverSelectedCategories(
  request: BudgetBarrelRequest,
  chosen: PlannedQuery[],
  openSlots: number,
): PlannedQuery[] {
  const next = [...chosen];
  const structured = planBudgetBarrelQueries(request, BUDGET_BARREL_MAX_QUERIES);
  for (const category of request.categories) {
    if (next.some((query) => query.category === category)) continue;
    const filler = structured.find((query) => query.category === category);
    if (!filler) continue;
    const dropAt = [...next]
      .map((query, index) => ({ query, index }))
      .reverse()
      .find(({ query }) => next.filter((row) => row.category === query.category).length > 1)?.index;
    if (dropAt != null) next.splice(dropAt, 1);
    else if (next.length >= openSlots) next.pop();
    next.push({ ...filler, mustHave: true });
  }
  return next.slice(0, openSlots).map((query, index) => ({ ...query, id: `q${index + 1}` }));
}

export function queriesFromAiPlan(
  request: BudgetBarrelRequest,
  aiQueries: {
    text: string;
    category: BudgetBarrelCategory;
    mustHave?: boolean;
    label?: string;
  }[],
): PlannedQuery[] {
  const queries: PlannedQuery[] = [];
  const ordered = prioritizeFood(request.instructions)
    ? [...aiQueries].sort((a, b) => (a.category === "food" ? -1 : b.category === "food" ? 1 : 0))
    : aiQueries;

  for (const row of ordered) {
    if (!request.categories.includes(row.category)) continue;
    const attrs = categoryAttributes(request, row.category);
    const size = sizeFor(request, row.category, row.text);
    pushQuery(
      queries,
      {
        text: row.text,
        category: row.category,
        mustHave: row.mustHave === true,
        label: row.label?.trim() || row.text.trim(),
        size,
        color: attrs.color,
        packSize: packFor(request, row.category, row.text),
        brand: attrs.brand,
      },
      BUDGET_BARREL_MAX_QUERIES,
    );
  }

  if (queries.length === 0) return planBudgetBarrelQueries(request);
  const structured = planBudgetBarrelQueries(request);
  for (const row of structured) {
    if (row.mustHave && !queries.some((existing) => existing.category === row.category && existing.mustHave)) {
      pushQuery(queries, row, BUDGET_BARREL_MAX_QUERIES);
    }
  }
  return queries;
}
