"use client";

import {
  productReturnDesiredOutcomeDescription,
  productReturnDesiredOutcomeFieldIntro,
  productReturnDesiredOutcomeFieldLegend,
  productReturnDesiredOutcomeLabel,
  productReturnDesiredOutcomeValues,
  type ProductReturnDesiredOutcome,
  type ProductReturnDesiredOutcomeContext,
} from "@/lib/product-return-desired-outcome";
import { cn } from "@/lib/utils";

export function ProductReturnDesiredOutcomeOptions({
  value,
  onChange,
  disabled,
  namePrefix,
  context = "default",
}: {
  value: ProductReturnDesiredOutcome | null;
  onChange: (next: ProductReturnDesiredOutcome) => void;
  disabled?: boolean;
  namePrefix: string;
  context?: ProductReturnDesiredOutcomeContext;
}) {
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">
        {productReturnDesiredOutcomeFieldLegend(context)}
      </legend>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {productReturnDesiredOutcomeFieldIntro(context)}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Additional service, shipping, or price-difference charges may apply
        depending on the retailer. Our team will confirm any extra charges before
        billing.
      </p>
      <div className="grid gap-2.5">
        {productReturnDesiredOutcomeValues.map((outcome) => {
          const selected = value === outcome;
          const id = `${namePrefix}-outcome-${outcome}`;
          return (
            <label
              key={outcome}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border p-3.5 transition-colors",
                selected ?
                  "border-primary/60 bg-primary/8 ring-1 ring-primary/30"
                : "border-border/80 bg-background hover:border-primary/35 hover:bg-muted/40",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                id={id}
                type="radio"
                name={`${namePrefix}-desired-outcome`}
                className="mt-1 shrink-0"
                checked={selected}
                onChange={() => onChange(outcome)}
                disabled={disabled}
              />
              <span className="min-w-0 space-y-1">
                <span className="block text-sm font-medium leading-snug text-foreground">
                  {productReturnDesiredOutcomeLabel(outcome, context)}
                </span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  {productReturnDesiredOutcomeDescription(outcome, context)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ProductReturnDesiredOutcomeSummary({
  outcome,
  context = "default",
}: {
  outcome: ProductReturnDesiredOutcome | null | undefined;
  context?: ProductReturnDesiredOutcomeContext;
}) {
  if (!outcome) {
    return (
      <span className="text-muted-foreground">Outcome not recorded</span>
    );
  }
  return (
    <span className="text-foreground">
      {productReturnDesiredOutcomeLabel(outcome, context)}
    </span>
  );
}
