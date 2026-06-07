import Image from "next/image";
import { Sparkles } from "lucide-react";

/** Static hero shown immediately on the marketing home page (no data dependencies). */
export function HomeMarketingHero() {
  return (
    <section className="space-y-6">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-amber-500" aria-hidden />
        Shop &amp; Ship From US stores · Delivered to Caribbean and The World
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/40 shadow-sm ring-1 ring-foreground/5">
        <Image
          src="/homepage-img-cart2barrel.png"
          alt="Cart2Barrel — shop US stores and ship consolidated orders to the Caribbean and the world"
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
