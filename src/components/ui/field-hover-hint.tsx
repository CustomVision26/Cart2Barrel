"use client";

import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FieldHintBaseProps = {
  show: boolean;
  id?: string;
  children: ReactNode;
  className?: string;
  prominent?: boolean;
  onDismiss?: () => void;
  dismissLabel?: string;
};

type FieldHoverHintProps = FieldHintBaseProps & {
  /** Where the arrow sits on the bubble edge pointing at the control. */
  arrowAlign?: "left" | "center";
  /** Center the bubble on a narrow control (e.g. price input). */
  anchor?: "start" | "center";
  /** Widen the bubble without centering on a narrow anchor (fixed readable width). */
  inFrame?: boolean;
  /** Place callout above or below the anchored control. */
  placement?: "above" | "below";
};

function FieldHintSurface({
  id,
  children,
  className,
  prominent = false,
  onDismiss,
  dismissLabel = "Dismiss message",
}: Omit<FieldHintBaseProps, "show">) {
  return (
    <div
      id={id}
      role="status"
      className={cn(
        "relative rounded-lg border bg-white py-3 pl-3.5 leading-relaxed text-zinc-900 [&_.text-foreground]:text-zinc-900",
        prominent ?
          "border-primary/50 text-sm shadow-lg ring-2 ring-primary/25"
        : "border-border text-xs shadow-md",
        onDismiss ? "pr-10" : "pr-3.5",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        className,
      )}
    >
      {onDismiss ?
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="absolute top-2 right-2 inline-flex size-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="size-3.5" aria-hidden />
        </button>
      : null}
      {children}
    </div>
  );
}

/** In-flow callout for workflow hints (stays within the form layout). */
export function FieldInlineHint({
  show,
  id,
  children,
  className,
  prominent = false,
  onDismiss,
  dismissLabel = "Dismiss message",
}: FieldHintBaseProps) {
  if (!show) return null;

  return (
    <FieldHintSurface
      id={id}
      prominent={prominent}
      onDismiss={onDismiss}
      dismissLabel={dismissLabel}
      className={cn("text-pretty", className)}
    >
      {children}
    </FieldHintSurface>
  );
}

/** Auto-visible callout with a pointer arrow toward an adjacent control. */
export function FieldHoverHint({
  show,
  id,
  children,
  className,
  arrowAlign = "left",
  anchor = "start",
  inFrame = false,
  placement = "above",
  prominent = false,
  onDismiss,
  dismissLabel = "Dismiss message",
}: FieldHoverHintProps) {
  if (!show) return null;

  const isBelow = placement === "below";
  const anchorCenter = anchor === "center" && !inFrame;

  return (
    <div
      className={cn(
        "absolute z-50 w-[min(20rem,calc(100vw-3rem))]",
        isBelow ? "top-full mt-3" : "bottom-full mb-3",
        anchorCenter ?
          "left-1/2 -translate-x-1/2"
        : "left-0",
        className,
      )}
    >
      {isBelow ?
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-2 size-3 rotate-45 border-t border-l bg-white shadow-sm",
            prominent ? "border-primary/40" : "border-border",
            arrowAlign === "center" ? "left-1/2 -translate-x-1/2" : "left-6",
          )}
        />
      : null}
      <FieldHintSurface
        id={id}
        prominent={prominent}
        onDismiss={onDismiss}
        dismissLabel={dismissLabel}
      >
        {children}
      </FieldHintSurface>
      {!isBelow ?
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -bottom-2 size-3 rotate-45 border-b border-r bg-white shadow-sm",
            prominent ? "border-primary/40" : "border-border",
            arrowAlign === "center" ? "left-1/2 -translate-x-1/2" : "left-6",
          )}
        />
      : null}
    </div>
  );
}
