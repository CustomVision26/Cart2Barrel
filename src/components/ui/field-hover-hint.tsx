"use client";

import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FieldHoverHintProps = {
  show: boolean;
  id?: string;
  children: ReactNode;
  className?: string;
  /** Where the downward arrow sits along the bottom edge of the callout. */
  arrowAlign?: "left" | "center";
  /** Center the bubble above a narrow control (e.g. price input). */
  anchor?: "start" | "center";
  onDismiss?: () => void;
  dismissLabel?: string;
};

/** Auto-visible callout above a field with a pointer arrow toward the control below. */
export function FieldHoverHint({
  show,
  id,
  children,
  className,
  arrowAlign = "left",
  anchor = "start",
  onDismiss,
  dismissLabel = "Dismiss message",
}: FieldHoverHintProps) {
  if (!show) return null;

  return (
    <div
      id={id}
      role="status"
      className={cn(
        "absolute bottom-full z-30 mb-2.5 w-[min(20rem,calc(100vw-3rem))]",
        anchor === "center" ?
          "left-1/2 -translate-x-1/2"
        : "left-0",
        className,
      )}
    >
      <div
        className={cn(
          "relative rounded-lg border border-border bg-white py-2.5 pl-3 text-xs leading-relaxed text-zinc-900 shadow-md [&_.text-foreground]:text-zinc-900",
          onDismiss ? "pr-9" : "pr-3",
          "animate-in fade-in-0 zoom-in-95 duration-200",
        )}
      >
        {onDismiss ?
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            className="absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XIcon className="size-3.5" aria-hidden />
          </button>
        : null}
        {children}
      </div>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -bottom-2 size-3 rotate-45 border-b border-r border-border bg-white shadow-sm",
          arrowAlign === "center" ? "left-1/2 -translate-x-1/2" : "left-6",
        )}
      />
    </div>
  );
}
