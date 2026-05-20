import type { OrderItem } from "@/db/schema";
import {
  warehouseReceiptMemoSchema,
  warehouseReceiptMemoV1Schema,
  warehouseReceiptMemoV2Schema,
  type WarehouseReceiptMemoV1,
  type WarehouseReceiptMemoV2,
} from "@/lib/validations/admin-warehouse-receipt";
import type { WarehouseReceiveCondition } from "@/lib/warehouse-receive-condition";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";

/** Normalized receipt fields for audit UI (v1 and v2 memos). */
export type ParsedWarehouseReceiptMemo = {
  orderItemId: string;
  orderedQty: number;
  receivedQty: number;
  condition: WarehouseReceiveCondition;
  shelfLocation: string;
  proofPhotoCount: number;
  proofPhotoUrls?: string[];
  barcodeValue?: string;
  intakeSequence?: number;
  intakeRole?: WarehouseReceiptMemoV2["intakeRole"];
  intakeContext?: WarehouseReceiptMemoV2["intakeContext"];
  recordedAt?: string;
};

export function parseWarehouseReceiptMemo(
  auditMemo: string | null | undefined,
): ParsedWarehouseReceiptMemo | null {
  if (!auditMemo?.trim()) return null;
  try {
    const parsedJson: unknown = JSON.parse(auditMemo);
    const parsed = warehouseReceiptMemoSchema.safeParse(parsedJson);
    if (!parsed.success) return null;
    const data = parsed.data;
    if (data.kind === "warehouse_receipt_v1") {
      return {
        orderItemId: data.orderItemId,
        orderedQty: data.orderedQty,
        receivedQty: data.receivedQty,
        condition: data.condition,
        shelfLocation: data.shelfLocation,
        proofPhotoCount: data.proofPhotoCount,
        barcodeValue: data.barcodeValue,
      };
    }
    return {
      orderItemId: data.orderItemId,
      orderedQty: data.orderedQty,
      receivedQty: data.receivedQty,
      condition: data.condition,
      shelfLocation: data.shelfLocation,
      proofPhotoCount: data.proofPhotoCount,
      proofPhotoUrls: data.proofPhotoUrls,
      barcodeValue: data.barcodeValue,
      intakeSequence: data.intakeSequence,
      intakeRole: data.intakeRole,
      intakeContext: data.intakeContext,
      recordedAt: data.recordedAt,
    };
  } catch {
    return null;
  }
}

export function buildWarehouseReceiptAuditMemo(
  input: WarehouseReceiptMemoV1,
): string {
  return JSON.stringify(warehouseReceiptMemoV1Schema.parse(input));
}

export function buildWarehouseReceiptAuditMemoV2(
  input: WarehouseReceiptMemoV2,
): string {
  return JSON.stringify(warehouseReceiptMemoV2Schema.parse(input));
}

export function warehouseReceiptHumanNote(params: {
  orderItemShortId: string;
  orderedQty: number;
  receivedQty: number;
  conditionKey: WarehouseReceiveCondition;
  shelfLocation: string;
  proofPhotoCount: number;
  barcodeValue?: string;
  intakeRole?: WarehouseReceiptMemoV2["intakeRole"];
  intakeSequence?: number;
  intakeContext?: WarehouseReceiptMemoV2["intakeContext"];
}): string {
  const conditionLabel = warehouseReceiveConditionLabel(params.conditionKey);
  const header =
    params.intakeRole === "prior" ?
      `Prior warehouse intake #${params.intakeSequence ?? "?"} (frozen before replacement receipt)`
    : params.intakeContext === "replacement_after_return" ?
      `Replacement inbound receipt #${params.intakeSequence ?? "?"} (after return in transit)`
    : `Warehouse receipt · order line …${params.orderItemShortId}`;
  const lines = [
    header,
    `Ordered qty: ${params.orderedQty}`,
    `Received qty: ${params.receivedQty}`,
    `Condition: ${conditionLabel}`,
    `Shelf / bin: ${params.shelfLocation.trim() || "—"}`,
    `Proof photos: ${params.proofPhotoCount}`,
  ];
  if (params.barcodeValue?.trim()) {
    lines.push(`Barcode / SKU: ${params.barcodeValue.trim()}`);
  }
  return lines.join("\n");
}

export type OrderItemWarehouseReceiptSnapshotSource = Pick<
  OrderItem,
  | "id"
  | "quantity"
  | "warehouseReceivedAt"
  | "warehouseReceivedQty"
  | "warehouseReceivedCondition"
  | "warehouseShelfLocation"
  | "warehouseReceivedBarcode"
  | "warehouseReceivedBarcodeImageUrl"
  | "warehouseReceivedProofPhotoCount"
  | "warehouseReceivedProofPhotoUrls"
>;

function warehouseConditionFromOrderItem(
  raw: string | null | undefined,
): WarehouseReceiveCondition {
  if (
    raw === "good" ||
    raw === "damaged" ||
    raw === "missing" ||
    raw === "wrong_item"
  ) {
    return raw;
  }
  return "good";
}

/** Build a v2 memo + note from the current `order_items` receipt columns (active intake). */
export function warehouseReceiptV2FromOrderItemRow(
  orderItem: OrderItemWarehouseReceiptSnapshotSource,
  params: {
    intakeSequence: number;
    intakeRole: WarehouseReceiptMemoV2["intakeRole"];
    intakeContext?: WarehouseReceiptMemoV2["intakeContext"];
    recordedAt: string;
  },
): { memo: string; note: string; payload: WarehouseReceiptMemoV2 } {
  const proofPhotoUrls = orderItem.warehouseReceivedProofPhotoUrls ?? undefined;
  const proofCount =
    proofPhotoUrls?.length ??
    orderItem.warehouseReceivedProofPhotoCount ??
    0;
  const shelf = orderItem.warehouseShelfLocation?.trim() ?? "";
  const barcode = orderItem.warehouseReceivedBarcode?.trim();
  const condition = warehouseConditionFromOrderItem(
    orderItem.warehouseReceivedCondition,
  );
  const payload: WarehouseReceiptMemoV2 = {
    kind: "warehouse_receipt_v2",
    orderItemId: orderItem.id,
    intakeSequence: params.intakeSequence,
    intakeRole: params.intakeRole,
    intakeContext: params.intakeContext,
    recordedAt: params.recordedAt,
    orderedQty: orderItem.quantity,
    receivedQty: orderItem.warehouseReceivedQty ?? orderItem.quantity,
    condition,
    shelfLocation: shelf,
    proofPhotoCount: proofCount,
    proofPhotoUrls:
      proofPhotoUrls && proofPhotoUrls.length > 0 ? proofPhotoUrls : undefined,
    barcodeValue: barcode === "" ? undefined : barcode,
    barcodeImageUrl:
      orderItem.warehouseReceivedBarcodeImageUrl?.trim() ?
        orderItem.warehouseReceivedBarcodeImageUrl.trim()
      : undefined,
  };
  const memo = buildWarehouseReceiptAuditMemoV2(payload);
  const note = warehouseReceiptHumanNote({
    orderItemShortId: orderItem.id.slice(0, 8),
    orderedQty: payload.orderedQty,
    receivedQty: payload.receivedQty,
    conditionKey: payload.condition,
    shelfLocation: payload.shelfLocation,
    proofPhotoCount: payload.proofPhotoCount,
    barcodeValue: payload.barcodeValue,
    intakeRole: params.intakeRole,
    intakeSequence: params.intakeSequence,
    intakeContext: params.intakeContext,
  });
  return { memo, note, payload };
}
