import type { ItemRequest } from "@/db/schema";
import { outsidePurchaseReferenceDisplay } from "@/lib/outside-purchase";

type ProductReferenceInput = Pick<
  ItemRequest,
  "source" | "outsidePurchaseReference" | "productUrl"
>;

export function resolveOpNumber(row: ProductReferenceInput): string | null {
  return outsidePurchaseReferenceDisplay(row);
}

export function resolveProductReferenceLabel(opts: {
  orderItemId?: string | null;
  itemRequestId?: string | null;
  opNumber?: string | null;
}): string | null {
  const op = opts.opNumber?.trim();
  if (op) return `OP ${op}`;
  const orderItemId = opts.orderItemId?.trim();
  if (orderItemId) return `Product # ${orderItemId}`;
  const itemRequestId = opts.itemRequestId?.trim();
  if (itemRequestId) return `Product # ${itemRequestId}`;
  return null;
}

/** Metadata line under product titles (checkout summary, Stripe receipt, invoices). */
export function buildCheckoutProductDetailText(opts: {
  batchNumber?: string | null;
  orderItemId?: string | null;
  itemRequestId?: string | null;
  outsidePurchaseReference?: string | null;
  productUrl: string;
  source: ItemRequest["source"];
  quantity: number;
  siteName?: string | null;
  includeQuantity?: boolean;
}): string | null {
  const parts: string[] = [];
  const batchNumber = opts.batchNumber?.trim() || null;
  const opNumber =
    resolveOpNumber({
      source: opts.source,
      outsidePurchaseReference: opts.outsidePurchaseReference ?? null,
      productUrl: opts.productUrl,
    }) ?? null;
  const productRef = resolveProductReferenceLabel({
    orderItemId: opts.orderItemId,
    itemRequestId: opts.itemRequestId,
    opNumber,
  });

  if (batchNumber) parts.push(`Batch ${batchNumber}`);
  if (productRef) parts.push(productRef);
  if (!batchNumber && !productRef && opts.siteName?.trim()) {
    parts.push(opts.siteName.trim());
  }

  const includeQuantity = opts.includeQuantity ?? true;
  if (includeQuantity) parts.push(`Qty ${opts.quantity}`);

  return parts.length > 0 ? parts.join(" · ") : null;
}
