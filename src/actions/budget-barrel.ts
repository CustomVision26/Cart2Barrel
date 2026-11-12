"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { insertBudgetBarrelDraft, readHeldOffersForOwner, submitBudgetBarrelForOwner } from "@/data/budget-barrel";
import { planBudgetBarrelQueriesWithAi } from "@/lib/ai/plan-budget-barrel-openai";
import { BUDGET_BARREL_CATEGORIES, BUDGET_BARREL_LIST_SIZE, type BudgetBarrelCategory } from "@/lib/budget-barrel/constants";
import { budgetBarrelShoppingLocation } from "@/lib/budget-barrel/hub-location";
import { lineMerchandiseCents } from "@/lib/budget-barrel/money";
import { fillQueriesAroundHeld, planBudgetBarrelQueries } from "@/lib/budget-barrel/plan-queries";
import { searchBudgetBarrelOffers } from "@/lib/budget-barrel/search-offers";
import { applyHeldOffers, buildBudgetBarrelLists } from "@/lib/budget-barrel/select-list";
import type {
  BudgetBarrelCategoryAttributes,
  BudgetBarrelClientView,
  BudgetBarrelRequest,
} from "@/lib/budget-barrel/types";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { withSerpApiUsage } from "@/lib/serpapi/usage-context";
import {
  budgetCentsFromInput,
  buildBudgetBarrelSchema,
  submitBudgetBarrelSchema,
} from "@/lib/validations/budget-barrel";

export type BuildBudgetBarrelState =
  | { ok: true; view: BudgetBarrelClientView | null; providerNotes: string[] }
  | { ok: false; message: string };

export type SubmitBudgetBarrelState =
  | { ok: true; message: string; batchSessionId: string }
  | {
      ok: false;
      message: string;
      code?: "over_budget" | "missing_price" | "in_progress" | "not_found" | "invalid";
      offers?: BudgetBarrelClientView["offers"];
      priceCheckedAt?: string;
    };

function attributesFromParsed(
  raw: ReturnType<typeof buildBudgetBarrelSchema.parse>["preferences"]["attributes"],
): BudgetBarrelRequest["preferences"]["attributes"] {
  if (!raw) return undefined;
  const attributes: Partial<Record<BudgetBarrelCategory, BudgetBarrelCategoryAttributes>> = {};
  for (const category of BUDGET_BARREL_CATEGORIES) {
    const row = raw[category];
    if (!row) continue;
    attributes[category] = {
      size: row.size ?? null,
      color: row.color ?? null,
      packSize: row.packSize ?? null,
      brand: row.brand ?? null,
    };
  }
  return attributes;
}

function requestFromParsed(
  parsed: ReturnType<typeof buildBudgetBarrelSchema.parse>,
  budgetCents: number,
): BudgetBarrelRequest {
  return {
    budgetCents,
    categories: [...new Set(parsed.categories)],
    retailers: [...new Set(parsed.retailers)],
    preferences: {
      clothingSize: parsed.preferences.clothingSize ?? null,
      color: parsed.preferences.color ?? null,
      packSize: parsed.preferences.packSize ?? null,
      preferredBrands: parsed.preferences.preferredBrands ?? null,
      quantity: parsed.preferences.quantity ?? 1,
      mustHaveItems: parsed.preferences.mustHaveItems ?? null,
      attributes: attributesFromParsed(parsed.preferences.attributes),
    },
    instructions: parsed.instructions ?? null,
  };
}

export async function buildBudgetBarrelAction(raw: unknown): Promise<BuildBudgetBarrelState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "You must be signed in to build a list." };

  const parsed = buildBudgetBarrelSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const budgetCents = budgetCentsFromInput(parsed.data.budgetDollars);
  if (budgetCents == null) {
    return { ok: false, message: "Enter a merchandise budget from $1.00 to $20,000.00." };
  }

  const request = requestFromParsed(parsed.data, budgetCents);
  const held = parsed.data.previousDraftId
    ? await readHeldOffersForOwner(userId, parsed.data.previousDraftId, parsed.data.heldLines ?? [])
    : [];
  const heldSpend = held.reduce((sum, row) => {
    return sum + (lineMerchandiseCents(row.offer.priceCents, row.offer.currency, row.quantity) ?? 0);
  }, 0);
  const openSlots = Math.max(0, BUDGET_BARREL_LIST_SIZE - held.length);
  let candidates = openSlots === 0 ? [] : planBudgetBarrelQueries(request, openSlots);
  if (openSlots > 0) {
    const aiQueries = await planBudgetBarrelQueriesWithAi(request);
    if (aiQueries && aiQueries.length > 0) candidates = aiQueries;
  }
  const queries = fillQueriesAroundHeld(
    request,
    candidates,
    held.map((row) => ({
      productName: row.offer.productName,
      queryLabel: row.offer.queryLabel,
    })),
    openSlots,
  );
  if (queries.length === 0 && held.length === 0) {
    return { ok: false, message: "Choose a category so the list has something to search." };
  }

  try {
    const heldUrls = new Set(held.map((row) => row.offer.productUrl.toLowerCase()));
    let searched = { offers: [] as BudgetBarrelClientView["offers"], providerNotes: [] as string[] };
    if (queries.length > 0 && budgetCents > heldSpend) {
      try {
        const location = await budgetBarrelShoppingLocation();
        const found = await withSerpApiUsage({ userId, source: "customer_quote" }, () =>
          searchBudgetBarrelOffers({
            queries,
            retailers: request.retailers,
            location,
          }),
        );
        searched = {
          offers: found.offers.filter((offer) => !heldUrls.has(offer.productUrl.toLowerCase())),
          providerNotes: found.providerNotes,
        };
      } catch (error) {
        if (held.length === 0) throw error;
        console.warn(
          "[Amani Cart2Barrel] Budget barrel search failed after held products were kept:",
          error instanceof Error ? error.message : "unknown",
        );
        searched = {
          offers: [],
          providerNotes: ["The new search did not finish. Held products were kept."],
        };
      }
    }
    const freshLists = buildBudgetBarrelLists({
      offers: searched.offers,
      queries,
      budgetCents: Math.max(0, budgetCents - heldSpend),
      quantity: request.preferences.quantity,
      retailers: request.retailers,
    });
    const offers = [...held.map((row) => row.offer), ...searched.offers];
    const lists = applyHeldOffers({ held, offers, lists: freshLists });
    const priceCheckedAt = new Date().toISOString();
    const partial: Omit<BudgetBarrelClientView, "draftId"> = {
      budgetCents,
      priceCheckedAt,
      offers,
      oneStore: lists.oneStore,
      multiStore: lists.multiStore,
      unsatisfied: lists.unsatisfied,
      providerNotes: searched.providerNotes,
    };

    if (offers.length === 0) {
      return { ok: true, view: null, providerNotes: searched.providerNotes };
    }

    const draftId = await insertBudgetBarrelDraft({
      clerkUserId: userId,
      request,
      view: partial,
    });
    return {
      ok: true,
      view: { ...partial, draftId },
      providerNotes: searched.providerNotes,
    };
  } catch (error) {
    console.warn(
      "[Amani Cart2Barrel] Budget barrel search failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return {
      ok: false,
      message: "The retailer search did not finish. Adjust your preferences or try again.",
    };
  }
}

export async function submitBudgetBarrelAction(raw: unknown): Promise<SubmitBudgetBarrelState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "You must be signed in to submit a list." };

  const parsed = submitBudgetBarrelSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid",
      message: parsed.error.issues[0]?.message ?? "Check the list and try again.",
    };
  }
  const budgetCents = budgetCentsFromInput(parsed.data.budgetDollars);
  if (budgetCents == null) {
    return {
      ok: false,
      code: "invalid",
      message: "Enter a merchandise budget from $1.00 to $20,000.00.",
    };
  }

  const result = await submitBudgetBarrelForOwner({
    clerkUserId: userId,
    input: parsed.data,
    budgetCents,
  });
  if (!result.ok) return result;

  revalidatePath("/dashboard/items");
  revalidateDashboardAddItem();
  revalidatePath("/admin/overview");
  revalidatePath("/admin/item-requests", "layout");
  return {
    ok: true,
    message: result.message,
    batchSessionId: result.batchSessionId,
  };
}
