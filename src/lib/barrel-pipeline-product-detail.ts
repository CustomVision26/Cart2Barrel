import type { ItemQuote } from "@/db/schema";
import type { BatchLineShare } from "@/lib/batch-line-share";

/** Rich product detail for barrel pipeline double-click preview. */
export type BarrelPipelineProductDetail = {
  orderItemId: string;
  itemRequestId: string;
  productName: string;
  productUrl: string;
  productImageUrl: string | null;
  siteName: string | null;
  quantity: number;
  isOutsidePurchase: boolean;
  outsidePurchaseReference: string | null;
  requestedSize: string | null;
  requestedColor: string | null;
  receivedSize: string | null;
  receivedColor: string | null;
  fulfillmentLabel: string;
  assignedContainerAlias: string | null;
  assignedAt: string | null;
  isBatched: boolean;
  batchNumber: string | null;
  singleQuote: ItemQuote | null;
  batchShare: BatchLineShare | null;
  batchEstimateNote: string | null;
};
