import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type CustomerEmptyStateProps = {
  title: string;
  description: ReactNode;
  illustration: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Centered empty-state card used on customer dashboard screens. */
export function CustomerEmptyState({
  title,
  description,
  illustration,
  actions,
  className,
}: CustomerEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm",
        className,
      )}
    >
      <div className="flex size-36 items-center justify-center rounded-full bg-secondary/70">
        {illustration}
      </div>
      <div className="space-y-1.5">
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">{actions}</div>
      ) : null}
    </div>
  );
}
