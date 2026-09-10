"use client";

import type { SerpApiUsageBucket } from "@/data/serp-api-search-events";

export function AdminSerpApiUsageBarChart({
  title,
  caption,
  buckets,
}: {
  title: string;
  caption: string;
  buckets: SerpApiUsageBucket[];
}) {
  const max = Math.max(1, ...buckets.map((b) => b.searches));

  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="font-heading text-base font-medium text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
      <div className="mt-4 flex h-44 items-end gap-px sm:gap-0.5">
        {buckets.map((bucket) => {
          const pct = (bucket.searches / max) * 100;
          return (
            <div
              key={bucket.iso}
              className="flex min-w-0 flex-1 flex-col items-center justify-end"
              title={`${bucket.label}: ${bucket.searches} search${bucket.searches === 1 ? "" : "es"}`}
            >
              <div
                className="w-full min-h-0.5 rounded-t bg-primary/85"
                style={{ height: `${bucket.searches > 0 ? Math.max(6, pct) : 2}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground sm:text-xs">
        <span>{buckets[0]?.label ?? ""}</span>
        <span>{buckets[buckets.length - 1]?.label ?? ""}</span>
      </div>
    </section>
  );
}
