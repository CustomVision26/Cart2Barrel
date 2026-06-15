"use client";

import type { WarehouseMissingReason } from "@/lib/warehouse-receive-condition";
import {
  CONDITION_OPTIONS,
  receivingConditionSelectClassName,
  type WarehouseReceiveCondition,
} from "@/components/admin/receiving-row-actions";
import { ReceivingRowActions } from "@/components/admin/receiving-row-actions";
import { WarehouseProofPhotosField } from "@/components/orders/warehouse-proof-photos-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WAREHOUSE_MISSING_REASON_OPTIONS } from "@/lib/warehouse-receive-condition";

export type WarehouseReceiptIntakeDraft = {
  receivedQty: number;
  condition: WarehouseReceiveCondition;
  missingReason: WarehouseMissingReason;
  shelfLocation: string;
  conditionNotes: string;
  proofPhotoUrls: string[];
  proofFileCount: number;
  barcodeValue: string;
};

export function defaultWarehouseReceiptIntakeDraft(
  orderedQty: number,
): WarehouseReceiptIntakeDraft {
  return {
    receivedQty: orderedQty,
    condition: "good",
    missingReason: "package_empty",
    shelfLocation: "",
    conditionNotes: "",
    proofPhotoUrls: [],
    proofFileCount: 0,
    barcodeValue: "",
  };
}

type WarehouseReceiptIntakeFieldsProps = {
  idPrefix: string;
  orderedQty: number;
  draft: WarehouseReceiptIntakeDraft;
  disabled?: boolean;
  onChange: (patch: Partial<WarehouseReceiptIntakeDraft>) => void;
  lineLabel?: string;
};

/** Shared warehouse intake fields for received delivery / store pickup. */
export function WarehouseReceiptIntakeFields({
  idPrefix,
  orderedQty,
  draft,
  disabled = false,
  onChange,
  lineLabel = "Product",
}: WarehouseReceiptIntakeFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-muted-foreground">Ordered qty</Label>
          <p className="text-sm font-medium tabular-nums text-foreground">{orderedQty}</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-qty`}>Received qty</Label>
          <Input
            id={`${idPrefix}-qty`}
            type="number"
            min={0}
            value={draft.receivedQty}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                receivedQty: Math.max(0, Number.parseInt(e.target.value, 10) || 0),
              })
            }
            className="tabular-nums"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-cond`}>Condition received</Label>
        <select
          id={`${idPrefix}-cond`}
          className={receivingConditionSelectClassName}
          value={draft.condition}
          disabled={disabled}
          onChange={(e) =>
            onChange({ condition: e.target.value as WarehouseReceiveCondition })
          }
        >
          {CONDITION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {draft.condition === "missing" ?
          <div className="mt-2 space-y-1">
            <Label htmlFor={`${idPrefix}-missing-reason`}>Missing details</Label>
            <select
              id={`${idPrefix}-missing-reason`}
              className={receivingConditionSelectClassName}
              value={draft.missingReason}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  missingReason: e.target.value as WarehouseMissingReason,
                })
              }
            >
              {WAREHOUSE_MISSING_REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        : null}
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-condition-notes`}>Received condition notes</Label>
        <textarea
          id={`${idPrefix}-condition-notes`}
          className="min-h-[5rem] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground"
          value={draft.conditionNotes}
          disabled={disabled}
          onChange={(e) => onChange({ conditionNotes: e.target.value })}
          placeholder="Scratches, seal broken, wrong color received, etc."
          maxLength={2000}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-shelf`}>Shelf location</Label>
        <Input
          id={`${idPrefix}-shelf`}
          value={draft.shelfLocation}
          disabled={disabled}
          placeholder="e.g. A-12-03 / BIN-4421"
          onChange={(e) => onChange({ shelfLocation: e.target.value })}
        />
      </div>

      <ReceivingRowActions
        lineLabel={lineLabel}
        shelfLocation={draft.shelfLocation}
        proofFileCount={draft.proofFileCount}
        showProofPhotos={false}
        onShelfAssigned={(shelf) => onChange({ shelfLocation: shelf })}
        onProofFilesAdded={() => {}}
        onBarcodeApplied={(value) => onChange({ barcodeValue: value })}
      />

      <WarehouseProofPhotosField
        orderItemId={idPrefix}
        imageUrls={draft.proofPhotoUrls}
        disabled={disabled}
        title="Received product proof"
        description="Upload photos of the retailer receipt, item, or package label — up to 12 images (JPEG, PNG, WebP, GIF)."
        addButtonLabel="Add proof images"
        emptyLabel="No proof images uploaded yet."
        imageAlt="Received product proof"
        onUrlsChange={(urls) =>
          onChange({ proofPhotoUrls: urls, proofFileCount: urls.length })
        }
      />
    </div>
  );
}
