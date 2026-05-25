"use client";

import {
  productReturnDesiredOutcomeDescription,
  productReturnDesiredOutcomeLabel,
  productReturnDesiredOutcomeValues,
  type ProductReturnDesiredOutcome,
} from "@/lib/product-return-desired-outcome";
import { cn } from "@/lib/utils";

export function ProductReturnDesiredOutcomeOptions({
  value,
  onChange,
  disabled,
  namePrefix,
}: {
  value: ProductReturnDesiredOutcome | null;
  onChange: (next: ProductReturnDesiredOutcome) => void;
  disabled?: boolean;
  namePrefix: string;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">
        What do you want after the return?
      </legend>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Cart2Barrel staff handle the physical return and shipping. Additional
        service, shipping, or price-difference charges may or may not apply
        depending on the retailer and your choice below — staff will confirm
        before any extra charge.
      </p>
      <div className="grid gap-2">
        {productReturnDesiredOutcomeValues.map((outcome) => {
          const selected = value === outcome;
          const id = `${namePrefix}-outcome-${outcome}`;
          return (
            <label
              key={outcome}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                selected ?
                  "border-primary bg-primary/10 ring-1 ring-primary/40"
                : "border-border bg-muted hover:border-primary/40",
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
                <span className="block text-sm font-medium text-foreground">
                  {productReturnDesiredOutcomeLabel(outcome)}
                </span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  {productReturnDesiredOutcomeDescription(outcome)}
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
}: {
  outcome: ProductReturnDesiredOutcome | null | undefined;
}) {
  if (!outcome) {
    return (
      <span className="text-muted-foreground">Outcome not recorded</span>
    );
  }
  return (
    <span className="text-foreground">
      {productReturnDesiredOutcomeLabel(outcome)}
    </span>
  );
}
