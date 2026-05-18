"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type CollapsibleOrderBatchBucketProps = {
  colSpan: number;
  title: ReactNode;
  muted?: boolean;
  headerAside?: ReactNode;
  estimateSummary?: ReactNode;
  trailing?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CollapsibleOrderBatchBucket({
  colSpan,
  title,
  muted = false,
  headerAside,
  estimateSummary,
  trailing,
  defaultOpen = true,
  children,
}: CollapsibleOrderBatchBucketProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <tr className={muted ? "bg-background/60" : "bg-primary/[0.06]"}>
        <td className="px-3 py-1.5" colSpan={colSpan}>
          <div className="space-y-0">
            <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
              <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={open}
                aria-label={open ? "Hide section lines" : "Show section lines"}
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform duration-200",
                    open ? "rotate-0" : "-rotate-90",
                  )}
                  aria-hidden
                />
              </button>
              <div className="min-w-0 flex-1 space-y-0">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <div
                    className={cn(
                      "min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-wide",
                      muted ? "text-muted-foreground" : "text-foreground/90",
                    )}
                  >
                    {title}
                  </div>
                  {headerAside ?
                    <div className="shrink-0 normal-case">{headerAside}</div>
                  : null}
                  {trailing ?
                    <div className="shrink-0 normal-case">{trailing}</div>
                  : null}
                </div>
                {open && estimateSummary ?
                  <div className="mt-2 normal-case">{estimateSummary}</div>
                : null}
              </div>
            </div>
          </div>
        </td>
      </tr>
      {open ? children : null}
    </>
  );
}
