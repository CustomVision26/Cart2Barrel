"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";

import {
  fetchPageHtmlForAi,
  RetailerPageBlockedError,
  retailerPageFetchBlockedUserMessage,
} from "@/lib/ai/fetch-page-for-ai";
import { extractProductWithOpenAI } from "@/lib/ai/extract-product-openai";
import type { AiProductExtraction } from "@/lib/ai/extract-product-openai";
import { hostnameFromProductUrl } from "@/lib/site-name";
import {
  computeLineEstimateCents,
  getAdminMarkupSettings,
  type AdminMarkupSettings,
  type LineEstimateCents,
} from "@/lib/admin-markup";
import {
  applyAiExtractionPatchToItemRequest,
  getItemRequestById,
} from "@/data/item-requests";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { parseAdminAiEstimateRequest } from "@/lib/validations/admin-ai-estimate";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";

export type AdminAiEstimateSuccess = {
  ok: true;
  extraction: AiProductExtraction;
  unitPriceCents: number | null;
  estimate: LineEstimateCents;
  settings: AdminMarkupSettings;
};

export type AdminAiEstimateFailure = {
  ok: false;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export type AdminAiEstimateResult = AdminAiEstimateSuccess | AdminAiEstimateFailure;

export async function adminAiEstimateFromUrlAction(
  raw: unknown
): Promise<AdminAiEstimateResult> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = parseAdminAiEstimateRequest(raw);
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

  const {
    productUrl,
    quantity,
    productSize,
    productColor,
    itemRequestId,
    skipPageFetch,
  } = parsed.data;
  const settings = getAdminMarkupSettings();

  try {
    let feeOwnerId: string | undefined;
    if (itemRequestId) {
      const req = await getItemRequestById(itemRequestId);
      feeOwnerId = req?.clerkUserId;
    }
    const feeSnap = await getMerchantPricingForEstimates(feeOwnerId);
    const variantContext = {
      quantity,
      productSize: productSize ?? null,
      productColor: productColor ?? null,
    };

    let extraction: AiProductExtraction;
    if (skipPageFetch) {
      extraction = {
        productName: null,
        siteName: hostnameFromProductUrl(productUrl),
        unitPriceUsd: null,
        productImageUrl: null,
        color: productColor ?? null,
        size: productSize ?? null,
        notes:
          "Manual quote — product page was not fetched (retailer blocked automated access or staff chose manual entry).",
      };
    } else {
      const html = await fetchPageHtmlForAi(productUrl);
      extraction = await extractProductWithOpenAI(
        html,
        productUrl,
        variantContext
      );
    }
    const unitPriceCents =
      extraction.unitPriceUsd != null
        ? Math.round(extraction.unitPriceUsd * 100)
        : null;
    const estimate = computeLineEstimateCents(unitPriceCents, quantity, settings, {
      serviceTiers: feeSnap.serviceTiers,
    });

    if (itemRequestId) {
      await applyAiExtractionPatchToItemRequest(itemRequestId, {
        productImageUrl: extraction.productImageUrl,
        productName: extraction.productName,
        siteName: extraction.siteName,
      });
      revalidatePath("/admin/item-requests", "layout");
      revalidatePath("/admin/overview");
      revalidatePath("/dashboard/items");
      revalidateDashboardAddItem();
      revalidatePath("/dashboard/cart");
    }

    return {
      ok: true,
      extraction,
      unitPriceCents,
      estimate,
      settings,
    };
  } catch (e) {
    if (e instanceof RetailerPageBlockedError) {
      return { ok: false, message: e.message };
    }
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    if (/http 40[13]|http 429/i.test(msg)) {
      return { ok: false, message: retailerPageFetchBlockedUserMessage() };
    }
    return { ok: false, message: msg };
  }
}
