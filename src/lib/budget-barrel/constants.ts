export const BUDGET_BARREL_SOURCE_KIND = "budget_barrel" as const;

export const BUDGET_BARREL_CATEGORIES = [
  "food",
  "clothing",
  "shoes",
  "electronics",
  "household",
  "beauty",
] as const;
export type BudgetBarrelCategory = (typeof BUDGET_BARREL_CATEGORIES)[number];

export const BUDGET_BARREL_CATEGORY_LABELS: Record<BudgetBarrelCategory, string> = {
  food: "Food",
  clothing: "Clothing",
  shoes: "Shoes",
  electronics: "Electronics & tech",
  household: "Household & kitchen",
  beauty: "Beauty & wellness",
};

export const BUDGET_BARREL_RETAILERS = [
  { key: "walmart", label: "Walmart", host: "walmart.com", engine: "walmart" },
  { key: "amazon", label: "Amazon", host: "amazon.com", engine: "google_shopping" },
  { key: "target", label: "Target", host: "target.com", engine: "google_shopping" },
  { key: "costco", label: "Costco", host: "costco.com", engine: "google_shopping" },
  { key: "sams_club", label: "Sam's Club", host: "samsclub.com", engine: "google_shopping" },
  { key: "bjs", label: "BJ's", host: "bjs.com", engine: "google_shopping" },
  { key: "macys", label: "Macy's", host: "macys.com", engine: "google_shopping" },
  { key: "dollar_tree", label: "Dollar Tree", host: "dollartree.com", engine: "google_shopping" },
  { key: "dollar_general", label: "Dollar General", host: "dollargeneral.com", engine: "google_shopping" },
  { key: "best_buy", label: "Best Buy", host: "bestbuy.com", engine: "google_shopping" },
  { key: "home_depot", label: "Home Depot", host: "homedepot.com", engine: "google_shopping" },
  { key: "walgreens", label: "Walgreens", host: "walgreens.com", engine: "google_shopping" },
  { key: "kroger", label: "Kroger", host: "kroger.com", engine: "google_shopping" },
] as const;

export type BudgetBarrelRetailerKey =
  (typeof BUDGET_BARREL_RETAILERS)[number]["key"];

export const BUDGET_BARREL_MAX_QUERIES = 8;
export const BUDGET_BARREL_LIST_SIZE = 8;
export const BUDGET_BARREL_MAX_RESULTS_PER_SEARCH = 8;
export const BUDGET_BARREL_MAX_VARIANT_LOOKUPS = 2;
/** Two retailer-page lookups per search, so later items are not starved by the first. */
export const BUDGET_BARREL_MAX_STORE_LOOKUPS = 16;
export const BUDGET_BARREL_MAX_REFRESH = 8;
/** Longer than the SerpApi response cache so a refresh can observe a new price. */
export const BUDGET_BARREL_STALE_MS = 15 * 60 * 1000;
export const BUDGET_BARREL_MIN_BUDGET_CENTS = 100;
export const BUDGET_BARREL_MAX_BUDGET_CENTS = 2_000_000;
export const BUDGET_BARREL_MAX_LINES = 12;

export const BUDGET_BARREL_CARD_TITLE = "Build a Shopping List";
export const BUDGET_BARREL_CARD_DESCRIPTION =
  "Enter a merchandise budget, choose categories, and search US retailers. Hold items you want, rebuild the rest, then submit one estimate. Staff confirm prices and fees before you accept the quote and pay.";

export const MERCHANDISE_ONLY_LABEL = "Merchandise only";
export const TO_BE_CONFIRMED_LABEL = "To be confirmed";
export const ESTIMATED_PRICES_LABEL = "Estimated prices";

export function isBudgetBarrelCategory(
  value: string,
): value is BudgetBarrelCategory {
  return (BUDGET_BARREL_CATEGORIES as readonly string[]).includes(value);
}

export function isBudgetBarrelRetailerKey(
  value: string,
): value is BudgetBarrelRetailerKey {
  return BUDGET_BARREL_RETAILERS.some((retailer) => retailer.key === value);
}

export function budgetBarrelRetailer(key: BudgetBarrelRetailerKey) {
  const retailer = BUDGET_BARREL_RETAILERS.find((row) => row.key === key);
  if (!retailer) throw new Error(`Unknown Budget Barrel retailer: ${key}`);
  return retailer;
}

export function isBudgetBarrelSourceKind(
  value: string | null | undefined,
): boolean {
  return value === BUDGET_BARREL_SOURCE_KIND;
}
