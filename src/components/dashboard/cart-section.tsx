import type { ReactNode } from "react";

import { HelpBalloon } from "@/components/ui/help-balloon";
import { cn } from "@/lib/utils";

type CartSectionProps = {
  title: string;
  description?: string;
  /** Moves long section copy into the info balloon next to the title. */
  help?: ReactNode;
  helpLabel?: string;
  count?: number;
  children: ReactNode;
  className?: string;
  tone?: "default" | "warehouse";
};

export function CartSection({
  title,
  description,
  help,
  helpLabel,
  count,
  children,
  className,
  tone = "default",
}: CartSectionProps) {
  const warehouse = tone === "warehouse";
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {help ?
              <HelpBalloon
                label={helpLabel ?? `About ${title}`}
                tooltipClassName="w-80"
              >
                {help}
              </HelpBalloon>
            : null}
          </div>
          {description ?
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          : null}
        </div>
        {count != null && count > 0 ?
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums",
              warehouse ?
                "border-primary/40 bg-primary/15 text-primary"
              : "border-border/70 bg-muted text-muted-foreground",
            )}
          >
            {count} {count === 1 ? "item" : "items"}
          </span>
        : null}
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-card shadow-sm",
          warehouse ?
            "border-primary/45 bg-primary/8 ring-2 ring-primary/25"
          : "border-border/80 ring-1 ring-border/30",
        )}
      >
        {children}
      </div>
    </section>
  );
}
