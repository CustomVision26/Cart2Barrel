"use client";

import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { AdminAiEstimateSuccess } from "@/actions/admin-ai-estimate";
import { formatUsd } from "@/lib/admin-markup";

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
}: AdminAiEstimateResultFieldsProps) {
  return (
    <div className="space-y-4 text-sm">
      <Separator />
      {result.extraction.productImageUrl ? (
        <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element -- external retailer URLs */}
          <img
            src={result.extraction.productImageUrl}
            alt={
              result.extraction.productName?.trim()
                ? `Product: ${result.extraction.productName.trim()}`
                : "Product image from listing"
            }
            className="mx-auto max-h-52 w-full object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          No product image found on this page (try another listing or check OG tags).
        </p>
      )}
      <div className="space-y-3">
        <p className="font-medium text-foreground">Extracted</p>
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
        {result.extraction.notes ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">AI notes:</span>{" "}
            {result.extraction.notes}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted/15 p-3">
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

      <div>
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

      <div>
        <p className="mb-2 font-medium text-foreground">Estimate (USD)</p>
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
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
          <div className="flex justify-between gap-2 border-t border-border pt-2 font-medium tabular-nums text-foreground">
            <span>Total</span>
            <span>{formatUsd(derived.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
