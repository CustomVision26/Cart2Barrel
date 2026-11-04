"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateStorePickupIntakeAction } from "@/actions/admin-update-store-pickup-intake";
import {
  defaultWarehouseReceiptIntakeDraft,
  WarehouseReceiptIntakeFields,
  type WarehouseReceiptIntakeDraft,
} from "@/components/admin/warehouse-receipt-intake-fields";
import { WarehouseIntakePreviewDialog } from "@/components/orders/warehouse-intake-preview-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import { orderLineHasStorePickupIntake } from "@/lib/company-purchase-inbound";
import {
  isWarehouseMissingReason,
  type WarehouseReceiveCondition,
} from "@/lib/warehouse-receive-condition";

export type StorePickupIntakeOrderItem = {
  id: string;
  quantity: number;
  companyPurchaseInboundMethod?: string | null;
  storePickupAt?: string | null;
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
): value is WarehouseReceiveCondition {
  return (
    value === "good" ||
    value === "damaged" ||
    value === "missing" ||
    value === "wrong_item"
  );
}

function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) {
    const fallback = new Date();
    fallback.setMinutes(fallback.getMinutes() - fallback.getTimezoneOffset());
    return fallback.toISOString().slice(0, 16);
  }
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function storePickupAtLocalToIso(localValue: string): string | null {
  const trimmed = localValue.trim();
  if (trimmed === "") return null;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function draftFromOrderItem(
  orderItem: StorePickupIntakeOrderItem,
): WarehouseReceiptIntakeDraft {
  const base = defaultWarehouseReceiptIntakeDraft(orderItem.quantity);
  if (!orderItem.warehouseReceivedAt && !orderItem.storePickupAt) return base;
  const proofPhotoUrls = [...(orderItem.warehouseReceivedProofPhotoUrls ?? [])];
  return {
    ...base,
    receivedQty: orderItem.warehouseReceivedQty ?? orderItem.quantity,
    condition: isReceiveCondition(orderItem.warehouseReceivedCondition)
      ? orderItem.warehouseReceivedCondition
      : "good",
    missingReason: isWarehouseMissingReason(
      orderItem.warehouseReceivedMissingReason,
    )
      ? orderItem.warehouseReceivedMissingReason
      : "package_empty",
    shelfLocation: orderItem.warehouseShelfLocation ?? "",
    proofPhotoUrls,
    proofFileCount:
      proofPhotoUrls.length > 0
        ? proofPhotoUrls.length
        : (orderItem.warehouseReceivedProofPhotoCount ?? 0),
    barcodeValue: orderItem.warehouseReceivedBarcode ?? "",
    conditionNotes: orderItem.warehouseReceivedConditionNotes ?? "",
  };
}

export function AdminStorePickupIntakeButtons({
  productLabel,
  orderItem,
  snapshots = [],
}: {
  productLabel: string;
  orderItem: StorePickupIntakeOrderItem;
  snapshots?: ItemRequestLineSnapshot[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(() => draftFromOrderItem(orderItem));
  const [pickupLocal, setPickupLocal] = useState(() =>
    isoToLocalInput(orderItem.storePickupAt ?? orderItem.warehouseReceivedAt),
  );

  if (!orderLineHasStorePickupIntake(orderItem)) return null;

  function openEditor() {
    setDraft(draftFromOrderItem(orderItem));
    setPickupLocal(
      isoToLocalInput(orderItem.storePickupAt ?? orderItem.warehouseReceivedAt),
    );
    setOpen(true);
  }

  function save() {
    const pickupIso = storePickupAtLocalToIso(pickupLocal);
    if (!pickupIso) {
      toast.error("Enter when the store pickup was recorded.");
      return;
    }
    startTransition(async () => {
      const res = await updateStorePickupIntakeAction({
        orderItemId: orderItem.id,
        storePickupAt: pickupIso,
        receivedQty: draft.receivedQty,
        condition: draft.condition,
        missingReason:
          draft.condition === "missing" ? draft.missingReason : undefined,
        shelfLocation: draft.shelfLocation,
        proofPhotoCount: draft.proofPhotoUrls.length,
        proofPhotoUrls: draft.proofPhotoUrls,
        barcodeValue: draft.barcodeValue.trim() || undefined,
        conditionNotes: draft.conditionNotes.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <WarehouseIntakePreviewDialog
        productLabel={productLabel}
        orderItem={orderItem}
        snapshots={snapshots}
        triggerLabel="Preview condition"
        dialogTitle="Store pickup condition"
      />
      <Button type="button" variant="outline" size="sm" onClick={openEditor}>
        Update intake
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update store pickup intake</DialogTitle>
            <DialogDescription className="line-clamp-2">
              Revise how this product was received at pickup. {productLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`store-pickup-update-at-${orderItem.id}`}>
              Pickup date &amp; time
            </Label>
            <Input
              id={`store-pickup-update-at-${orderItem.id}`}
              type="datetime-local"
              value={pickupLocal}
              onChange={(e) => setPickupLocal(e.target.value)}
              disabled={pending}
            />
            <p className="text-[11px] text-muted-foreground">
              When staff collected this item from the retailer.
            </p>
          </div>
          <WarehouseReceiptIntakeFields
            idPrefix={`store-pickup-update-${orderItem.id}`}
            orderItemId={orderItem.id}
            orderedQty={orderItem.quantity}
            draft={draft}
            disabled={pending}
            onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
            lineLabel={productLabel}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={save}>
              {pending ? "Saving…" : "Save intake"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
