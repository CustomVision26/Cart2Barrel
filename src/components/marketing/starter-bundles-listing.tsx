import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { formatUsd } from "@/lib/admin-markup";
import { STARTER_BUNDLES_ROUTES } from "@/lib/starter-bundles";
import { cn } from "@/lib/utils";
import type { PublishedStarterBundleCard } from "@/data/starter-bundles";

export function StarterBundlesListing({
  bundles,
  notice,
}: {
  bundles: PublishedStarterBundleCard[];
  notice?: string | null;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href="/"
          prefetch={false}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 w-fit gap-1.5 text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to home
        </Link>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Shop Starter Bundles
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Compare ready-made bundles at different price points. Each bundle is a fixed
          shopping list. Request an estimate and staff will add service, freight, and broker
          fees in the quote. Destination pickup charges are separate.
        </p>
      </div>

      {notice ?
        <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          {notice}
        </p>
      : null}

      {bundles.length === 0 ?
        <p className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground shadow-sm">
          No starter bundles are published yet. You can still upload your own list from
          Requested items → Shopping list.
        </p>
      : <ul className="grid gap-4 sm:grid-cols-2">
          {bundles.map((bundle) => (
            <li key={bundle.id}>
              <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {bundle.imageUrl ?
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bundle.imageUrl}
                    alt=""
                    className="h-44 w-full object-cover"
                  />
                : null}
                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div className="space-y-1.5">
                    <h2 className="font-heading text-lg font-semibold text-foreground">
                      {bundle.name}
                    </h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {bundle.description}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Estimated merchandise subtotal
                    </p>
                    <p className="font-heading text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                      {formatUsd(bundle.merchandiseSubtotalCents)}
                    </p>
                  </div>
                  {bundle.barrelSize || bundle.barrelFillLevel ?
                    <p className="text-xs text-muted-foreground">
                      {bundle.barrelSize ? `Barrel size: ${bundle.barrelSize}` : null}
                      {bundle.barrelSize && bundle.barrelFillLevel ? " · " : null}
                      {bundle.barrelFillLevel
                        ? `Approximate fill: ${bundle.barrelFillLevel}`
                        : null}
                    </p>
                  : null}
                  <div className="mt-auto pt-1">
                    <Link
                      href={STARTER_BUNDLES_ROUTES.detail(bundle.id)}
                      prefetch={false}
                      className={cn(
                        buttonVariants(),
                        "h-11 rounded-full px-5 text-sm font-semibold",
                      )}
                    >
                      View bundle
                    </Link>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>}
    </div>
  );
}
