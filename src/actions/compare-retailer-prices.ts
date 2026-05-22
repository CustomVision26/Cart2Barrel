"use server";

import { auth } from "@clerk/nextjs/server";

import {
  compareRetailerPrices,
  type CompareRetailerPricesResult,
} from "@/lib/retailer-price-compare";
import { serpApiNotConfiguredMessage } from "@/lib/serpapi/env";
import { getSerpApiKey } from "@/lib/serpapi/env";
import { compareRetailerPricesSchema } from "@/lib/validations/compare-retailer-prices";

export async function compareRetailerPricesAction(
  raw: unknown,
): Promise<CompareRetailerPricesResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in to compare prices." };
  }

  if (!getSerpApiKey()) {
    return { ok: false, message: serpApiNotConfiguredMessage() };
  }

  const parsed = compareRetailerPricesSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const {
    productName,
    productSize,
    productColor,
    originalProductUrl,
    originalRetailer,
    originalPriceUsdCents,
    originalImageUrl,
  } = parsed.data;

  return compareRetailerPrices({
    productName,
    productSize,
    productColor,
    originalProductUrl,
    originalRetailer,
    originalPriceUsdCents,
    originalImageUrl,
  });
}
