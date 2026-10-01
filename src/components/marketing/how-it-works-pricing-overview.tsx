import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function HowItWorksPanel({
  stamp,
  title,
  description,
  children,
  className,
}: {
  stamp: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("hiw-panel", className)}>
      <header className="hiw-masthead">
        <p className="hiw-stamp relative z-10 text-[10px] font-semibold uppercase tracking-[0.22em]">
          {stamp}
        </p>
        <h2 className="relative z-10 mt-2 font-heading text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ?
          <p className="relative z-10 mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {description}
          </p>
        : null}
      </header>
      <div className="hiw-body">{children}</div>
    </div>
  );
}

export function HowItWorksPricingOverview({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="pricing-overview-panel">
      <header className="pricing-overview-masthead">
        <p className="pricing-overview-stamp relative z-10 text-[10px] font-semibold uppercase tracking-[0.22em]">
          Rate schedule
        </p>
        <h2 className="relative z-10 mt-2 font-heading text-lg font-semibold tracking-tight text-foreground">
          Pricing overview
        </h2>
        <p className="relative z-10 mt-1.5 max-w-[20rem] text-xs leading-relaxed text-muted-foreground">
          Current published rates. Your signed-in dashboard shows exact totals
          at checkout.
        </p>
      </header>
      <div className="pricing-overview-body">{children}</div>
    </div>
  );
}

export function PricingOverviewSection({
  index,
  icon,
  title,
  description,
  children,
  footer,
  accent = "violet",
}: {
  index: number;
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  accent?: "sky" | "amber" | "violet" | "emerald" | "rose";
}) {
  const label = String(index).padStart(2, "0");
  return (
    <section
      className="pricing-overview-section space-y-3 px-3.5 py-4"
      data-accent={accent}
      style={
        {
          "--pricing-section-delay": `${(index - 1) * 90}ms`,
        } as CSSProperties
      }
    >
      <div className="flex items-start gap-2.5">
        <span
          className="pricing-overview-icon mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md"
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0 space-y-1">
          <p className="pricing-overview-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
            {label}
          </p>
          <h3 className="font-heading text-sm font-semibold leading-snug tracking-tight text-foreground">
            {title}
          </h3>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {children}
      {footer}
    </section>
  );
}
