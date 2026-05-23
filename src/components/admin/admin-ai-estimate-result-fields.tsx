"use client";

import { ExternalLinkIcon } from "lucide-react";

import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { AdminAiEstimateSuccess } from "@/actions/admin-ai-estimate";
import { AdminItemRequestProductImageUpload } from "@/components/admin/admin-item-request-product-image-upload";
import { AdminProductImagePreview } from "@/components/admin/admin-product-image-preview";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

const estimateNoteTextareaClassName = cn(
  "border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 flex w-full resize-y rounded-lg border px-2.5 py-2 text-sm transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
);

/** Merchandise/service cents from pack line model (see computePackLineMerchandiseAndServiceCents). */
export type AiPackDerivedTotals = {
  /** Merchandise after savings (pack line net). */
  merch: number;
  /** Listed pack × pack count before savings. */
  packBundle: number;
  /** Savings deducted from pack bundle for merchandise (cents). */
  savingsCents: number;
  packListedSubtotalCents: number;
  serv: number;
  ship: number;
  tax: number;
  total: number;
  packCount: number;
  upp: number;
  packCents: number;
  enteredPackCents: number;
  includePackPriceInEstimate: boolean;
  impliedConsumerUnitCents: number | null;
  effectiveConsumerUnitCents: number | null;
  usesUnitOverride: boolean;
};

type AdminAiEstimateResultFieldsProps = {
  result: AdminAiEstimateSuccess;
  derived: AiPackDerivedTotals;
  editPackPriceDollars: string;
  setEditPackPriceDollars: (v: string) => void;
  includePackPriceInEstimate: boolean;
  setIncludePackPriceInEstimate: (v: boolean) => void;
  unitsPerPack: string;
  setUnitsPerPack: (v: string) => void;
  editConsumerUnitOverrideDollars: string;
  setEditConsumerUnitOverrideDollars: (v: string) => void;
  editShippingDollars: string;
  setEditShippingDollars: (v: string) => void;
  editTaxDollars: string;
  setEditTaxDollars: (v: string) => void;
  editSavingsDollars: string;
  setEditSavingsDollars: (v: string) => void;
  /** Retailer-listed shipping/tax bundled into merchandise; line splits stay $0. */
  merchandiseIncludesSiteShippingTax: boolean;
  setMerchandiseIncludesSiteShippingTax: (v: boolean) => void;
  idPrefix: string;
  /** When set, enables manual Blob upload if AI did not return an image. */
  itemRequestId?: string;
  /** Manual or persisted image URL (wins over AI extraction URL for display). */
  productImageUrl?: string | null;
  onProductImageUploaded?: (imageUrl: string) => void;
  /** Stage upload locally; parent persists on save quote. */
  deferProductImagePersist?: boolean;
  onProductImageStaged?: (file: File, previewUrl: string) => void;
  editStaffNote: string;
  setEditStaffNote: (v: string) => void;
  /** Edit-quote: editable product title (replaces read-only extracted name). */
  editProductName?: string;
  setEditProductName?: (v: string) => void;
  /** Edit-quote: customer line quantity saved on the request (distinct from pack count in parent). */
  editCustomerQuantity?: string;
  setEditCustomerQuantity?: (v: string) => void;
  /** Show upload control even when an image is already displayed. */
  alwaysShowImageUpload?: boolean;
  /** Optional product URL shown under editable title. */
  productUrl?: string;
  /** Omit top separator (edit dialog provides section chrome). */
  hideLeadingSeparator?: boolean;
  /** Tighter cards and layout tuned for Edit quote. */
  polishedEditLayout?: boolean;
};

/**
 * Shared UI after a successful AI extraction: image, extracted facts, pack pricing,
 * service explanation, editable shipping/tax, totals. Used by AI estimate dialog and
 * edit saved quote dialog.
 */
export function AdminAiEstimateResultFields({
  result,
  derived,
  editPackPriceDollars,
  setEditPackPriceDollars,
  includePackPriceInEstimate,
  setIncludePackPriceInEstimate,
  unitsPerPack,
  setUnitsPerPack,
  editConsumerUnitOverrideDollars,
  setEditConsumerUnitOverrideDollars,
  editShippingDollars,
  setEditShippingDollars,
  editTaxDollars,
  setEditTaxDollars,
  editSavingsDollars,
  setEditSavingsDollars,
  merchandiseIncludesSiteShippingTax,
  setMerchandiseIncludesSiteShippingTax,
  idPrefix,
  itemRequestId,
  productImageUrl,
  onProductImageUploaded,
  deferProductImagePersist = false,
  onProductImageStaged,
  editStaffNote,
  setEditStaffNote,
  editProductName,
  setEditProductName,
  editCustomerQuantity,
  setEditCustomerQuantity,
  alwaysShowImageUpload = false,
  productUrl,
  hideLeadingSeparator = false,
  polishedEditLayout = false,
}: AdminAiEstimateResultFieldsProps) {
  const displayImageUrl =
    productImageUrl?.trim() || result.extraction.productImageUrl?.trim() || null;
  const showEditableProduct = setEditProductName != null && editProductName != null;
  const sectionCard = polishedEditLayout
    ? "rounded-xl border border-border bg-card/40 p-4 shadow-sm"
    : "space-y-3 rounded-lg border border-border bg-muted/15 p-3";

  return (
    <div
      className={cn("space-y-4 text-sm", polishedEditLayout && "space-y-5")}
    >
      {!hideLeadingSeparator ? <Separator /> : null}
      {displayImageUrl ? (
        <div
          className={cn(
            polishedEditLayout && alwaysShowImageUpload && itemRequestId
              ? "grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              : "space-y-2",
          )}
        >
        <AdminProductImagePreview
          imageUrl={displayImageUrl}
          productLabel={
            showEditableProduct ? editProductName : result.extraction.productName
          }
          productUrl={productUrl}
          frameClassName={polishedEditLayout ? "rounded-xl" : "rounded-lg"}
          imageClassName={polishedEditLayout ? "max-h-44" : "max-h-52"}
        />
        {alwaysShowImageUpload && itemRequestId ? (
          <div
            className={cn(
              "flex flex-col justify-center gap-2",
              polishedEditLayout && "sm:min-w-[9.5rem]",
            )}
          >
            <p className="text-xs font-medium text-foreground">Replace photo</p>
            <AdminItemRequestProductImageUpload
              itemRequestId={itemRequestId}
              deferPersist={deferProductImagePersist}
              onStaged={onProductImageStaged}
              onUploaded={onProductImageUploaded}
            />
          </div>
        ) : null}
        </div>
      ) : (
        <div
          className={cn(
            "space-y-3 border border-dashed border-border px-3 py-5",
            polishedEditLayout ? "rounded-xl bg-card/30" : "rounded-lg",
          )}
        >
          <p className="text-center text-xs text-muted-foreground">
            No product image on file. Upload one below or run AI extraction.
          </p>
          {itemRequestId ? (
            <AdminItemRequestProductImageUpload
              itemRequestId={itemRequestId}
              deferPersist={deferProductImagePersist}
              onStaged={onProductImageStaged}
              onUploaded={onProductImageUploaded}
            />
          ) : null}
        </div>
      )}
      <div
        className={cn(
          showEditableProduct && polishedEditLayout ? sectionCard : "space-y-3",
        )}
      >
        <p
          className={cn(
            "font-medium text-foreground",
            polishedEditLayout && showEditableProduct && "mb-3 text-sm",
          )}
        >
          {showEditableProduct ? "Product details" : "Extracted"}
        </p>
        {showEditableProduct ? (
          <div className="space-y-3">
            <Field className="gap-1.5">
              <FieldLabel htmlFor={`${idPrefix}-product-name`} className="text-xs">
                Product name
              </FieldLabel>
              <FieldContent>
                <Input
                  id={`${idPrefix}-product-name`}
                  value={editProductName}
                  onChange={(e) => setEditProductName(e.target.value)}
                  placeholder="e.g. Crewneck sweatshirt"
                  autoComplete="off"
                />
              </FieldContent>
            </Field>
            {productUrl ? (
              polishedEditLayout ? (
                <a
                  href={productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-primary underline-offset-2 hover:underline"
                  title={productUrl}
                >
                  <span className="truncate">Open product listing</span>
                  <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
                </a>
              ) : (
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={productUrl}
                >
                  {productUrl}
                </p>
              )
            ) : null}
            {setEditCustomerQuantity != null && editCustomerQuantity != null ? (
              <Field className="gap-1.5">
                <FieldLabel htmlFor={`${idPrefix}-customer-qty`} className="text-xs">
                  Quantity
                </FieldLabel>
                <FieldContent>
                  <Input
                    id={`${idPrefix}-customer-qty`}
                    type="number"
                    min={1}
                    max={999}
                    className="max-w-28"
                    value={editCustomerQuantity}
                    onChange={(e) => setEditCustomerQuantity(e.target.value)}
                    autoComplete="off"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    How many the customer wants. Updates pack subtotal, service
                    tiers, and the qty shown on their request.
                  </p>
                </FieldContent>
              </Field>
            ) : null}
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground">Site:</span>{" "}
              {result.extraction.siteName?.trim() || "—"}
            </p>
          </div>
        ) : (
        <ul className="space-y-0.5 text-muted-foreground">
          <li>
            <span className="text-foreground">Name:</span>{" "}
            {result.extraction.productName ?? "—"}
          </li>
          <li>
            <span className="text-foreground">Site:</span>{" "}
            {result.extraction.siteName?.trim() || "—"}
          </li>
          <li>
            <span className="text-foreground">AI unit price (hint):</span>{" "}
            {formatUsd(result.unitPriceCents)}{" "}
            <span className="text-xs">
              (often one SKU; adjust pack price if the listing is a bundle or case)
            </span>
          </li>
        </ul>
        )}
        {result.extraction.notes ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">AI notes:</span>{" "}
            {result.extraction.notes}
          </p>
        ) : null}
      </div>

      <div className={cn("space-y-3", sectionCard)}>
        <p className="text-sm font-medium text-foreground">Pack / bundle / case pricing</p>
        <Field className="gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FieldLabel htmlFor={`${idPrefix}-pack-price`} className="text-xs">
              Pack price (USD)
            </FieldLabel>
            <label
              htmlFor={`${idPrefix}-include-pack-in-estimate`}
              className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
            >
              <input
                id={`${idPrefix}-include-pack-in-estimate`}
                type="checkbox"
                checked={includePackPriceInEstimate}
                onChange={(e) => setIncludePackPriceInEstimate(e.target.checked)}
                className="border-input text-primary focus-visible:ring-ring size-4 shrink-0 rounded"
              />
              Add to estimate
            </label>
          </div>
          <FieldContent>
            <p className="mb-1 text-xs text-muted-foreground">
              Price for{" "}
              <span className="font-medium text-foreground">one</span> pack at that
              tier—single item, twin-pack, case, etc. AI often returns per-item cost;
              bump this to the bundle or case price when the site sells that way. Check{" "}
              <span className="font-medium text-foreground">Add to estimate</span> to
              include this pack price in totals (pack × quantity and implied unit when
              no consumer unit override). Uncheck to omit pack price from the estimate
              and rely on consumer unit price if set.
            </p>
            <div className="relative max-w-xs">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                $
              </span>
              <Input
                id={`${idPrefix}-pack-price`}
                className="pl-6"
                inputMode="decimal"
                value={editPackPriceDollars}
                onChange={(e) => setEditPackPriceDollars(e.target.value)}
                autoComplete="off"
              />
            </div>
          </FieldContent>
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`${idPrefix}-units-per-pack`} className="text-xs">
            Consumer units per pack
          </FieldLabel>
          <FieldContent>
            <p className="mb-1 text-xs text-muted-foreground">
              How many consumer units are included in one pack at that price (e.g.{" "}
              <span className="whitespace-nowrap">10</span> for a 10-count case,{" "}
              <span className="whitespace-nowrap">2</span> for a two-bag bundle,{" "}
              <span className="whitespace-nowrap">1</span> if this price is already for
              a single item).
            </p>
            <Input
              id={`${idPrefix}-units-per-pack`}
              type="number"
              min={1}
              max={9999}
              className="max-w-28"
              value={unitsPerPack}
              onChange={(e) => setUnitsPerPack(e.target.value)}
              autoComplete="off"
            />
          </FieldContent>
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`${idPrefix}-consumer-unit-override`} className="text-xs">
            Consumer unit price on site (optional)
          </FieldLabel>
          <FieldContent>
            <p className="mb-1 text-xs text-muted-foreground">
              When the listing shows a different{" "}
              <span className="font-medium text-foreground">single-unit</span> price than
              pack price ÷ units per pack, enter it here to drive{" "}
              <span className="font-medium text-foreground">
                service &amp; handling tiers
              </span>{" "}
              only.{" "}
              <span className="font-medium text-foreground">Merchandise subtotal</span>{" "}
              stays pack price × quantity (when Add to estimate is checked). Leave blank
              to tier service using the implied unit from the pack line.
            </p>
            <div className="relative max-w-xs">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                $
              </span>
              <Input
                id={`${idPrefix}-consumer-unit-override`}
                className="pl-6"
                inputMode="decimal"
                placeholder="—"
                value={editConsumerUnitOverrideDollars}
                onChange={(e) => setEditConsumerUnitOverrideDollars(e.target.value)}
                autoComplete="off"
              />
            </div>
          </FieldContent>
        </Field>
        {derived.impliedConsumerUnitCents != null && !derived.usesUnitOverride ? (
          <p className="text-xs text-muted-foreground">
            Implied per unit (from pack):{" "}
            <span className="font-medium tabular-nums text-foreground">
              {formatUsd(derived.impliedConsumerUnitCents)}
            </span>{" "}
            (used for service tiers when no unit override)
          </p>
        ) : null}
        {derived.usesUnitOverride ? (
          <p className="text-xs text-muted-foreground">
            Consumer unit for service tiers:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {formatUsd(derived.effectiveConsumerUnitCents)}
            </span>{" "}
            (override; implied from pack would be{" "}
            {formatUsd(derived.impliedConsumerUnitCents)})
          </p>
        ) : null}
      </div>

      <div className={cn(polishedEditLayout && sectionCard)}>
        <p className="font-medium text-foreground">Service &amp; handling</p>
        <p className="text-xs text-muted-foreground">
          {derived.effectiveConsumerUnitCents != null &&
          derived.effectiveConsumerUnitCents > 0 &&
          derived.packCount > 0 ? (
            <>
              Tiered fee using{" "}
              <span className="font-medium text-foreground">
                {derived.usesUnitOverride ? "your unit override" : "implied unit from pack"}
              </span>
              . Total:{" "}
              <span className="font-medium text-foreground">
                {formatUsd(derived.serv)}
              </span>{" "}
              ({derived.packCount * derived.upp} consumer units at{" "}
              {formatUsd(derived.effectiveConsumerUnitCents)} each for tiering).
            </>
          ) : (
            "Enter pack price (with Add to estimate checked), or set a consumer unit price."
          )}
        </p>
      </div>

      <div className={cn(polishedEditLayout && sectionCard)}>
        <p className="mb-2 font-medium text-foreground">Estimate (USD)</p>
        <div
          className={cn(
            "space-y-2",
            polishedEditLayout
              ? "rounded-lg border border-border/80 bg-muted/25 p-3"
              : "rounded-lg border border-border bg-muted/20 p-3",
          )}
        >
          <div className="flex justify-between gap-2 tabular-nums text-muted-foreground">
            <span>Pack / bundle subtotal (in estimate)</span>
            <span className="text-foreground">{formatUsd(derived.packBundle)}</span>
          </div>
          {!derived.includePackPriceInEstimate &&
          derived.packListedSubtotalCents > 0 ? (
            <p className="text-xs text-muted-foreground">
              Listed pack × qty (not in estimate):{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatUsd(derived.packListedSubtotalCents)}
              </span>
            </p>
          ) : null}
          <Field className="gap-1.5">
            <FieldLabel htmlFor={`${idPrefix}-savings`} className="text-xs">
              Savings
            </FieldLabel>
            <FieldContent>
              <p className="mb-1 text-xs text-muted-foreground">
                Deduction from{" "}
                <span className="font-medium text-foreground">
                  pack / bundle subtotal
                </span>{" "}
                (promo, bundle discount, instant savings on the listing). This reduces{" "}
                <span className="font-medium text-foreground">
                  merchandise subtotal (pack line)
                </span>{" "}
                only—not service tier math.
              </p>
              <div className="relative max-w-xs">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                  $
                </span>
                <Input
                  id={`${idPrefix}-savings`}
                  className="pl-6"
                  inputMode="decimal"
                  value={editSavingsDollars}
                  onChange={(e) => setEditSavingsDollars(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </FieldContent>
          </Field>
          <p className="text-xs text-muted-foreground">
            Pack price × pack qty in the total only when{" "}
            <span className="font-medium text-foreground">Add to estimate</span> is
            checked. Merchandise follows the pack line only; consumer unit price affects
            service fees only.
          </p>
          <div className="flex justify-between gap-2 border-t border-border pt-2 tabular-nums text-muted-foreground">
            <span>Merchandise subtotal (pack line)</span>
            <span className="font-medium text-foreground">
              {formatUsd(derived.merch)}
            </span>
          </div>
          <div className="flex justify-between gap-2 tabular-nums text-muted-foreground">
            <span>Service &amp; handling</span>
            <span className="text-foreground">{formatUsd(derived.serv)}</span>
          </div>
          <Field className="gap-1.5">
            <FieldLabel htmlFor={`${idPrefix}-shipping`} className="text-xs">
              Shipping (flat)
            </FieldLabel>
            <FieldContent>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                  $
                </span>
                <Input
                  id={`${idPrefix}-shipping`}
                  className="pl-6"
                  inputMode="decimal"
                  value={editShippingDollars}
                  onChange={(e) => setEditShippingDollars(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </FieldContent>
          </Field>
          <Field className="gap-1.5">
            <FieldLabel htmlFor={`${idPrefix}-tax`} className="text-xs">
              Tax
            </FieldLabel>
            <FieldContent>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground">
                  $
                </span>
                <Input
                  id={`${idPrefix}-tax`}
                  className="pl-6"
                  inputMode="decimal"
                  value={editTaxDollars}
                  onChange={(e) => setEditTaxDollars(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Not auto-updated when you edit pricing—adjust if needed.
              </p>
            </FieldContent>
          </Field>
          <label
            htmlFor={`${idPrefix}-merch-includes-site-fees`}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background/80 px-2.5 py-2 text-xs text-muted-foreground"
          >
            <input
              id={`${idPrefix}-merch-includes-site-fees`}
              type="checkbox"
              checked={merchandiseIncludesSiteShippingTax}
              onChange={(e) => setMerchandiseIncludesSiteShippingTax(e.target.checked)}
              className="border-input text-primary focus-visible:ring-ring mt-0.5 size-4 shrink-0 rounded"
            />
            <span>
              Retailer-listed <span className="font-medium text-foreground">shipping &amp; sale tax</span>{" "}
              are bundled into merchandise above ($0 quoted on this line for those splits).
            </span>
          </label>
          {!polishedEditLayout ? (
            <div className="flex justify-between gap-2 border-t border-border pt-2 font-medium tabular-nums text-foreground">
              <span>Total</span>
              <span>{formatUsd(derived.total)}</span>
            </div>
          ) : (
            <p className="border-t border-border pt-2 text-xs text-muted-foreground">
              Line-item total is shown in the footer before you save.
            </p>
          )}
        </div>
      </div>

      <Field className={cn("gap-1.5", polishedEditLayout && sectionCard)}>
        <FieldLabel htmlFor={`${idPrefix}-staff-note`} className="text-xs">
          Estimate note{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <FieldContent>
          <p className="mb-1 text-xs text-muted-foreground">
            Explain charges, product condition, substitutions, or other details the
            shopper should know. Saved with the quote.
          </p>
          <textarea
            id={`${idPrefix}-staff-note`}
            rows={3}
            value={editStaffNote}
            onChange={(e) => setEditStaffNote(e.target.value)}
            placeholder="e.g. Case pack only; price includes retailer shipping; allow 2-week lead time…"
            className={estimateNoteTextareaClassName}
            autoComplete="off"
          />
        </FieldContent>
      </Field>
    </div>
  );
}
