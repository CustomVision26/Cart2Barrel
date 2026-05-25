"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type CollapsibleFieldSectionProps = {
  title: string;
  description?: string;
  /** When true, uses tighter spacing for table cells and dense forms. */
  compact?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function CollapsibleFieldSection({
  title,
  description,
  compact = false,
  defaultOpen = true,
  children,
  className,
  id: idProp,
}: CollapsibleFieldSectionProps) {
  const autoId = useId();
  const panelId = idProp ?? `collapsible-field-${autoId}`;
  const headingId = `${panelId}-heading`;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm ring-1 ring-foreground/5",
        compact && "rounded-md shadow-none",
        className,
      )}
    >
      <button
        type="button"
        id={headingId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-2 text-left transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          compact ? "px-2.5 py-2" : "px-3 py-2.5",
        )}
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block font-medium text-foreground",
              compact ? "text-xs" : "text-sm",
            )}
          >
            {title}
          </span>
          {description ?
            <span
              className={cn(
                "mt-0.5 block text-muted-foreground",
                compact ? "text-[10px] leading-snug" : "text-xs leading-snug",
              )}
            >
              {description}
            </span>
          : null}
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md border border-border/80 bg-card font-medium text-muted-foreground",
            compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
          )}
          aria-hidden
        >
          {open ? "Hide" : "Show"}
          {open ?
            <ChevronUp className={compact ? "size-3" : "size-3.5"} />
          : <ChevronDown className={compact ? "size-3" : "size-3.5"} />}
        </span>
        <span className="sr-only">
          {open ? "Hide" : "Show"} {title}
        </span>
      </button>
      {open ?
        <div
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          className={cn(
            "border-t border-border",
            compact ? "space-y-2 p-2.5" : "space-y-3 p-3",
          )}
        >
          {children}
        </div>
      : null}
    </div>
  );
}
