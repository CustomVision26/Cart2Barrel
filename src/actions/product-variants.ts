"use server";

import { auth } from "@clerk/nextjs/server";

import { fetchProductVariants } from "@/lib/product-variants/fetch-product-variants";
import type { FetchProductVariantsResult } from "@/lib/product-variants/types";
import { fetchProductVariantsSchema } from "@/lib/validations/product-variants";

export type { ProductVariantOffer } from "@/lib/product-variants/types";

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

  return fetchProductVariants(parsed.data);
}
