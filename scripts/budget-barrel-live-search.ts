import "dotenv/config";

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

import { planBudgetBarrelQueries } from "../src/lib/budget-barrel/plan-queries";
import {
  normalizeGoogleShoppingHit,
  normalizeWalmartHit,
  type WalmartSearchHit,
} from "../src/lib/budget-barrel/normalize";
import { dedupeOffers } from "../src/lib/budget-barrel/normalize";
import { buildBudgetBarrelLists, priceSelection } from "../src/lib/budget-barrel/select-list";
import type { BudgetBarrelOffer, BudgetBarrelRequest } from "../src/lib/budget-barrel/types";
import type { SerpShoppingResult } from "../src/lib/serpapi/google-shopping";

async function applyMigration(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.log("DATABASE_URL is not set. Schema was not applied.");
    return;
  }
  const file = readFileSync(new URL("../drizzle/0118_budget_barrel.sql", import.meta.url), "utf8");
  const statements = file
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
  const sql = neon(databaseUrl);
  for (const statement of statements) {
    await sql.query(statement);
  }
  console.log(`Applied ${statements.length} Budget Barrel schema statements.`);
}

async function serpGet(params: Record<string, string>): Promise<Record<string, unknown>> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) throw new Error("SERPAPI_API_KEY is not set.");
  const url = new URL("https://serpapi.com/search.json");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("api_key", apiKey);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`SerpApi HTTP ${response.status}`);
  const data = (await response.json()) as Record<string, unknown> & { error?: string };
  if (data.error) throw new Error(data.error);
  return data;
}

async function liveSearch(): Promise<void> {
  if (!process.env.SERPAPI_API_KEY?.trim()) {
    console.log("SERPAPI_API_KEY is not set. Live retailer search was skipped.");
    return;
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
  const queries = planBudgetBarrelQueries(request).slice(0, 4);
  const retrievedAt = new Date().toISOString();
  const offers: BudgetBarrelOffer[] = [];
  const notes: string[] = [];
  const pendingTokens: { token: string; query: (typeof queries)[number]; title: string }[] = [];

  for (const query of queries) {
    try {
      const data = await serpGet({ engine: "walmart", query: query.text, device: "desktop" });
      const hits = (data.organic_results as WalmartSearchHit[] | undefined) ?? [];
      for (const hit of hits.slice(0, 8)) {
        const offer = normalizeWalmartHit(hit, query, retrievedAt);
        if (offer) offers.push(offer);
      }
    } catch (error) {
      notes.push(`Walmart: ${error instanceof Error ? error.message : "failed"}`);
    }

    try {
      const data = await serpGet({
        engine: "google_shopping",
        q: query.text,
        gl: "us",
        hl: "en",
        num: "8",
      });
      const hits = (data.shopping_results as Array<Record<string, unknown>> | undefined) ?? [];
      for (const raw of hits) {
        const title = typeof raw.title === "string" ? raw.title : "";
        const link = typeof raw.link === "string" ? raw.link : "";
        const productLink = typeof raw.product_link === "string" ? raw.product_link : "";
        const productUrl = [productLink, link].find((candidate) => {
          if (!/^https:\/\//i.test(candidate)) return false;
          try {
            return !new URL(candidate).hostname.toLowerCase().includes("google.");
          } catch {
            return false;
          }
        }) ?? "";
        if (!productUrl) {
          const token = typeof raw.immersive_product_page_token === "string"
            ? raw.immersive_product_page_token
            : "";
          const source = typeof raw.source === "string" ? raw.source : "";
          if (
            token &&
            /target/i.test(source) &&
            !pendingTokens.some((row) => row.query.id === query.id)
          ) {
            pendingTokens.push({ token, query, title });
          }
          continue;
        }
        const hit: SerpShoppingResult = {
          title,
          retailer: typeof raw.source === "string" ? raw.source : "Retailer",
          productUrl,
          priceUsd: typeof raw.extracted_price === "number" ? raw.extracted_price : null,
          priceText: typeof raw.price === "string" ? raw.price : null,
          imageUrl: typeof raw.thumbnail === "string" ? raw.thumbnail : null,
          immersiveProductPageToken: null,
          deliveryCents: null,
        };
        const offer = normalizeGoogleShoppingHit(hit, "target", query, retrievedAt);
        if (offer) offers.push(offer);
      }
    } catch (error) {
      notes.push(`Target: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  for (const row of pendingTokens) {
    try {
      const data = await serpGet({
        engine: "google_immersive_product",
        page_token: row.token,
        more_stores: "true",
      });
      const product = data.product_results as { stores?: Array<Record<string, unknown>>; title?: string } | undefined;
      for (const store of product?.stores ?? []) {
        const storeLink = typeof store.link === "string" ? store.link : "";
        let host = "";
        try {
          host = new URL(storeLink).hostname;
        } catch {
          continue;
        }
        if (!host.includes("target.")) continue;
        const hit: SerpShoppingResult = {
          title: (typeof store.title === "string" && store.title) || row.title,
          retailer: typeof store.name === "string" ? store.name : "Target",
          productUrl: storeLink,
          priceUsd: typeof store.extracted_price === "number" ? store.extracted_price : null,
          priceText: typeof store.price === "string" ? store.price : null,
          imageUrl: null,
          immersiveProductPageToken: row.token,
          deliveryCents: null,
        };
        const offer = normalizeGoogleShoppingHit(hit, "target", row.query, retrievedAt);
        if (offer) offers.push(offer);
        break;
      }
    } catch (error) {
      notes.push(`Target product detail: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  const deduped = dedupeOffers(offers);
  const lists = buildBudgetBarrelLists({
    offers: deduped,
    queries,
    budgetCents: request.budgetCents,
    quantity: 1,
    retailers: request.retailers,
  });
  const chosen = lists.multiStore ?? lists.oneStore;
  const priced = chosen ? priceSelection(deduped, chosen.lines, request.budgetCents) : null;

  for (const retailer of ["Walmart", "Target"]) {
    const rows = deduped.filter((offer) => offer.retailer === retailer);
    const pricedRows = rows.filter((offer) => offer.priceCents != null && offer.currency === "USD");
    console.log(
      `${retailer}: ${rows.length} usable offers, ${pricedRows.length} with USD prices, ${rows.filter((offer) => offer.productUrl.startsWith("https://")).length} product links`,
    );
  }
  if (notes.length > 0) console.log(`Provider notes: ${notes.join(" | ")}`);
  console.log(
    `One-store: ${lists.oneStore ? `${lists.oneStore.retailerKeys.join(",")} $${(lists.oneStore.merchandiseSubtotalCents / 100).toFixed(2)}` : "none"}`,
  );
  console.log(
    `Multi-store: ${lists.multiStore ? `${lists.multiStore.retailerKeys.join(",")} $${(lists.multiStore.merchandiseSubtotalCents / 100).toFixed(2)}` : "none"}`,
  );
  if (priced) {
    console.log(
      `Chosen merchandise $${(priced.merchandiseSubtotalCents / 100).toFixed(2)}, over by ${priced.overBudgetCents} cents, missing prices ${priced.missingPriceCount}`,
    );
    for (const line of priced.lines) {
      console.log(
        `- ${line.offer.retailer} | ${line.offer.size ?? "no size"} | ${line.offer.productName.slice(0, 80)} | ${line.lineTotalCents == null ? "no price" : (line.lineTotalCents / 100).toFixed(2)}`,
      );
    }
  }
  console.log(`Unsatisfied: ${(chosen?.unsatisfied ?? lists.unsatisfied).join(" || ") || "none"}`);
}

async function main(): Promise<void> {
  await applyMigration();
  await liveSearch();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Budget barrel live search failed.";
  console.error(message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]"));
  process.exitCode = 1;
});
