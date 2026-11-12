/**
 * Pure checks for Budget Barrel Builder selection, budget math, and submit guards.
 * Run: npx tsx scripts/budget-barrel-checks.ts
 */
import { applyCustomerProductEdits } from "../src/lib/budget-barrel/customer-edits";
import { detectPackCount } from "../src/lib/budget-barrel/constraints";
import { fillQueriesAroundHeld, planBudgetBarrelQueries } from "../src/lib/budget-barrel/plan-queries";
import { priceSelection, buildBudgetBarrelLists, offerCanFillRequirement, applyHeldOffers } from "../src/lib/budget-barrel/select-list";
import { pickStoreLookups } from "../src/lib/budget-barrel/store-lookups";
import {
  canReadBudgetDraft,
  decideSubmitLock,
  isOfferStale,
} from "../src/lib/budget-barrel/submit-guards";
import type { BudgetBarrelOffer, BudgetBarrelRequest, PlannedQuery } from "../src/lib/budget-barrel/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function offer(partial: Partial<BudgetBarrelOffer> & Pick<BudgetBarrelOffer, "id" | "productName" | "retailerKey" | "queryId">): BudgetBarrelOffer {
  return {
    retailer: partial.retailerKey === "walmart" ? "Walmart" : "Target",
    sellerName: null,
    productUrl: partial.productUrl ?? `https://www.${partial.retailerKey}.com/ip/${partial.id}`,
    imageUrl: null,
    packSize: null,
    size: null,
    color: null,
    priceCents: 500,
    currency: "USD",
    availability: "in_stock",
    retrievedAt: new Date().toISOString(),
    deliveryCents: null,
    category: "food",
    queryLabel: partial.queryId,
    requiredSize: null,
    requiredColor: null,
    requiredPack: null,
    preferredBrand: null,
    variantVerified: true,
    needsStaffReview: false,
    reviewReason: null,
    retailerProductId: null,
    ...partial,
  };
}

const request: BudgetBarrelRequest = {
  budgetCents: 10_000,
  categories: ["food", "clothing"],
  retailers: ["walmart", "target"],
  preferences: {
    clothingSize: "Large",
    color: null,
    packSize: null,
    preferredBrands: null,
    quantity: 1,
    mustHaveItems: null,
  },
  instructions:
    "I have $100. I want pantry staples and men's size-large shirts. Prioritize food.",
};

const queries = planBudgetBarrelQueries(request);
assert(queries[0]?.category === "food", "food is planned before clothing when the shopper prioritizes food");
assert(queries.some((query) => query.category === "clothing" && query.size === "Large"), "shirt query keeps size large");
assert(queries.filter((query) => query.mustHave).length > 0, "pantry staples and shirts are must-haves");

const foodOnly = planBudgetBarrelQueries({ ...request, categories: ["food"] });
assert(foodOnly.length === 8, "a food-only search fills 8 products");
assert(foodOnly.every((query) => query.category === "food"), "a food-only search stays on food");

const namedGroceries = [
  "toothpaste",
  "flour",
  "brown rice",
  "toilet paper",
  "tuna",
  "corn beef",
  "salt",
  "cereal",
];
const groceryQueries: PlannedQuery[] = namedGroceries.map((text, index) => ({
  id: `ai${index + 1}`,
  text,
  category: "food",
  mustHave: true,
  label: text,
  size: null,
  color: null,
  packSize: null,
  brand: null,
}));
const withClothing = fillQueriesAroundHeld(
  {
    ...request,
    instructions:
      "I have 100, I would like toothpaste, flour, brown rice, toilet paper, tuna, corn beef, salt, cereal,",
  },
  groceryQueries,
  [],
  8,
);
assert(withClothing.length === 8, "named items and clothing still fit in 8 searches");
assert(
  withClothing.some((query) => query.category === "clothing"),
  "clothing is searched when that category is selected",
);

const rice = queries.find((query) => query.label === "Rice");
const pasta = queries.find((query) => query.label === "Pasta");
const beans = queries.find((query) => query.label === "Canned beans");
const shirts = queries.find((query) => query.category === "clothing");
assert(rice && pasta && beans && shirts, "expected pantry and shirt queries");

const offers: BudgetBarrelOffer[] = [
  offer({ id: "11111111-1111-4111-8111-111111111111", productName: "Rice", retailerKey: "walmart", queryId: rice.id, priceCents: 800, category: "food" }),
  offer({ id: "22222222-2222-4222-8222-222222222222", productName: "Rice", retailerKey: "target", queryId: rice.id, priceCents: 750, category: "food", productUrl: "https://www.target.com/p/rice/-/A-1" }),
  offer({ id: "33333333-3333-4333-8333-333333333333", productName: "Pasta", retailerKey: "walmart", queryId: pasta.id, priceCents: 300, category: "food" }),
  offer({ id: "44444444-4444-4444-8444-444444444444", productName: "Canned beans", retailerKey: "walmart", queryId: beans.id, priceCents: 250, category: "food" }),
  offer({
    id: "55555555-5555-4555-8555-555555555555",
    productName: "Men's medium shirt",
    retailerKey: "walmart",
    queryId: shirts.id,
    category: "clothing",
    priceCents: 1200,
    size: "Medium",
    requiredSize: "Large",
    variantVerified: false,
  }),
  offer({
    id: "66666666-6666-4666-8666-666666666666",
    productName: "Men's large shirt",
    retailerKey: "target",
    queryId: shirts.id,
    category: "clothing",
    priceCents: 1800,
    size: "Large",
    requiredSize: "Large",
    productUrl: "https://www.target.com/p/shirt/-/A-2",
  }),
  offer({
    id: "77777777-7777-4777-8777-777777777777",
    productName: "Men's large shirt",
    retailerKey: "walmart",
    queryId: shirts.id,
    category: "clothing",
    priceCents: 2200,
    size: "Large",
    requiredSize: "Large",
  }),
  offer({
    id: "88888888-8888-4888-8888-888888888888",
    productName: "Unpriced rice",
    retailerKey: "target",
    queryId: rice.id,
    priceCents: null,
    currency: null,
    productUrl: "https://www.target.com/p/rice/-/A-3",
  }),
];

const lists = buildBudgetBarrelLists({
  offers,
  queries,
  budgetCents: 10_000,
  quantity: 1,
  retailers: ["walmart", "target"],
});

assert(lists.oneStore, "one-store list is viable");
assert(lists.multiStore, "multi-store list is viable");
assert(lists.oneStore.merchandiseSubtotalCents <= 10_000, "one-store list stays inside the budget");
assert(lists.multiStore.merchandiseSubtotalCents <= 10_000, "multi-store list stays inside the budget");
assert(
  lists.multiStore.lines.every((line) => line.offerId !== "55555555-5555-4555-8555-555555555555"),
  "a medium shirt is not substituted for large",
);
assert(
  lists.multiStore.lines.every((line) => line.offerId !== "88888888-8888-4888-8888-888888888888"),
  "a missing price is not added as zero",
);

const targetOnly = buildBudgetBarrelLists({
  offers: offers.filter((row) => row.retailerKey === "target"),
  queries,
  budgetCents: 10_000,
  quantity: 1,
  retailers: ["target"],
});
assert(targetOnly.oneStore, "a list still builds when only one retailer returned offers");
assert(targetOnly.multiStore == null, "one retailer does not produce a multi-store list");

const spread = buildBudgetBarrelLists({
  offers: [
    offer({
      id: "12121212-1212-4121-8121-121212121212",
      productName: "Rice",
      retailerKey: "walmart",
      queryId: rice.id,
      priceCents: 100,
    }),
    offer({
      id: "13131313-1313-4131-8131-131313131313",
      productName: "Amazon rice",
      retailerKey: "amazon",
      queryId: rice.id,
      priceCents: 900,
      productUrl: "https://www.amazon.com/dp/B000000001",
    }),
    offer({
      id: "14141414-1414-4141-8141-141414141414",
      productName: "Pasta",
      retailerKey: "walmart",
      queryId: pasta.id,
      priceCents: 100,
    }),
    offer({
      id: "15151515-1515-4151-8151-151515151515",
      productName: "Amazon pasta",
      retailerKey: "amazon",
      queryId: pasta.id,
      priceCents: 900,
      productUrl: "https://www.amazon.com/dp/B000000002",
    }),
  ],
  queries: [rice, pasta],
  budgetCents: 10_000,
  quantity: 1,
  retailers: ["walmart", "amazon"],
});
assert(
  spread.multiStore?.retailerKeys.includes("walmart") &&
    spread.multiStore.retailerKeys.includes("amazon"),
  "the multi-store list keeps both selected retailers",
);

const edited = priceSelection(
  offers,
  [
    ...lists.multiStore.lines,
    { offerId: "77777777-7777-4777-8777-777777777777", quantity: 40 },
  ],
  10_000,
);
assert(edited.overBudgetCents > 0, "raising quantity over the budget is reported");
assert(edited.merchandiseSubtotalCents > 10_000, "the over-budget total uses the real price");

const missing = priceSelection(
  offers,
  [{ offerId: "88888888-8888-4888-8888-888888888888", quantity: 1 }],
  10_000,
);
assert(missing.missingPriceCount === 1, "missing prices stay missing");
assert(missing.merchandiseSubtotalCents === 0, "missing prices are not counted as zero");

const stale = isOfferStale(new Date(Date.now() - 60 * 60 * 1000).toISOString());
assert(stale, "an hour-old price is stale");
assert(!isOfferStale(new Date().toISOString()), "a fresh price is not stale");

const replay = decideSubmitLock({
  draft: {
    clerkUserId: "user-a",
    status: "submitted",
    idempotencyKey: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    batchQuoteSessionId: "batch-1",
  },
  actorUserId: "user-a",
  idempotencyKey: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
});
assert(replay.action === "replay" && replay.batchSessionId === "batch-1", "a retry returns the original request");

const otherCustomer = decideSubmitLock({
  draft: {
    clerkUserId: "user-a",
    status: "open",
    idempotencyKey: null,
    batchQuoteSessionId: null,
  },
  actorUserId: "user-b",
  idempotencyKey: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
});
assert(otherCustomer.action === "forbidden", "another customer cannot submit the draft");
assert(canReadBudgetDraft("user-a", "user-b") === false, "another customer cannot read the draft");
assert(canReadBudgetDraft("user-a", "user-a"), "the owner can read the draft");

assert(detectPackCount("12") === 12, "a pack size of 12 means 12 pack");
const oilQuery = queries[0];
assert(oilQuery, "a query exists for the pack-size check");
const unstatedPack = offer({
  id: "99999999-9999-4999-8999-999999999999",
  productName: "Large vegetable oil",
  retailerKey: "walmart",
  queryId: oilQuery.id,
  priceCents: 899,
  requiredPack: "12",
});
const sixPack = offer({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  productName: "Vegetable oil 6 pack",
  retailerKey: "walmart",
  queryId: oilQuery.id,
  priceCents: 499,
  requiredPack: "12",
  productUrl: "https://www.walmart.com/ip/oil-6",
});
assert(offerCanFillRequirement(unstatedPack), "a listing that does not state a pack size can still be selected");
assert(!offerCanFillRequirement(sixPack), "a different pack size is not substituted");
const packList = buildBudgetBarrelLists({
  offers: [unstatedPack, sixPack],
  queries: [{ ...oilQuery, packSize: "12", mustHave: true, label: "large vegetable oil" }],
  budgetCents: 10_000,
  quantity: 1,
  retailers: ["walmart"],
});
assert(packList.oneStore?.lines[0]?.offerId === unstatedPack.id, "the unstated pack is kept inside the budget");
assert(
  !packList.unsatisfied.some((row) => row.includes("remaining merchandise budget")),
  "an affordable item is not reported as over budget",
);

const lookups = pickStoreLookups(
  [
    ...Array.from({ length: 10 }, (_, index) => ({
      queryId: "q1",
      retailerKey: "bjs",
      token: `rice-${index}`,
    })),
    { queryId: "q2", retailerKey: "bjs", token: "flour" },
    { queryId: "q3", retailerKey: "bjs", token: "pasta" },
  ],
  new Set<string>(),
  3,
);
assert(
  new Set(lookups.map((row) => row.queryId)).size === 3,
  "retailer page lookups are shared across the shopping searches",
);

const aroundHeld = fillQueriesAroundHeld(
  request,
  queries,
  [{ productName: "Goya Canilla Long Grain Rice, 20 lbs", queryLabel: "Rice" }],
  5,
);
assert(
  !aroundHeld.some((query) => query.label === "Rice" || query.text.toLowerCase() === "rice"),
  "a held rice item is not searched again",
);
assert(aroundHeld.length === 5, "open slots search for other staples");

const heldRice = offer({
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  productName: "Goya Canilla Long Grain Rice, 20 lbs",
  retailerKey: "bjs",
  queryId: "held-rice",
  queryLabel: "Rice",
  priceCents: 1799,
  productUrl: "https://www.bjs.com/product/rice",
});
const heldList = applyHeldOffers({
  held: [{ offer: heldRice, quantity: 1 }],
  offers: [heldRice],
  lists: {
    oneStore: null,
    multiStore: null,
    unsatisfied: [
      "Rice: no matching product was found.",
      "flour: no matching product was found.",
    ],
  },
});
assert(
  !heldList.unsatisfied.some((row) => row.startsWith("Rice")),
  "rice already on the list is not reported missing",
);
assert(
  heldList.unsatisfied.some((row) => row.startsWith("flour")),
  "a staple that is not on the list is still reported missing",
);

const customerEdited = applyCustomerProductEdits(
  heldRice,
  heldRice,
  { productName: "Hormel Corned Beef", size: "12 oz", color: "brown", priceCents: 559 },
);
assert(customerEdited.productName === "Hormel Corned Beef", "a customer can rename the product");
assert(customerEdited.size === "12 oz" && customerEdited.color === "brown", "size and color edits are kept");
assert(customerEdited.priceCents === 559 && customerEdited.needsStaffReview, "a customer price is kept for staff review");
assert(
  applyCustomerProductEdits(heldRice, heldRice, {
    productName: heldRice.productName,
    size: "",
    color: "",
    priceCents: heldRice.priceCents ?? 0,
  }).needsStaffReview === false,
  "an unchanged product stays on the retailer price",
);

console.log("Budget Barrel checks passed.");
console.log(
  `One-store merchandise ${(lists.oneStore.merchandiseSubtotalCents / 100).toFixed(2)} from ${lists.oneStore.retailerKeys.join(", ")}.`,
);
console.log(
  `Multi-store merchandise ${(lists.multiStore.merchandiseSubtotalCents / 100).toFixed(2)} from ${lists.multiStore.retailerKeys.join(", ")}.`,
);
