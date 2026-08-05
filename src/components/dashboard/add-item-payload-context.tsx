"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import type { OwnerBatchQuoteSessionBundle } from "@/data/batch-quote-sessions";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
import type { MerchandiseTopupAddOnChargeView } from "@/data/merchandise-topup-cart";
import type {
  ItemQuote,
  ItemRequest,
  ItemRequestLineSnapshot,
  OutsidePurchaseReturnRequest,
} from "@/db/schema";

export type AddItemPagePayload = {
  customer: {
    name: string;
    email: string | null;
  };
  activeRequests: ItemRequest[];
  /** Quoted products past the published expiry window (removed from Active). */
  expiredQuotedRequests: ItemRequest[];
  /** Admin-published minutes customers have to accept/pay after a quote. */
  quoteExpiryMinutes: number;
  historyRequests: ItemRequest[];
  batchBundles: OwnerBatchQuoteSessionBundle[];
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
  quotesByRequestId: Record<string, ItemQuote[]>;
  fulfillmentLabelByRequestId: Record<string, string>;
  returnRequestsByItemRequestId: Record<string, OutsidePurchaseReturnRequest>;
  orderContextByRequestId: Record<string, ItemRequestOrderContext>;
  /** Pending purchase-price top-ups (add-on charges) for Products → Active. */
  merchandiseTopupAddOnCharges: MerchandiseTopupAddOnChargeView[];
};

const AddItemPayloadContext = createContext<AddItemPagePayload | null>(null);

export function AddItemPayloadProvider({
  value,
  children,
}: {
  value: AddItemPagePayload;
  children: ReactNode;
}) {
  return (
    <AddItemPayloadContext.Provider value={value}>
      {children}
    </AddItemPayloadContext.Provider>
  );
}

export function useAddItemPayload(): AddItemPagePayload {
  const ctx = useContext(AddItemPayloadContext);
  if (!ctx) {
    throw new Error("useAddItemPayload must be used within AddItemPayloadProvider.");
  }
  return ctx;
}
