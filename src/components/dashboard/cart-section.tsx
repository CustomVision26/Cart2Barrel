import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type CartSectionProps = {
  title: string;
  description?: string;
  count?: number;
  children: ReactNode;
  className?: string;
};

export function CartSection({
  title,
  description,
  count,
  children,
  className,
}: CartSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-3">
        <div className="min-w-0 space-y-1.5">
          <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description ?
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          : null}
        </div>
        {count != null && count > 0 ?
          <span className="inline-flex shrink-0 items-center rounded-md border border-border/70 bg-muted/25 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
            {count} {count === 1 ? "item" : "items"}
          </span>
        : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm ring-1 ring-border/30">
        {children}
      </div>
    </section>
  );
}
