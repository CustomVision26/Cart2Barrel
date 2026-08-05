"use client";

import { useId } from "react";

import { inputFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type MerchandiseTopupMessageTemplateId =
  | "informing"
  | "agree_to_pay"
  | "completed_checkout";

type MerchandiseTopupMessageTemplateSelectProps = {
  disabled?: boolean;
  /** Show Agree to pay (top-up charge / customer agreed). */
  showAgreeToPay?: boolean;
  /** Show Completed checkout (customer paid a top-up). */
  showCompletedCheckout?: boolean;
  onSelect: (templateId: MerchandiseTopupMessageTemplateId) => void;
  className?: string;
};

/**
 * Dropdown beside Send reply — fills the compose textarea with a top-up
 * situation template (Informing / Agree to pay / Completed checkout).
 */
export function MerchandiseTopupMessageTemplateSelect({
  disabled = false,
  showAgreeToPay = false,
  showCompletedCheckout = false,
  onSelect,
  className,
}: MerchandiseTopupMessageTemplateSelectProps) {
  const selectId = useId();

  return (
    <div className={cn("flex min-w-[10.5rem] flex-col gap-0.5", className)}>
      <Label
        htmlFor={selectId}
        className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
      >
        Auto message
      </Label>
      <select
        id={selectId}
        disabled={disabled}
        defaultValue=""
        className={cn(inputFieldClassName, "h-8 text-xs")}
        onChange={(e) => {
          const value = e.target.value as MerchandiseTopupMessageTemplateId | "";
          if (!value) return;
          onSelect(value);
          e.target.value = "";
        }}
        aria-label="Insert top-up message template"
      >
        <option value="" disabled>
          Choose template…
        </option>
        <option value="informing">1. Informing message</option>
        {showAgreeToPay ?
          <option value="agree_to_pay">2. Agree to pay</option>
        : null}
        {showCompletedCheckout ?
          <option value="completed_checkout">3. Completed checkout</option>
        : null}
      </select>
    </div>
  );
}
