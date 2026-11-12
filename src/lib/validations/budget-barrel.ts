import { z } from "zod";

import {
  BUDGET_BARREL_CATEGORIES,
  BUDGET_BARREL_LIST_SIZE,
  BUDGET_BARREL_MAX_BUDGET_CENTS,
  BUDGET_BARREL_MAX_LINES,
  BUDGET_BARREL_MIN_BUDGET_CENTS,
  BUDGET_BARREL_RETAILERS,
  type BudgetBarrelRetailerKey,
} from "@/lib/budget-barrel/constants";
import { dollarsInputToCents } from "@/lib/budget-barrel/money";

const optionalTrimmed = (max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, z.string().max(max).optional());

const attributeSchema = z.object({
  size: optionalTrimmed(80),
  color: optionalTrimmed(80),
  packSize: optionalTrimmed(80),
  brand: optionalTrimmed(200),
});

export const budgetBarrelPreferencesSchema = z.object({
  clothingSize: optionalTrimmed(80),
  color: optionalTrimmed(80),
  packSize: optionalTrimmed(80),
  preferredBrands: optionalTrimmed(200),
  quantity: z.number().int().min(1).max(20).optional(),
  mustHaveItems: optionalTrimmed(1000),
  attributes: z.partialRecord(z.enum(BUDGET_BARREL_CATEGORIES), attributeSchema).optional(),
});

const retailerKeys = BUDGET_BARREL_RETAILERS.map((retailer) => retailer.key) as [
  BudgetBarrelRetailerKey,
  ...BudgetBarrelRetailerKey[],
];

export const buildBudgetBarrelSchema = z.object({
  budgetDollars: z.string().trim().min(1).max(12),
  categories: z.array(z.enum(BUDGET_BARREL_CATEGORIES)).min(1).max(BUDGET_BARREL_CATEGORIES.length),
  retailers: z.array(z.enum(retailerKeys)).min(1).max(BUDGET_BARREL_RETAILERS.length),
  preferences: budgetBarrelPreferencesSchema,
  instructions: optionalTrimmed(2000),
  previousDraftId: z.string().uuid().optional(),
  heldLines: z
    .array(
      z.object({
        offerId: z.string().uuid(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .max(BUDGET_BARREL_LIST_SIZE)
    .optional(),
});

export const submitBudgetBarrelLineSchema = z.object({
  offerId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
  productName: z.string().trim().min(1).max(300),
  size: z.string().trim().max(80),
  color: z.string().trim().max(80),
  priceCents: z.number().int().min(1).max(BUDGET_BARREL_MAX_BUDGET_CENTS),
});

export const submitBudgetBarrelSchema = z.object({
  draftId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  budgetDollars: z.string().trim().min(1).max(12),
  listKind: z.enum(["one_store", "multi_store"]),
  lines: z.array(submitBudgetBarrelLineSchema).min(1).max(BUDGET_BARREL_MAX_LINES),
});

export type BuildBudgetBarrelInput = z.infer<typeof buildBudgetBarrelSchema>;
export type SubmitBudgetBarrelInput = z.infer<typeof submitBudgetBarrelSchema>;

export function budgetCentsFromInput(budgetDollars: string): number | null {
  const cents = dollarsInputToCents(budgetDollars);
  if (cents == null) return null;
  if (cents < BUDGET_BARREL_MIN_BUDGET_CENTS || cents > BUDGET_BARREL_MAX_BUDGET_CENTS) {
    return null;
  }
  return cents;
}
