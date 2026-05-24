"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import type { OwnerBatchQuoteSessionBundle } from "@/data/batch-quote-sessions";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
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
  historyRequests: ItemRequest[];
  batchBundles: OwnerBatchQuoteSessionBundle[];
  snapshotsByRequestId: Record<string, ItemRequestLineSnapshot[]>;
  quotesByRequestId: Record<string, ItemQuote[]>;
  fulfillmentLabelByRequestId: Record<string, string>;
  returnRequestsByItemRequestId: Record<string, OutsidePurchaseReturnRequest>;
  orderContextByRequestId: Record<string, ItemRequestOrderContext>;
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
