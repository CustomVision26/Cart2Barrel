"use client";

import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  MAX_QUOTE_EXPIRY_MINUTES,
  MIN_QUOTE_EXPIRY_MINUTES,
  type QuoteExpiryDurationUnit,
} from "@/lib/quote-expiry";

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type AdminQuoteExpiryDurationFieldsProps = {
  idPrefix: string;
  neverExpires: boolean;
  onNeverExpiresChange: (next: boolean) => void;
  amount: string;
  onAmountChange: (next: string) => void;
  unit: QuoteExpiryDurationUnit;
  onUnitChange: (next: QuoteExpiryDurationUnit) => void;
  disabled?: boolean;
  durationHint?: string;
};

export function AdminQuoteExpiryDurationFields({
  idPrefix,
  neverExpires,
  onNeverExpiresChange,
  amount,
  onAmountChange,
  unit,
  onUnitChange,
  disabled = false,
  durationHint,
}: AdminQuoteExpiryDurationFieldsProps) {
  const neverId = `${idPrefix}-never`;
  const amountId = `${idPrefix}-amount`;

  return (
    <>
      <Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FieldLabel htmlFor={neverId} className="cursor-pointer">
            Do not expire quotes
          </FieldLabel>
          <Switch
            id={neverId}
            checked={neverExpires}
            onCheckedChange={onNeverExpiresChange}
            disabled={disabled}
            aria-describedby={`${neverId}-hint`}
          />
        </div>
        <FieldContent>
          <p id={`${neverId}-hint`} className="text-xs text-muted-foreground">
            Turn this on so quoted prices at this level stay valid with no
            accept/pay deadline. Duration below is unused while this is on.
          </p>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel htmlFor={amountId}>Time until quote expires</FieldLabel>
        <FieldContent>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={amountId}
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="max-w-[10rem] tabular-nums"
              disabled={disabled || neverExpires}
            />
            <select
              aria-label="Expiry duration unit"
              className={SELECT_CLASS}
              value={unit}
              disabled={disabled || neverExpires}
              onChange={(e) =>
                onUnitChange(e.target.value as QuoteExpiryDurationUnit)
              }
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {durationHint ??
              `From ${MIN_QUOTE_EXPIRY_MINUTES} minute to 90 days (${MAX_QUOTE_EXPIRY_MINUTES.toLocaleString()} minutes).`}
          </p>
        </FieldContent>
      </Field>
    </>
  );
}
