import type {
  BudgetBarrelCategory,
  BudgetBarrelRetailerKey,
} from "@/lib/budget-barrel/constants";

export type BudgetBarrelCategoryAttributes = {
  size: string | null;
  color: string | null;
  packSize: string | null;
  brand: string | null;
};

export type BudgetBarrelPreferences = {
  clothingSize: string | null;
  color: string | null;
  packSize: string | null;
  preferredBrands: string | null;
  quantity: number;
  mustHaveItems: string | null;
  attributes?: Partial<Record<BudgetBarrelCategory, BudgetBarrelCategoryAttributes>>;
};

export type BudgetBarrelRequest = {
  budgetCents: number;
  categories: BudgetBarrelCategory[];
  retailers: BudgetBarrelRetailerKey[];
  preferences: BudgetBarrelPreferences;
  instructions: string | null;
};

export type PlannedQuery = {
  id: string;
  text: string;
  category: BudgetBarrelCategory;
  mustHave: boolean;
  label: string;
  size: string | null;
  color: string | null;
  packSize: string | null;
  brand: string | null;
};

export type BudgetBarrelOffer = {
  id: string;
  productName: string;
  retailerKey: BudgetBarrelRetailerKey;
  retailer: string;
  /** Marketplace seller when it is distinct from the retailer. */
  sellerName: string | null;
  productUrl: string;
  imageUrl: string | null;
  packSize: string | null;
  size: string | null;
  color: string | null;
  /** Null when the listing has no usable USD price. Never treat this as zero. */
  priceCents: number | null;
  currency: "USD" | null;
  /** `in_stock`, `out_of_stock`, or null when the provider did not say. */
  availability: "in_stock" | "out_of_stock" | null;
  retrievedAt: string;
  deliveryCents: number | null;
  category: BudgetBarrelCategory;
  queryId: string;
  queryLabel: string;
  requiredSize: string | null;
  requiredColor: string | null;
  requiredPack: string | null;
  preferredBrand: string | null;
  variantVerified: boolean;
  needsStaffReview: boolean;
  reviewReason: string | null;
  retailerProductId: string | null;
};

export type BudgetBarrelLineSelection = {
  offerId: string;
  quantity: number;
};

export type BudgetBarrelListPlan = {
  kind: "one_store" | "multi_store";
  retailerKeys: BudgetBarrelRetailerKey[];
  lines: BudgetBarrelLineSelection[];
  merchandiseSubtotalCents: number;
  deliveryCents: number | null;
  deliveryIncomplete: boolean;
  unsatisfied: string[];
  partial: boolean;
};

export type BudgetBarrelBuilderSnapshot = {
  merchandiseBudgetCents: number;
  categories: BudgetBarrelCategory[];
  retailers: BudgetBarrelRetailerKey[];
  preferences: BudgetBarrelPreferences;
  instructions: string | null;
  listKind: "one_store" | "multi_store";
  priceCheckedAt: string;
  unsatisfied: string[];
  merchandiseSubtotalCents: number;
  deliveryIncomplete: boolean;
  deliveryCents: number | null;
};

export type BudgetBarrelClientView = {
  draftId: string;
  budgetCents: number;
  priceCheckedAt: string;
  offers: BudgetBarrelOffer[];
  oneStore: BudgetBarrelListPlan | null;
  multiStore: BudgetBarrelListPlan | null;
  unsatisfied: string[];
  providerNotes: string[];
};

export type PricedBudgetLine = {
  offer: BudgetBarrelOffer;
  quantity: number;
  lineTotalCents: number | null;
};

export type PricedBudgetSelection = {
  lines: PricedBudgetLine[];
  merchandiseSubtotalCents: number;
  remainingCents: number;
  overBudgetCents: number;
  missingPriceCount: number;
  deliveryCents: number | null;
  deliveryIncomplete: boolean;
};
