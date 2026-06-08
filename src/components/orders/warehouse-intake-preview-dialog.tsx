"use client";

import { ItemRequestLineSnapshotPreviewPanel } from "@/components/orders/item-request-line-snapshot-preview-panel";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import { latestWarehouseDeliverySnapshot } from "@/lib/admin-package-receiving-line";
import {
  isWarehouseMissingReason,
  warehouseMissingReasonLabel,
  warehouseReceiveConditionLabel,
} from "@/lib/warehouse-receive-condition";
import { cn } from "@/lib/utils";

export type WarehouseIntakePreviewOrderItem = {
  quantity: number;
  warehouseReceivedAt?: string | null;
  warehouseReceivedQty?: number | null;
  warehouseReceivedCondition?: string | null;
  warehouseReceivedMissingReason?: string | null;
  warehouseReceivedConditionNotes?: string | null;
  warehouseShelfLocation?: string | null;
  warehouseReceivedBarcode?: string | null;
  warehouseReceivedProofPhotoUrls?: string[] | null;
  warehouseReceivedProofPhotoCount?: number | null;
};

function isReceiveCondition(
  value: string | null | undefined,
): value is "good" | "damaged" | "missing" | "wrong_item" {
  return (
    value === "good" ||
    value === "damaged" ||
    value === "missing" ||
    value === "wrong_item"
  );
}

function WarehouseIntakeFromOrderItem({
  orderItem,
}: {
  orderItem: WarehouseIntakePreviewOrderItem;
}) {
  const receivedAt = orderItem.warehouseReceivedAt?.trim();
  if (!receivedAt) {
    return (
      <p className="text-sm text-muted-foreground">
        No warehouse intake has been recorded for this line yet.
      </p>
    );
  }

  const condition = isReceiveCondition(orderItem.warehouseReceivedCondition) ?
      orderItem.warehouseReceivedCondition
    : "good";
  const proofUrls = orderItem.warehouseReceivedProofPhotoUrls ?? [];

  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs font-medium text-muted-foreground">Recorded</dt>
        <dd>{new Date(receivedAt).toLocaleString()}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-muted-foreground">Ordered qty</dt>
        <dd className="tabular-nums">{orderItem.quantity}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-muted-foreground">Received qty</dt>
        <dd className="tabular-nums">
          {orderItem.warehouseReceivedQty ?? orderItem.quantity}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-muted-foreground">Condition</dt>
        <dd>{warehouseReceiveConditionLabel(condition)}</dd>
      </div>
      {condition === "missing" ?
        <>
          {missingReason ?
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                Missing detail
              </dt>
              <dd>{warehouseMissingReasonLabel(missingReason)}</dd>
            </div>
          : null}
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Missing reported
            </dt>
            <dd>
              <time dateTime={receivedAt}>{recordedLabel}</time>
            </dd>
          </div>
        </>
      : null}
      {orderItem.warehouseReceivedConditionNotes?.trim() ?
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Condition notes</dt>
          <dd className="whitespace-pre-wrap">
            {orderItem.warehouseReceivedConditionNotes.trim()}
          </dd>
        </div>
      : null}
      <div className="sm:col-span-2">
        <dt className="text-xs font-medium text-muted-foreground">Shelf / bin</dt>
        <dd>{orderItem.warehouseShelfLocation?.trim() || "—"}</dd>
      </div>
      {orderItem.warehouseReceivedBarcode?.trim() ?
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Barcode / SKU</dt>
          <dd className="font-mono text-xs">{orderItem.warehouseReceivedBarcode.trim()}</dd>
        </div>
      : null}
      {proofUrls.length > 0 ?
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Receipt images</dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {proofUrls.map((url: string) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-md border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Warehouse receipt"
                  className="size-20 object-cover"
                />
              </a>
            ))}
          </dd>
        </div>
      : null}
    </dl>
  );
}

export function WarehouseIntakePreviewDialog({
  productLabel,
  orderItem,
  snapshots = [],
  triggerLabel = "Preview intake",
  triggerClassName,
}: {
  productLabel: string;
  orderItem: WarehouseIntakePreviewOrderItem;
  snapshots?: ItemRequestLineSnapshot[];
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const intakeSnapshot = latestWarehouseDeliverySnapshot(snapshots);

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "mt-2 w-full",
          triggerClassName,
        )}
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Warehouse delivery intake</DialogTitle>
          <DialogDescription className="line-clamp-2">{productLabel}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          {intakeSnapshot ?
            <ItemRequestLineSnapshotPreviewPanel
              row={intakeSnapshot}
              prevRow={null}
              warehouseProofPhotoUrls={orderItem.warehouseReceivedProofPhotoUrls}
              hideDuplicateChangeSummary
            />
          : <WarehouseIntakeFromOrderItem orderItem={orderItem} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
