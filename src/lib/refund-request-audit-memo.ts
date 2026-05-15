import type { OrderItemRefundReasonKindValue } from "@/lib/validations/order-item-refund-request";

export type RefundRequestAuditMemoPayload = {
  orderItemRefundRequestId: string;
  orderItemId: string;
  reasonKind: OrderItemRefundReasonKindValue;
  details: string;
  requestedAmountCents: number | null;
};

export function buildRefundRequestAuditMemo(
  payload: RefundRequestAuditMemoPayload,
): string {
  return JSON.stringify(payload);
}

export function parseRefundRequestAuditMemo(raw: string | null | undefined) {
  if (!raw?.trim()) return null;
  try {
    const v = JSON.parse(raw) as Partial<RefundRequestAuditMemoPayload>;
    if (
      typeof v.orderItemRefundRequestId === "string" &&
      typeof v.orderItemId === "string" &&
      typeof v.reasonKind === "string" &&
      typeof v.details === "string"
    ) {
      return v as RefundRequestAuditMemoPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function refundRequestReasonKindLabel(kind: OrderItemRefundReasonKindValue): string {
  switch (kind) {
    case "defective_or_damaged":
      return "Product defective / damaged";
    case "wrong_item":
      return "Wrong item received";
    case "not_received":
      return "Never received item";
    case "not_as_described":
      return "Not as described";
    case "duplicate_charge":
      return "Duplicate charge";
    case "changed_mind":
      return "Changed mind / cancelled";
    case "other":
      return "Other";
    default: {
      const _e: never = kind;
      return _e;
    }
  }
}
