"use client";

import type { ReactNode } from "react";

import { FieldLabel } from "@/components/ui/field";
import { HelpBalloon } from "@/components/ui/help-balloon";
import { cn } from "@/lib/utils";

export function FieldLabelWithHelp({
  htmlFor,
  label,
  help,
  helpLabel,
  className,
  tooltipClassName,
}: {
  htmlFor?: string;
  label: ReactNode;
  help?: ReactNode;
  helpLabel?: string;
  className?: string;
  tooltipClassName?: string;
}) {
  return (
    <FieldLabel
      htmlFor={htmlFor}
      className={cn("inline-flex items-center gap-1.5 text-xs", className)}
    >
      {label}
      {help ?
        <HelpBalloon
          label={helpLabel ?? `About ${typeof label === "string" ? label : "this field"}`}
          tooltipClassName={tooltipClassName}
        >
          {help}
        </HelpBalloon>
      : null}
    </FieldLabel>
  );
}
