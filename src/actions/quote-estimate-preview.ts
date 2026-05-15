"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

import { getItemRequestById } from "@/data/item-requests";
import {
  getLatestQuoteForItemRequest,
  restoreOrphanQuotedItemRequestQuote,
} from "@/data/item-quotes";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import type { ItemRequest } from "@/db/schema";

const previewSchema = z.object({
  itemRequestId: z.string().uuid(),
});

export type QuoteEstimatePreviewRow = {
  itemCost: number;
  /**
   * Deduction from listed pack/bundle subtotal (estimate); net merchandise is `itemCost`.
   * Null/omitted for legacy quotes without this line.
   */
  merchandiseSavingsCents: number | null;
  serviceFee: number;
  estimatedShipping: number;
  totalPrice: number;
  taxCents: number;
  quotedAt: string;
  /** Customer line as recorded when staff saved this estimate (optional on legacy rows). */
  quotedRequestLine: {
    quantity: number;
    productSize: string | null;
    productColor: string | null;
    productName: string | null;
  } | null;
};

/** Subset of item request fields for the estimate dialog. */
export type QuoteEstimateProductMeta = {
  productName: string | null;
  quantity: number;
  productSize: string | null;
  productColor: string | null;
  /** Saved HTTPS URL from AI estimate / staff (for thumbnails). */
  productImageUrl: string | null;
};

export type GetQuoteEstimatePreviewResult =
  | {
      ok: true;
      quote: QuoteEstimatePreviewRow | null;
      product: QuoteEstimateProductMeta;
      status: ItemRequest["status"];
      allowCustomerLineEdit: boolean;
      allowRequestNewEstimate: boolean;
    }
  | { ok: false; message: string };

export async function getQuoteEstimatePreviewAction(
  raw: unknown
): Promise<GetQuoteEstimatePreviewResult> {
  const parsed = previewSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { itemRequestId } = parsed.data;
  const clerkUser = await currentUser();
  const admin = isClerkAdmin(clerkUser);
  const { userId } = await auth();

  if (!admin && !userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const request = await getItemRequestById(itemRequestId);
  if (!request) {
    return { ok: false, message: "Not found." };
  }
  if (!admin && request.clerkUserId !== userId) {
    return { ok: false, message: "Not found." };
  }

  const product: QuoteEstimateProductMeta = {
    productName: request.productName?.trim() || null,
    quantity: request.quantity,
    productSize: request.productSize?.trim() || null,
    productColor: request.productColor?.trim() || null,
    productImageUrl: request.productImageUrl?.trim() || null,
  };

  const allowCustomerLineEdit =
    !admin &&
    (request.status === "pending" || request.status === "quoted");
  const allowRequestNewEstimate = !admin && request.status === "quoted";

  let quote = await getLatestQuoteForItemRequest(itemRequestId);
  if (!quote) {
    quote = await restoreOrphanQuotedItemRequestQuote(itemRequestId);
  }
  if (!quote) {
    return {
      ok: true,
      quote: null,
      product,
      status: request.status,
      allowCustomerLineEdit,
      allowRequestNewEstimate,
    };
  }

  const taxCents = Math.max(
    0,
    quote.totalPrice -
      quote.itemCost -
      quote.serviceFee -
      quote.estimatedShipping
  );

  const quotedRequestLine =
    quote.requestQuantity != null
      ? {
          quantity: quote.requestQuantity,
          productSize: quote.requestProductSize,
          productColor: quote.requestProductColor,
          productName: quote.requestProductName,
        }
      : null;

  return {
    ok: true,
    quote: {
      itemCost: quote.itemCost,
      merchandiseSavingsCents: quote.merchandiseSavingsCents ?? null,
      serviceFee: quote.serviceFee,
      estimatedShipping: quote.estimatedShipping,
      totalPrice: quote.totalPrice,
      taxCents,
      quotedAt: quote.createdAt,
      quotedRequestLine,
    },
    product,
    status: request.status,
    allowCustomerLineEdit,
    allowRequestNewEstimate,
  };
}
