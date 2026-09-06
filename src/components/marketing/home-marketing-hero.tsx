import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { PackageSearch, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE } from "@/lib/dashboard-items-routes";

/** Static hero shown immediately on the marketing home page (no data dependencies). */
export function HomeMarketingHero({ promo }: { promo?: ReactNode }) {
  return (
    <section className="space-y-6">
      {promo}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-amber-500" aria-hidden />
          Shop &amp; Ship From US stores · Delivered to Caribbean and The World
        </div>
        <div className="relative w-full sm:w-auto">
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-xl bg-primary/40 blur-md sm:-inset-1.5"
          />
          <Button
            size="lg"
            className="relative h-12 w-full gap-2 px-6 text-base font-semibold shadow-lg shadow-primary/40 ring-2 ring-primary/60 sm:w-auto"
            nativeButton={false}
            render={
              <Link
                href={DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE}
                prefetch={false}
              />
            }
          >
            <PackageSearch className="size-5" aria-hidden />
            Get an estimate
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/40 shadow-sm ring-1 ring-foreground/5">
        <Image
          src="/homepage-img-cart2barrel.png"
          alt="Amani Cart2Barrel — shop US stores and ship consolidated orders to the Caribbean and the world"
          width={1536}
          height={864}
          priority
          sizes="(max-width: 768px) 100vw, 1152px"
          className="block h-auto w-full"
        />
      </div>
    </section>
  );
}
