"use server";

import { auth } from "@clerk/nextjs/server";

import { extractProductWithOpenAI } from "@/lib/ai/extract-product-openai";
import { fetchPageHtmlForAi } from "@/lib/ai/fetch-page-for-ai";
import { validateItemRequestRetailerUrl } from "@/lib/product-url/item-request-retailer-url";
import { hostnameFromProductUrl } from "@/lib/site-name";
import { parseCustomerAiItemDraftInput } from "@/lib/validations/customer-ai-item-draft";

export type CustomerAiItemDraftSuccess = {
  ok: true;
  productName: string | null;
  /** Store / site label from AI or URL hostname. */
  siteName: string | null;
  productSize: string | null;
  productColor: string | null;
  aiNotes: string | null;
  /** Parsed listing quantity used for extraction context. */
  quantity: number;
  /** One unit at matching variant, cents; null if AI could not determine. */
  unitPriceCents: number | null;
  /** unitPriceCents × quantity when unit price known; null otherwise. */
  merchandiseSubtotalCents: number | null;
  /** HTTPS image URL from the listing when the model or page meta exposes one. */
  productImageUrl: string | null;
};

export type CustomerAiItemDraftFailure = {
  ok: false;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export type CustomerAiItemDraftResult =
  | CustomerAiItemDraftSuccess
  | CustomerAiItemDraftFailure;

export async function draftItemRequestFromUrlAction(
  raw: unknown
): Promise<CustomerAiItemDraftResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in to use AI assistance." };
  }

  const parsed = parseCustomerAiItemDraftInput(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string") {
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
    }
    return { ok: false, fieldErrors, message: "Invalid input." };
  }

  const retailerCheck = validateItemRequestRetailerUrl(parsed.data.productUrl);
  if (!retailerCheck.ok) {
    return { ok: false, message: retailerCheck.message };
  }

  const { quantity, productSize, productColor } = parsed.data;
  const productUrl = retailerCheck.href;

  try {
    const html = await fetchPageHtmlForAi(productUrl);
    const extraction = await extractProductWithOpenAI(html, productUrl, {
      quantity,
      productSize: productSize ?? null,
      productColor: productColor ?? null,
    });

    const name = extraction.productName?.trim() || null;
    const siteName =
      extraction.siteName?.trim() || hostnameFromProductUrl(productUrl) || null;
    const size =
      extraction.size?.trim() || (productSize?.trim() ? productSize : null);
    const color =
      extraction.color?.trim() || (productColor?.trim() ? productColor : null);
    const aiNotes = extraction.notes?.trim() || null;

    const unitPriceCents =
      extraction.unitPriceUsd != null && Number.isFinite(extraction.unitPriceUsd)
        ? Math.round(extraction.unitPriceUsd * 100)
        : null;
    const merchandiseSubtotalCents =
      unitPriceCents != null
        ? Math.round(unitPriceCents * quantity)
        : null;

    return {
      ok: true,
      productName: name,
      siteName,
      productSize: size,
      productColor: color,
      aiNotes,
      quantity,
      unitPriceCents,
      merchandiseSubtotalCents,
      productImageUrl: extraction.productImageUrl,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not extract product details.";
    return { ok: false, message: msg };
  }
}
