"use server";

import { auth } from "@clerk/nextjs/server";

import { fetchProductVariants } from "@/lib/product-variants/fetch-product-variants";
import type { FetchProductVariantsResult } from "@/lib/product-variants/types";
import { withSerpApiUsage } from "@/lib/serpapi/usage-context";
import { fetchProductVariantsSchema } from "@/lib/validations/product-variants";
import { validateItemRequestRetailerUrl } from "@/lib/product-url/item-request-retailer-url";

export async function fetchProductVariantsAction(
  raw: unknown,
): Promise<FetchProductVariantsResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in to load store variants." };
  }

  const parsed = fetchProductVariantsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const retailerCheck = validateItemRequestRetailerUrl(parsed.data.productUrl);
  if (!retailerCheck.ok) {
    return { ok: false, message: retailerCheck.message };
  }

  return withSerpApiUsage(
    { userId, source: "customer_quote" },
    () => fetchProductVariants(parsed.data),
  );
}
