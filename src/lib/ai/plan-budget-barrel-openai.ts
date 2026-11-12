import OpenAI from "openai";
import { z } from "zod";

import {
  BUDGET_BARREL_MAX_QUERIES,
  type BudgetBarrelCategory,
} from "@/lib/budget-barrel/constants";
import { queriesFromAiPlan } from "@/lib/budget-barrel/plan-queries";
import type { BudgetBarrelRequest, PlannedQuery } from "@/lib/budget-barrel/types";

const aiPlanSchema = z.object({
  queries: z
    .array(
      z.object({
        text: z.string().trim().min(2).max(120),
        category: z.enum(["food", "clothing", "shoes", "electronics", "household", "beauty"]),
        mustHave: z.boolean().optional(),
        label: z.string().trim().min(2).max(80).optional(),
      }),
    )
    .max(BUDGET_BARREL_MAX_QUERIES),
});

/**
 * Turns free-text shopping instructions into a short query plan.
 * Returns null when AI is not configured or the response is unusable.
 */
export async function planBudgetBarrelQueriesWithAi(
  request: BudgetBarrelRequest,
): Promise<PlannedQuery[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !request.instructions?.trim()) return null;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const client = new OpenAI({ apiKey, timeout: 12_000 });
  const categories = request.categories.join(", ");

  let content = "";
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You plan retailer search queries for a merchandise budget.",
            "Return JSON only: {\"queries\":[{\"text\":\"rice\",\"category\":\"food\",\"mustHave\":true,\"label\":\"Rice\"}]}",
            `Use only these categories: ${categories}.`,
            `Return at most ${BUDGET_BARREL_MAX_QUERIES} queries.`,
            "Do not invent product URLs, prices, or retailers.",
            "Keep a requested clothing size and pack size in the query text.",
            "Mark items the shopper said they want as mustHave.",
            "If they prioritize food, list food queries first.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            `Budget cents: ${request.budgetCents}`,
            `Categories: ${categories}`,
            `Retailers: ${request.retailers.join(", ")}`,
            request.preferences.clothingSize
              ? `Clothing size: ${request.preferences.clothingSize}`
              : null,
            request.preferences.color ? `Color: ${request.preferences.color}` : null,
            request.preferences.packSize ? `Pack size: ${request.preferences.packSize}` : null,
            request.preferences.preferredBrands
              ? `Brands: ${request.preferences.preferredBrands}`
              : null,
            request.preferences.mustHaveItems
              ? `Must-have items: ${request.preferences.mustHaveItems}`
              : null,
            `Instructions: ${request.instructions}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });
    content = completion.choices[0]?.message?.content ?? "";
  } catch (error) {
    console.warn(
      "[Amani Cart2Barrel] Budget barrel query plan fell back to structured inputs:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }

  try {
    const parsed = aiPlanSchema.safeParse(JSON.parse(content));
    if (!parsed.success || parsed.data.queries.length === 0) return null;
    const allowed = new Set<BudgetBarrelCategory>(request.categories);
    const queries = parsed.data.queries.filter((row) => allowed.has(row.category));
    if (queries.length === 0) return null;
    return queriesFromAiPlan(request, queries);
  } catch (error) {
    console.warn(
      "[Amani Cart2Barrel] Budget barrel query plan was not valid JSON:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}
