import {
  warehouseReceiptMemoV1Schema,
  type WarehouseReceiptMemoV1,
} from "@/lib/validations/admin-warehouse-receipt";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";

export function parseWarehouseReceiptMemo(
  auditMemo: string | null | undefined,
): WarehouseReceiptMemoV1 | null {
  if (!auditMemo?.trim()) return null;
  try {
    const parsedJson: unknown = JSON.parse(auditMemo);
    const parsed = warehouseReceiptMemoV1Schema.safeParse(parsedJson);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function buildWarehouseReceiptAuditMemo(
  input: WarehouseReceiptMemoV1,
): string {
  return JSON.stringify(warehouseReceiptMemoV1Schema.parse(input));
}

export function warehouseReceiptHumanNote(params: {
  orderItemShortId: string;
  orderedQty: number;
  receivedQty: number;
  conditionKey: WarehouseReceiptMemoV1["condition"];
  shelfLocation: string;
  proofPhotoCount: number;
  barcodeValue?: string;
}): string {
  const conditionLabel = warehouseReceiveConditionLabel(params.conditionKey);
  const lines = [
    `Warehouse receipt · order line …${params.orderItemShortId}`,
    `Ordered qty: ${params.orderedQty}`,
    `Received qty: ${params.receivedQty}`,
    `Condition: ${conditionLabel}`,
    `Shelf / bin: ${params.shelfLocation.trim() || "—"}`,
    `Proof photos (this session): ${params.proofPhotoCount}`,
  ];
  if (params.barcodeValue?.trim()) {
    lines.push(`Barcode / SKU: ${params.barcodeValue.trim()}`);
  }
  return lines.join("\n");
}
