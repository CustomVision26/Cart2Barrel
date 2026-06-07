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
import {
  appendOutsidePurchaseConditionPhotosToFormData,
  createOutsidePurchaseConditionDraftFromUrl,
  OutsidePurchaseConditionPhotosField,
  type OutsidePurchaseConditionPhotoDraft,
} from "@/components/admin/outside-purchase-condition-photos-field";
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
import { FieldLabelWithHelp } from "@/components/ui/field-label-with-help";
import { HelpBalloon } from "@/components/ui/help-balloon";
import { Input } from "@/components/ui/input";
import {
  revokeBlobPreviewUrl,
} from "@/lib/staged-product-image";
import { outsidePurchaseConditionImageUrlsFromRequest } from "@/lib/outside-purchase-condition-images";
import type { ItemQuote, ItemRequest, OutsidePurchaseReturnRequest } from "@/db/schema";
import { formatUsd, type MerchantServiceTierRow } from "@/lib/admin-markup";
import {
  computeOutsidePurchaseCustomerQuoteCents,
  parseListedUnitPriceCentsFromOutsidePurchaseStaffNote,
} from "@/lib/outside-purchase-service-quote";
import { OUTSIDE_PURCHASE_STAFF_NOTE_PREFIX } from "@/lib/outside-purchase-staff-note";
import type {
  WarehouseMissingReason,
  WarehouseReceiveCondition,
} from "@/lib/warehouse-receive-condition";
import {
  isWarehouseMissingReason,
  WAREHOUSE_MISSING_REASON_OPTIONS,
} from "@/lib/warehouse-receive-condition";

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

function listedUnitPriceDollarsFromQuote(quote: ItemQuote | null): string {
  const cents = parseListedUnitPriceCentsFromOutsidePurchaseStaffNote(
    quote?.staffNote,
  );
  return cents != null ? centsToDollarsInput(cents) : "0.00";
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
  const [receivedMissingReason, setReceivedMissingReason] =
    useState<WarehouseMissingReason>(
      isWarehouseMissingReason(request.outsidePurchaseMissingReason) ?
        request.outsidePurchaseMissingReason
      : "package_empty",
    );
  const [receivedShelfLocation, setReceivedShelfLocation] = useState(
    request.outsidePurchaseShelfLocation ?? "",
  );
  const [unitPriceDollars, setUnitPriceDollars] = useState(() =>
    listedUnitPriceDollarsFromQuote(quote),
  );
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
  const [conditionPhotos, setConditionPhotos] = useState<
    OutsidePurchaseConditionPhotoDraft[]
  >([]);
  const [displayPhotoId, setDisplayPhotoId] = useState<string | null>(null);

  const loadConditionPhotosFromRequest = useCallback(() => {
    const drafts = outsidePurchaseConditionImageUrlsFromRequest(request).map(
      createOutsidePurchaseConditionDraftFromUrl,
    );
    setConditionPhotos((current) => {
      for (const photo of current) {
        if (photo.file) revokeBlobPreviewUrl(photo.previewUrl);
      }
      return drafts;
    });
    const displayUrl = request.productImageUrl?.trim();
    const displayDraft =
      drafts.find((draft) => draft.existingUrl === displayUrl) ??
      drafts[0] ??
      null;
    setDisplayPhotoId(displayDraft?.id ?? null);
  }, [request]);

  const resetFromProps = useCallback(() => {
    setProductName(request.productName ?? "");
    setQuantity(String(request.quantity));
    setProductSize(request.productSize ?? "");
    setProductColor(request.productColor ?? "");
    setReceivedCondition(
      (request.outsidePurchaseReceivedCondition as WarehouseReceiveCondition) ?? "good",
    );
    setReceivedMissingReason(
      isWarehouseMissingReason(request.outsidePurchaseMissingReason) ?
        request.outsidePurchaseMissingReason
      : "package_empty",
    );
    setReceivedShelfLocation(request.outsidePurchaseShelfLocation ?? "");
    setUnitPriceDollars(listedUnitPriceDollarsFromQuote(quote));
    setStaffNote(quote?.staffNote?.trim() || OUTSIDE_PURCHASE_STAFF_NOTE_PREFIX);
    setReturnFeeDollars(
      returnRequest?.returnServiceFeeCents != null ?
        centsToDollarsInput(returnRequest.returnServiceFeeCents)
      : "",
    );
    setReturnStaffNote(returnRequest?.returnStaffNote ?? "");
    loadConditionPhotosFromRequest();
  }, [request, quote, returnRequest, loadConditionPhotosFromRequest]);

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
    if (receivedCondition === "missing") {
      fd.set("receivedMissingReason", receivedMissingReason);
    }
    fd.set("receivedShelfLocation", receivedShelfLocation.trim());
    if (staffNote.trim()) fd.set("staffNote", staffNote.trim());
    appendOutsidePurchaseConditionPhotosToFormData(
      fd,
      conditionPhotos,
      displayPhotoId,
    );

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
      <span className="inline-flex items-center gap-1.5">
        <DialogTrigger
          type="button"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Edit
        </DialogTrigger>
        <HelpBalloon label="About edit">
          Open a dialog to update this outside purchase&apos;s details, condition, photos,
          and (when applicable) the return-to-retailer estimate.
        </HelpBalloon>
      </span>
      <DialogContent className="max-h-[min(92vh,44rem)] gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Edit outside purchase</DialogTitle>
          <DialogDescription>
            Update intake details for {request.outsidePurchaseReference ?? request.id}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 px-6 py-4">
          <Field>
            <FieldLabelWithHelp
              label="Product name"
              help="Name shown to the customer on this product line. Use the retailer's product title so the shopper recognizes the item."
              helpLabel="About product name"
            />
            <FieldContent>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
            </FieldContent>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabelWithHelp
                label="Received Qty"
                help="Number of units received. Service & handling is charged per unit."
                helpLabel="About received quantity"
              />
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
              <FieldLabelWithHelp
                label="Listed unit price (tier)"
                help="Single-item price used only to pick the outside-purchase service & handling tier. It is not what the customer is billed for merchandise."
                helpLabel="About listed unit price"
              />
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
              <FieldLabelWithHelp
                label="Received Size"
                help="Size/variant of the item as it actually arrived (optional)."
                helpLabel="About received size"
              />
              <FieldContent>
                <Input value={productSize} onChange={(e) => setProductSize(e.target.value)} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabelWithHelp
                label="Received Color"
                help="Color/variant of the item as it actually arrived (optional)."
                helpLabel="About received color"
              />
              <FieldContent>
                <Input value={productColor} onChange={(e) => setProductColor(e.target.value)} />
              </FieldContent>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabelWithHelp
                label="Condition received"
                help="Physical state of the item when it arrived (e.g. good, damaged, wrong item). Drives the customer status and any return-to-retailer flow."
                helpLabel="About received condition"
              />
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
                {receivedCondition === "missing" ?
                  <div className="mt-2 space-y-1.5">
                    <span className="block text-xs font-medium text-muted-foreground">
                      Missing details
                    </span>
                    <select
                      value={receivedMissingReason}
                      onChange={(e) =>
                        setReceivedMissingReason(
                          e.target.value as WarehouseMissingReason,
                        )
                      }
                      className={receivingConditionSelectClassName}
                    >
                      {WAREHOUSE_MISSING_REASON_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                : null}
              </FieldContent>
            </Field>
            <Field>
              <FieldLabelWithHelp
                label="Shelf location"
                help="Where the item is stored in your warehouse (aisle, shelf, or bin). Internal only — helps staff find it when packing."
                helpLabel="About shelf location"
              />
              <FieldContent>
                <Input
                  value={receivedShelfLocation}
                  onChange={(e) => setReceivedShelfLocation(e.target.value)}
                />
              </FieldContent>
            </Field>
          </div>
          <Field>
            <FieldLabelWithHelp
              label="Staff note"
              help="Short message shown to the customer on this product line — e.g. a note about substitutions or condition."
              helpLabel="About staff note"
            />
            <FieldContent>
              <textarea
                rows={3}
                value={staffNote}
                onChange={(e) => setStaffNote(e.target.value)}
                className="border-input bg-muted flex w-full resize-y rounded-lg border px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-white/25 dark:bg-secondary"
              />
            </FieldContent>
          </Field>
          <p className="text-xs text-muted-foreground">
            Service preview (good condition): {formatUsd(pricingPreview.totalPriceCents)}
          </p>

          <Field>
            <FieldLabelWithHelp
              label="Received condition photos"
              help="Upload, remove, or choose which photo is the customer-facing product display image."
              helpLabel="About received condition photos"
            />
            <FieldContent>
              <OutsidePurchaseConditionPhotosField
                inputId={`op-edit-condition-images-${request.id}`}
                photos={conditionPhotos}
                displayPhotoId={displayPhotoId}
                onPhotosChange={setConditionPhotos}
                onDisplayPhotoIdChange={setDisplayPhotoId}
              />
            </FieldContent>
          </Field>

          {returnRequest && returnRequest.status !== "cancelled" ?
            <CollapsibleFieldSection
              title="Return to retailer estimate"
              description="Publish return service fee for the customer to accept"
              defaultOpen
            >
              <Field>
                <FieldLabelWithHelp
                  label="Return service fee (USD)"
                  help="Fee the customer pays to have this item returned to the retailer instead of shipped in their barrel. Published for the customer to accept."
                  helpLabel="About return service fee"
                />
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
                <FieldLabelWithHelp
                  label="Return estimate note"
                  help="Message shown to the customer in their Preview return dialog — explain the reason for the return or any conditions."
                  helpLabel="About return estimate note"
                />
                <FieldContent>
                  <textarea
                    rows={2}
                    value={returnStaffNote}
                    onChange={(e) => setReturnStaffNote(e.target.value)}
                    placeholder="Shown in the customer’s Preview return dialog…"
                    className="border-input bg-muted flex w-full resize-y rounded-lg border px-2.5 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-white/25 dark:bg-secondary"
                  />
                </FieldContent>
              </Field>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={saving}
                  onClick={onPublishReturnEstimate}
                >
                  Publish return estimate
                </Button>
                <HelpBalloon label="About publish return estimate">
                  Sends the return service fee and note to the customer so they can accept
                  the return-to-retailer option. Does not save the other edits above — use
                  Save changes for those.
                </HelpBalloon>
              </div>
            </CollapsibleFieldSection>
          : null}
        </div>

        <DialogFooter className="sticky bottom-0 z-10 gap-2 border-t border-border bg-secondary px-6 py-4 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" disabled={saving} onClick={onSave}>
              {saving ?
                <Loader2Icon className="size-4 animate-spin" />
              : "Save changes"}
            </Button>
            <HelpBalloon
              label="About save changes"
              tooltipClassName="top-auto bottom-full mt-0 mb-2 right-0 left-auto translate-x-0"
            >
              Saves the product details, condition, shelf location, note, and any new
              photos, then recalculates the customer&apos;s service estimate.
            </HelpBalloon>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
