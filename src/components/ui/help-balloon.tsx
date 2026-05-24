"use client";

import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function HelpBalloon({
  label,
  children,
  className,
  tooltipClassName,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  tooltipClassName?: string;
}) {
  return (
    <span className={cn("group/help relative inline-flex align-middle", className)}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:border-primary/50 hover:text-primary focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <InfoIcon className="size-3" aria-hidden />
      </button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 top-full z-40 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-lg group-focus-within/help:block group-hover/help:block",
          tooltipClassName,
        )}
      >
        {children}
      </span>
    </span>
  );
}
