import {
  insertItemRequestLineSnapshot,
  lineSnapshotPayloadFromItemRequest,
} from "@/data/item-request-line-snapshots";
import type { ItemRequest, ItemRequestLineSnapshot } from "@/db/schema";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import type { OutsidePurchaseLifecyclePhase } from "@/lib/outside-purchase-lifecycle";

export async function insertOutsidePurchaseLifecycleSnapshot(params: {
  request: ItemRequest;
  phase: OutsidePurchaseLifecyclePhase;
  auditMemo: string;
  itemQuoteId?: string | null;
}): Promise<void> {
  if (!isOutsidePurchaseRequest(params.request)) return;

  await insertItemRequestLineSnapshot({
    itemRequestId: params.request.id,
    phase: params.phase,
    itemQuoteId: params.itemQuoteId ?? null,
    auditMemo: params.auditMemo,
    line: lineSnapshotPayloadFromItemRequest(params.request),
  });
}
