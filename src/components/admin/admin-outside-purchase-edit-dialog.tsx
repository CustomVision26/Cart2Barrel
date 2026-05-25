"use client";

import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { publishAdminOutsidePurchaseReturnEstimateAction } from "@/actions/admin-outside-purchase-return-estimate";
import { updateAdminOutsidePurchaseIntakeAction } from "@/actions/admin-outside-purchase-intake";
import {
  CONDITION_OPTIONS,
  receivingConditionSelectClassName,
} from "@/components/admin/receiving-row-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { CollapsibleFieldSection } from "@/components/ui/collapsible-field-section";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ItemQuote, ItemRequest, OutsidePurchaseReturnRequest } from "@/db/schema";
import { formatUsd, type MerchantServiceTierRow } from "@/lib/admin-markup";
import {
  computeOutsidePurchaseCustomerQuoteCents,
} from "@/lib/outside-purchase-service-quote";
import { OUTSIDE_PURCHASE_STAFF_NOTE_PREFIX } from "@/lib/outside-purchase-staff-note";
import type { WarehouseReceiveCondition } from "@/lib/warehouse-receive-condition";

function parseDollarsToCents(raw: string): number {
  const t = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (t === "") return 0;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function centsToDollarsInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

type AdminOutsidePurchaseEditDialogProps = {
  request: ItemRequest;
  quote: ItemQuote | null;
  outsidePurchaseServiceTiers: MerchantServiceTierRow[];
  returnRequest: OutsidePurchaseReturnRequest | null;
};

export function AdminOutsidePurchaseEditDialog({
  request,
  quote,
  outsidePurchaseServiceTiers,
  returnRequest,
}: AdminOutsidePurchaseEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, startSave] = useTransition();

  const [productName, setProductName] = useState(request.productName ?? "");
  const [quantity, setQuantity] = useState(String(request.quantity));
  const [productSize, setProductSize] = useState(request.productSize ?? "");
  const [productColor, setProductColor] = useState(request.productColor ?? "");
  const [receivedCondition, setReceivedCondition] = useState<WarehouseReceiveCondition>(
    (request.outsidePurchaseReceivedCondition as WarehouseReceiveCondition) ?? "good",
  );
  const [receivedShelfLocation, setReceivedShelfLocation] = useState(
    request.outsidePurchaseShelfLocation ?? "",
  );
  const [unitPriceDollars, setUnitPriceDollars] = useState("0.00");
  const [staffNote, setStaffNote] = useState(
    quote?.staffNote?.trim() || OUTSIDE_PURCHASE_STAFF_NOTE_PREFIX,
  );
  const [returnFeeDollars, setReturnFeeDollars] = useState(
    returnRequest?.returnServiceFeeCents != null ?
      centsToDollarsInput(returnRequest.returnServiceFeeCents)
    : "",
  );
  const [returnStaffNote, setReturnStaffNote] = useState(
    returnRequest?.returnStaffNote ?? "",
  );

  const resetFromProps = useCallback(() => {
    setProductName(request.productName ?? "");
    setQuantity(String(request.quantity));
    setProductSize(request.productSize ?? "");
    setProductColor(request.productColor ?? "");
    setReceivedCondition(
      (request.outsidePurchaseReceivedCondition as WarehouseReceiveCondition) ?? "good",
    );
    setReceivedShelfLocation(request.outsidePurchaseShelfLocation ?? "");
    setStaffNote(quote?.staffNote?.trim() || OUTSIDE_PURCHASE_STAFF_NOTE_PREFIX);
    setReturnFeeDollars(
      returnRequest?.returnServiceFeeCents != null ?
        centsToDollarsInput(returnRequest.returnServiceFeeCents)
      : "",
    );
    setReturnStaffNote(returnRequest?.returnStaffNote ?? "");
  }, [request, quote, returnRequest]);

  const pricingPreview = useMemo(() => {
    return computeOutsidePurchaseCustomerQuoteCents({
      unitPriceCents: parseDollarsToCents(unitPriceDollars),
      quantity: Math.max(1, Number.parseInt(quantity, 10) || 1),
      unitsPerPack: 1,
      serviceTiers: outsidePurchaseServiceTiers,
    });
  }, [unitPriceDollars, quantity, outsidePurchaseServiceTiers]);

  const onSave = () => {
    const fd = new FormData();
    fd.set("itemRequestId", request.id);
    fd.set("clerkUserId", request.clerkUserId);
    fd.set("outsidePurchaseReference", request.outsidePurchaseReference ?? "");
    fd.set("productName", productName.trim());
    fd.set("quantity", quantity);
    fd.set("unitsPerPack", "1");
    fd.set("unitPriceCents", String(parseDollarsToCents(unitPriceDollars)));
    if (productSize.trim()) fd.set("productSize", productSize.trim());
    if (productColor.trim()) fd.set("productColor", productColor.trim());
    fd.set("receivedCondition", receivedCondition);
    fd.set("receivedShelfLocation", receivedShelfLocation.trim());
    if (staffNote.trim()) fd.set("staffNote", staffNote.trim());

    startSave(async () => {
      const res = await updateAdminOutsidePurchaseIntakeAction(fd);
      if (res.ok) {
        toast.success(res.message ?? "Updated.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message ?? "Could not update.");
      }
    });
  };

  const onPublishReturnEstimate = () => {
    const cents = parseDollarsToCents(returnFeeDollars);
    startSave(async () => {
      const res = await publishAdminOutsidePurchaseReturnEstimateAction({
        itemRequestId: request.id,
        returnServiceFeeCents: cents,
        returnStaffNote: returnStaffNote.trim() || undefined,
      });
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetFromProps();
      }}
    >
      <DialogTrigger
        type="button"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Edit
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,44rem)] gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Edit outside purchase</DialogTitle>
          <DialogDescription>
            Update intake details for {request.outsidePurchaseReference ?? request.id}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 px-6 py-4">
          <Field>
            <FieldLabel>Product name</FieldLabel>
            <FieldContent>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
            </FieldContent>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Received Qty</FieldLabel>
              <FieldContent>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Listed unit price (tier)</FieldLabel>
              <FieldContent>
                <Input
                  inputMode="decimal"
                  value={unitPriceDollars}
                  onChange={(e) => setUnitPriceDollars(e.target.value)}
                />
              </FieldContent>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Received Size</FieldLabel>
              <FieldContent>
                <Input value={productSize} onChange={(e) => setProductSize(e.target.value)} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Received Color</FieldLabel>
              <FieldContent>
                <Input value={productColor} onChange={(e) => setProductColor(e.target.value)} />
              </FieldContent>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Condition received</FieldLabel>
              <FieldContent>
                <select
                  value={receivedCondition}
                  onChange={(e) =>
                    setReceivedCondition(e.target.value as WarehouseReceiveCondition)
                  }
                  className={receivingConditionSelectClassName}
                >
                  {CONDITION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel>Shelf location</FieldLabel>
              <FieldContent>
                <Input
                  value={receivedShelfLocation}
                  onChange={(e) => setReceivedShelfLocation(e.target.value)}
                />
              </FieldContent>
            </Field>
          </div>
          <Field>
            <FieldLabel>Staff note</FieldLabel>
            <FieldContent>
              <textarea
                rows={3}
                value={staffNote}
                onChange={(e) => setStaffNote(e.target.value)}
                className="border-input bg-transparent flex w-full resize-y rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </FieldContent>
          </Field>
          <p className="text-xs text-muted-foreground">
            Service preview (good condition): {formatUsd(pricingPreview.totalPriceCents)}
          </p>

          {returnRequest && returnRequest.status !== "cancelled" ?
            <CollapsibleFieldSection
              title="Return to retailer estimate"
              description="Publish return service fee for the customer to accept"
              defaultOpen
            >
              <Field>
                <FieldLabel>Return service fee (USD)</FieldLabel>
                <FieldContent>
                  <Input
                    inputMode="decimal"
                    value={returnFeeDollars}
                    onChange={(e) => setReturnFeeDollars(e.target.value)}
                    placeholder="0.00"
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel>Return estimate note</FieldLabel>
                <FieldContent>
                  <textarea
                    rows={2}
                    value={returnStaffNote}
                    onChange={(e) => setReturnStaffNote(e.target.value)}
                    placeholder="Shown in the customer’s Preview return dialog…"
                    className="border-input bg-transparent flex w-full resize-y rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  />
                </FieldContent>
              </Field>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={saving}
                onClick={onPublishReturnEstimate}
              >
                Publish return estimate
              </Button>
            </CollapsibleFieldSection>
          : null}
        </div>

        <DialogFooter className="gap-2 border-t border-border bg-secondary px-6 py-4 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={onSave}>
            {saving ?
              <Loader2Icon className="size-4 animate-spin" />
            : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
