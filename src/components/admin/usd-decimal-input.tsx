"use client";

import { Input, inputFieldClassName } from "@/components/ui/input";
import {
  normalizeUsdInputOnBlur,
  sanitizeUsdInput,
} from "@/lib/service-handling-tier-form";
import { cn } from "@/lib/utils";

type UsdDecimalInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  "aria-label"?: string;
};

export function UsdDecimalInput({
  value,
  onChange,
  onBlur,
  className,
  "aria-label": ariaLabel,
}: UsdDecimalInputProps) {
  return (
    <Input
      inputMode="decimal"
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(sanitizeUsdInput(event.target.value))}
      onBlur={() => {
        onChange(normalizeUsdInputOnBlur(value));
        onBlur?.();
      }}
      className={cn(inputFieldClassName, "h-9 py-1", className)}
    />
  );
}
