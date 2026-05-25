"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { useRouter } from "next/navigation";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  recordOutsidePurchasePaymentPromptAction,
  saveAdminOutsidePurchaseIntakeAction,
} from "@/actions/admin-outside-purchase-intake";
import { AdminOutsidePurchaseEditDialog } from "@/components/admin/admin-outside-purchase-edit-dialog";
import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import { QuoteEstimatePreviewDialog } from "@/components/quote-estimate-preview-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { CartLinePriceBreakdown } from "@/components/dashboard/cart-line-price-breakdown";
import { Button } from "@/components/ui/button";
import { CollapsibleFieldSection } from "@/components/ui/collapsible-field-section";
import { HelpBalloon } from "@/components/ui/help-balloon";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { FieldLabelWithHelp } from "@/components/ui/field-label-with-help";
import { SectionTitleWithHelp } from "@/components/ui/section-title-with-help";
import { ImageFileInput } from "@/components/ui/image-file-input";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
import type { OutsidePurchaseIntakeAdminRow } from "@/data/outside-purchase-intake";
import type { AdminProfilePickerRow } from "@/data/customer-pricing-packages";
import type { ItemQuote, ItemRequestLineSnapshot } from "@/db/schema";
import { formatUsd, type MerchantServiceTierRow } from "@/lib/admin-markup";
import {
  computeOutsidePurchaseCustomerQuoteCents,
  outsidePurchaseQuoteSummaryRows,
} from "@/lib/outside-purchase-service-quote";
import {
  formatOutsidePurchaseReference,
  outsidePurchaseReferenceDisplay,
} from "@/lib/outside-purchase";
import { OUTSIDE_PURCHASE_STAFF_NOTE_PREFIX } from "@/lib/outside-purchase-staff-note";
import {
  itemRequestStatusBadgeKindForDisplay,
  itemRequestStatusLabelForDisplay,
} from "@/lib/item-request-status-label";
import type { OutsidePurchaseReturnRequest } from "@/db/schema";
import { displayProductSiteName } from "@/lib/site-name";
import {
  revokeBlobPreviewUrl,
  validateProductImageFile,
} from "@/lib/staged-product-image";
import {
  CONDITION_OPTIONS,
  receivingConditionSelectClassName,
} from "@/components/admin/receiving-row-actions";
import type { WarehouseReceiveCondition } from "@/lib/warehouse-receive-condition";
import { cn } from "@/lib/utils";

function parseDollarsToCents(raw: string): number {
  const t = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (t === "") return 0;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function parseQuantityInput(raw: string): number {
  const t = raw.trim();
  if (t === "") return 1;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 999);
}

function parseUnitsPerPackInput(raw: string): number {
  const t = raw.trim();
  if (t === "") return 1;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 9999);
}

type AdminOutsidePurchaseIntakePanelProps = {
  customers: AdminProfilePickerRow[];
  recentRows: OutsidePurchaseIntakeAdminRow[];
  latestQuotesByRequestId: Record<string, ItemQuote>;
  returnRequestsByItemRequestId: Record<string, OutsidePurchaseReturnRequest>;
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
  orderContextByRequestId?: Record<string, ItemRequestOrderContext>;
  outsidePurchaseServiceTiers: MerchantServiceTierRow[];
};

export function AdminOutsidePurchaseIntakePanel({
  customers,
  recentRows,
  latestQuotesByRequestId,
  returnRequestsByItemRequestId,
  snapshotsByRequestId = {},
  orderContextByRequestId = {},
  outsidePurchaseServiceTiers,
}: AdminOutsidePurchaseIntakePanelProps) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [promptingId, setPromptingId] = useState<string | null>(null);

  const [clerkUserId, setClerkUserId] = useState("");
  const [reference, setReference] = useState(() => formatOutsidePurchaseReference());
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [isPackLine, setIsPackLine] = useState(false);
  const [unitsPerPack, setUnitsPerPack] = useState("1");
  const [unitPriceDollars, setUnitPriceDollars] = useState("0.00");
  const [productSize, setProductSize] = useState("");
  const [productColor, setProductColor] = useState("");
  const [receivedCondition, setReceivedCondition] =
    useState<WarehouseReceiveCondition>("good");
  const [receivedShelfLocation, setReceivedShelfLocation] = useState("");
  const [receiptNote, setReceiptNote] = useState("");
  const [staffNote, setStaffNote] = useState(OUTSIDE_PURCHASE_STAFF_NOTE_PREFIX);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [receiptImageFile, setReceiptImageFile] = useState<File | null>(null);
  const [receiptImagePreview, setReceiptImagePreview] = useState<string | null>(
    null,
  );

  const pricingPreview = useMemo(() => {
    return computeOutsidePurchaseCustomerQuoteCents({
      unitPriceCents: parseDollarsToCents(unitPriceDollars),
      quantity: parseQuantityInput(quantity),
      unitsPerPack: isPackLine ? parseUnitsPerPackInput(unitsPerPack) : 1,
      serviceTiers: outsidePurchaseServiceTiers,
    });
  }, [unitPriceDollars, quantity, isPackLine, unitsPerPack, outsidePurchaseServiceTiers]);

  const previewRows = useMemo(
    () =>
      outsidePurchaseQuoteSummaryRows(
        {
          serviceFee: pricingPreview.serviceFeeCents,
          requestQuantity: pricingPreview.quantity,
          totalPrice: pricingPreview.totalPriceCents,
          staffNote: null,
        },
        pricingPreview,
      ),
    [pricingPreview],
  );

  const resetForm = useCallback(() => {
    setReference(formatOutsidePurchaseReference());
    setProductName("");
    setQuantity("1");
    setIsPackLine(false);
    setUnitsPerPack("1");
    setUnitPriceDollars("0.00");
    setProductSize("");
    setProductColor("");
    setReceivedCondition("good");
    setReceivedShelfLocation("");
    setReceiptNote("");
    setStaffNote(OUTSIDE_PURCHASE_STAFF_NOTE_PREFIX);
    setImageFile(null);
    revokeBlobPreviewUrl(imagePreview);
    setImagePreview(null);
    setReceiptImageFile(null);
    revokeBlobPreviewUrl(receiptImagePreview);
    setReceiptImagePreview(null);
  }, [imagePreview, receiptImagePreview]);

  const onPickProductImage = useCallback(
    (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file) return;
      const err = validateProductImageFile(file);
      if (err) {
        toast.error(err);
        return;
      }
      setImageFile(file);
      revokeBlobPreviewUrl(imagePreview);
      setImagePreview(URL.createObjectURL(file));
    },
    [imagePreview],
  );

  const onPickReceiptImage = useCallback(
    (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file) return;
      const err = validateProductImageFile(file);
      if (err) {
        toast.error(err);
        return;
      }
      setReceiptImageFile(file);
      revokeBlobPreviewUrl(receiptImagePreview);
      setReceiptImagePreview(URL.createObjectURL(file));
    },
    [receiptImagePreview],
  );

  const onSubmit = () => {
    if (!clerkUserId.trim()) {
      toast.error("Select a customer account.");
      return;
    }
    if (!productName.trim()) {
      toast.error("Enter a product name.");
      return;
    }

    const fd = new FormData();
    fd.set("clerkUserId", clerkUserId.trim());
    fd.set("outsidePurchaseReference", reference.trim());
    fd.set("productName", productName.trim());
    fd.set("quantity", String(parseQuantityInput(quantity)));
    fd.set(
      "unitsPerPack",
      String(isPackLine ? parseUnitsPerPackInput(unitsPerPack) : 1),
    );
    fd.set("unitPriceCents", String(parseDollarsToCents(unitPriceDollars)));
    if (productSize.trim()) fd.set("productSize", productSize.trim());
    if (productColor.trim()) fd.set("productColor", productColor.trim());
    fd.set("receivedCondition", receivedCondition);
    fd.set("receivedShelfLocation", receivedShelfLocation.trim());
    if (receiptNote.trim()) fd.set("note", receiptNote.trim());
    if (staffNote.trim()) fd.set("staffNote", staffNote.trim());
    if (imageFile) fd.set("productImage", imageFile);
    if (receiptImageFile) fd.set("receiptImage", receiptImageFile);

    startSave(async () => {
      const res = await saveAdminOutsidePurchaseIntakeAction(fd);
      if (res.ok) {
        toast.success(res.message ?? "Saved.");
        resetForm();
        router.refresh();
      } else {
        toast.error(res.message ?? "Could not save.");
      }
    });
  };

  const onRecordPrompt = (itemRequestId: string) => {
    setPromptingId(itemRequestId);
    startSave(async () => {
      const res = await recordOutsidePurchasePaymentPromptAction({ itemRequestId });
      setPromptingId(null);
      if (res.ok) {
        toast.success(res.message ?? "Recorded.");
        router.refresh();
      } else {
        toast.error(res.message ?? "Could not record.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
        <div className="space-y-1">
          <SectionTitleWithHelp
            title="Outside purchase intake"
            titleClassName="text-lg font-semibold text-foreground"
            help={
              <>
                Record products the customer bought elsewhere and shipped to your address.
                Each line gets a unique{" "}
                <span className="font-mono text-xs">OP-YYYYMMDD-XXXX</span> reference. The
                customer pays{" "}
                <span className="font-medium text-foreground">
                  outside purchase service &amp; handling only
                </span>
                , calculated from your outside-purchase fee tiers and the listed unit price ×
                quantity. In-app service &amp; handling fees do not apply. Merchandise, shipping,
                and tax from their receipt are not billed here.
              </>
            }
            helpLabel="About outside purchase intake"
            tooltipClassName="w-[28rem]"
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor="op-customer">Customer account</FieldLabel>
              <FieldContent>
                <select
                  id="op-customer"
                  value={clerkUserId}
                  onChange={(e) => setClerkUserId(e.target.value)}
                  className={cn(
                    "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm",
                    "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    "dark:bg-input/30",
                  )}
                >
                  <option value="">Select customer…</option>
                  {customers.map((c) => (
                    <option key={c.clerkUserId} value={c.clerkUserId}>
                      {c.displayName}
                      {c.email ? ` · ${c.email}` : ""}
                    </option>
                  ))}
                </select>
              </FieldContent>
            </Field>

            {clerkUserId.trim() ?
              <p className="text-xs text-muted-foreground">
                Charges use the global outside-purchase service &amp; handling tiers from
                Fees &amp; rates (not in-app tiers or customer package overrides).
              </p>
            : null}

            <div className="flex flex-wrap items-end gap-2">
              <Field className="min-w-[14rem] flex-1">
                <FieldLabel htmlFor="op-ref">Reference number</FieldLabel>
                <FieldContent>
                  <Input
                    id="op-ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value.toUpperCase())}
                    className="font-mono"
                    autoComplete="off"
                  />
                </FieldContent>
              </Field>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReference(formatOutsidePurchaseReference())}
              >
                <RefreshCwIcon className="mr-1.5 size-3.5" aria-hidden />
                New ID
              </Button>
            </div>

            <Field>
              <FieldLabel htmlFor="op-name">Product name</FieldLabel>
              <FieldContent>
                <Input
                  id="op-name"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </FieldContent>
            </Field>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/80 bg-muted/10 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={isPackLine}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsPackLine(checked);
                  if (!checked) {
                    setUnitsPerPack("1");
                  } else if (parseUnitsPerPackInput(unitsPerPack) < 2) {
                    setUnitsPerPack("2");
                  }
                }}
                className="mt-0.5 size-4 rounded border-input"
              />
              <span>
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  Pack / bundle / case
                  <HelpBalloon label="About pack pricing">
                    Charge outside-purchase service &amp; handling per consumer unit: units in
                    each pack × per-unit fee × number of packs.
                  </HelpBalloon>
                </span>
              </span>
            </label>

            <div
              className={cn(
                "grid gap-4",
                isPackLine ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3",
              )}
            >
              <Field>
                <FieldLabel htmlFor="op-qty">
                  {isPackLine ? "Received Qty (packs)" : "Received Qty"}
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="op-qty"
                    type="number"
                    min={1}
                    max={999}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </FieldContent>
              </Field>
              {isPackLine ?
                <Field>
                  <FieldLabelWithHelp
                    htmlFor="op-units-per-pack"
                    label="Units per pack"
                    help="Consumer units in one pack (e.g. 12 for a case, 2 for a twin-pack)."
                    helpLabel="About units per pack"
                  />
                  <FieldContent>
                    <Input
                      id="op-units-per-pack"
                      type="number"
                      min={2}
                      max={9999}
                      value={unitsPerPack}
                      onChange={(e) => setUnitsPerPack(e.target.value)}
                    />
                  </FieldContent>
                </Field>
              : null}
              <Field className={isPackLine ? undefined : "sm:col-span-2"}>
                <FieldLabelWithHelp
                  htmlFor="op-unit-price"
                  label="Listed unit price (USD, for tier only)"
                  help={`Single-item price used to pick the outside-purchase service & handling tier${isPackLine ? " (not pack price)." : "."}`}
                  helpLabel="About listed unit price"
                />
                <FieldContent>
                  <Input
                    id="op-unit-price"
                    inputMode="decimal"
                    value={unitPriceDollars}
                    onChange={(e) => setUnitPriceDollars(e.target.value)}
                    className="tabular-nums"
                    placeholder="0.00"
                  />
                </FieldContent>
              </Field>
            </div>

            {isPackLine && pricingPreview.consumerUnits > 0 ?
              <p className="text-xs text-muted-foreground">
                Total consumer units:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {pricingPreview.consumerUnits}
                </span>{" "}
                ({pricingPreview.unitsPerPack} × {pricingPreview.quantity} pack
                {pricingPreview.quantity === 1 ? "" : "s"})
              </p>
            : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="op-size">Received Size</FieldLabel>
                <FieldContent>
                  <Input
                    id="op-size"
                    value={productSize}
                    onChange={(e) => setProductSize(e.target.value)}
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="op-color">Received Color</FieldLabel>
                <FieldContent>
                  <Input
                    id="op-color"
                    value={productColor}
                    onChange={(e) => setProductColor(e.target.value)}
                  />
                </FieldContent>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="op-condition">
                  Condition product received in
                </FieldLabel>
                <FieldContent>
                  <select
                    id="op-condition"
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
                <FieldLabel htmlFor="op-shelf">Shelf location</FieldLabel>
                <FieldContent>
                  <Input
                    id="op-shelf"
                    value={receivedShelfLocation}
                    onChange={(e) => setReceivedShelfLocation(e.target.value)}
                    placeholder="Aisle, shelf, bin…"
                    autoComplete="off"
                  />
                </FieldContent>
              </Field>
            </div>

            <CollapsibleFieldSection
              title="Receipt details"
              description="Optional inbound note and receipt photo"
              defaultOpen={false}
            >
              <Field>
                <FieldLabel htmlFor="op-receipt-note">Receipt / inbound note</FieldLabel>
                <FieldContent>
                  <textarea
                    id="op-receipt-note"
                    rows={2}
                    value={receiptNote}
                    onChange={(e) => setReceiptNote(e.target.value)}
                    placeholder="Retailer, order number, or handling notes…"
                    className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 flex w-full resize-y rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabel htmlFor="op-receipt-image">Receipt image</FieldLabel>
                <FieldContent>
                <p className="mb-1 text-xs text-muted-foreground">
                  Photo of the retailer receipt or proof of purchase (JPEG, PNG, WebP, or GIF).
                </p>
                <Input
                  id="op-receipt-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => onPickReceiptImage(e.target.files)}
                />
                {receiptImagePreview ?
                  <div className="mt-3 flex items-start gap-3">
                    <ProductRequestThumbnail
                      variant="admin"
                      imageUrl={receiptImagePreview}
                      productLabel="Receipt"
                      className="size-24 shrink-0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReceiptImageFile(null);
                        revokeBlobPreviewUrl(receiptImagePreview);
                        setReceiptImagePreview(null);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                : null}
                </FieldContent>
              </Field>
            </CollapsibleFieldSection>

            <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Customer charge preview
                <HelpBalloon label="About customer charge preview">
                  Outside purchase service &amp; handling only — in-app merchandise, shipping,
                  tax, and in-app service fees are not included.
                </HelpBalloon>
              </p>
              <CartLinePriceBreakdown rows={previewRows} />
            </div>

            <CollapsibleFieldSection
              title="Staff note & product photo"
              description="Optional message for the customer and catalog image"
              defaultOpen={false}
            >
              <Field>
                <FieldLabel htmlFor="op-staff-note">Staff note</FieldLabel>
              <FieldContent>
                <textarea
                  id="op-staff-note"
                  rows={2}
                  value={staffNote}
                  onChange={(e) => setStaffNote(e.target.value)}
                  className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 flex w-full resize-y rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="op-image">Product photo</FieldLabel>
              <FieldContent>
                <p className="mb-2 text-xs text-muted-foreground">
                  JPEG, PNG, WebP, or GIF — choose from your device or take a photo with the
                  camera.
                </p>
                <ImageFileInput
                  id="op-image"
                  onFiles={onPickProductImage}
                  selectedFileName={imageFile?.name ?? null}
                />
              </FieldContent>
            </Field>
            </CollapsibleFieldSection>

            <Button type="button" disabled={saving} onClick={onSubmit} className="w-full sm:w-auto">
              {saving ?
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" aria-hidden />
                  Saving…
                </>
              : "Save product & estimate"}
            </Button>
          </div>

          <div className="flex flex-col items-center gap-3">
            <ProductRequestThumbnail
              variant="admin"
              imageUrl={imagePreview}
              productLabel={productName || "Product"}
              className="size-36"
            />
            {receiptImagePreview ?
              <div className="flex flex-col items-center gap-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Receipt
                </p>
                <ProductRequestThumbnail
                  variant="admin"
                  imageUrl={receiptImagePreview}
                  productLabel="Receipt"
                  className="size-20"
                />
              </div>
            : null}
            <p className="text-center font-mono text-xs text-primary">{reference}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitleWithHelp
          as="h3"
          title="Recent outside purchases"
          titleClassName="text-sm font-semibold text-foreground"
          help="One row per product with its current fulfillment status. Superseded estimates voided when a customer requests a new quote are omitted here; open Active requests to see those lines."
          helpLabel="About recent outside purchases"
          tooltipClassName="w-80"
        />
        {recentRows.length === 0 ?
          <p className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No outside-purchase lines yet.
          </p>
        : <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Ref</th>
                  <th className="px-3 py-2.5 font-medium">Customer</th>
                  <th className="px-3 py-2.5 font-medium">Product</th>
                  <th className="px-3 py-2.5 font-medium">Service due</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentRows.map(({ request: r, userFullName, userEmail }) => {
                  const quote = latestQuotesByRequestId[r.id];
                  const ref =
                    outsidePurchaseReferenceDisplay(r) ?? r.outsidePurchaseReference ?? "—";
                  const returnReq = returnRequestsByItemRequestId[r.id] ?? null;
                  const prompted = Boolean(r.outsidePurchasePaymentPromptedAt);
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="px-3 py-3 font-mono text-xs text-primary">{ref}</td>
                      <td className="max-w-[10rem] px-3 py-3 text-muted-foreground">
                        <span className="line-clamp-2 text-xs">
                          {userFullName?.trim() || userEmail?.trim() || r.clerkUserId}
                        </span>
                      </td>
                      <td className="max-w-[12rem] px-3 py-3">
                        <div className="flex gap-2">
                          <ProductRequestThumbnail
                            variant="admin"
                            imageUrl={r.productImageUrl}
                            productLabel={r.productName}
                          />
                          <div className="min-w-0">
                            <p className="line-clamp-2 font-medium text-foreground">
                              {r.productName?.trim() || "—"}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {displayProductSiteName(r)}
                            </p>
                            {r.outsidePurchaseReceiptImageUrl ?
                              <a
                                href={r.outsidePurchaseReceiptImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-block text-xs text-primary hover:underline"
                              >
                                View receipt
                              </a>
                            : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {quote ? formatUsd(quote.totalPrice) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge
                          kind={itemRequestStatusBadgeKindForDisplay(
                            r,
                            returnReq,
                            orderContextByRequestId[r.id],
                            "admin",
                          )}
                          title={
                            orderContextByRequestId[r.id] ?
                              itemRequestStatusLabelForDisplay(
                                r,
                                returnReq,
                                orderContextByRequestId[r.id],
                                "admin",
                              )
                            : r.status
                          }
                        >
                          {itemRequestStatusLabelForDisplay(
                            r,
                            returnReq,
                            orderContextByRequestId[r.id],
                            "admin",
                          )}
                        </StatusBadge>
                        {prompted ?
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Prompt recorded
                          </p>
                        : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-2">
                          {r.status === "quoted" ?
                            <AdminOutsidePurchaseEditDialog
                              request={r}
                              quote={quote ?? null}
                              outsidePurchaseServiceTiers={outsidePurchaseServiceTiers}
                              returnRequest={returnReq}
                            />
                          : null}
                          <ItemRequestLineAuditDialog
                            itemRequestId={r.id}
                            productLabel={r.productName?.trim() || ""}
                            snapshots={snapshotsByRequestId[r.id] ?? []}
                            triggerLabel="Status records"
                          />
                          {quote ?
                            <QuoteEstimatePreviewDialog
                              itemRequestId={r.id}
                              label="Preview charges"
                            />
                          : null}
                          {r.status === "quoted" ?
                            <Button
                              type="button"
                              size="sm"
                              variant={prompted ? "outline" : "default"}
                              disabled={saving && promptingId === r.id}
                              onClick={() => onRecordPrompt(r.id)}
                            >
                              {saving && promptingId === r.id ?
                                <Loader2Icon className="size-3.5 animate-spin" />
                              : prompted ?
                                "Re-record prompt"
                              : "Record payment prompt"}
                            </Button>
                          : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </FloatingHorizontalScroll>
        }
      </section>
    </div>
  );
}
