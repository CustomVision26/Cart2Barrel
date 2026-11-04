"use client";

import Link from "next/link";
import { useMemo } from "react";

import { STARTER_BUNDLES_ROUTES } from "@/lib/starter-bundles";

type MarqueeBundle = {
  id: string;
  name: string;
  priceLabel: string;
};

const AVATAR_TONES = [
  "from-lime-300 to-emerald-500",
  "from-sky-300 to-indigo-500",
  "from-violet-400 to-fuchsia-500",
  "from-amber-300 to-orange-500",
  "from-cyan-300 to-teal-500",
];

function looped(items: MarqueeBundle[]): MarqueeBundle[] {
  if (items.length === 0) return [];
  const minVisible = 6;
  const padded =
    items.length >= minVisible
      ? items
      : Array.from({ length: Math.ceil(minVisible / items.length) }, () => items).flat();
  return [...padded, ...padded];
}

function BundleMarqueeCard({
  bundle,
  toneIndex,
}: {
  bundle: MarqueeBundle;
  toneIndex: number;
}) {
  return (
    <div className="flex min-w-[16.5rem] shrink-0 items-center gap-3 rounded-2xl border border-border/80 bg-card px-3.5 py-3 shadow-sm ring-1 ring-foreground/5">
      <span
        className={`size-9 shrink-0 rounded-full bg-gradient-to-br ${AVATAR_TONES[toneIndex % AVATAR_TONES.length]}`}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{bundle.name}</p>
        <p className="text-xs text-muted-foreground">Starter bundle</p>
        <p className="mt-0.5 text-base font-semibold tabular-nums tracking-tight text-foreground">
          {bundle.priceLabel}
        </p>
      </div>
    </div>
  );
}

export function HomeStarterBundlesMarqueeClient({
  bundles,
}: {
  bundles: MarqueeBundle[];
}) {
  const track = useMemo(() => looped(bundles), [bundles]);
  const ariaText = bundles
    .map((bundle) => `${bundle.name} ${bundle.priceLabel}`)
    .join(", ");

  return (
    <Link
      href={STARTER_BUNDLES_ROUTES.listing}
      prefetch={false}
      className="starter-bundle-marquee block overflow-hidden rounded-2xl border border-border/70 bg-card/40 shadow-sm ring-1 ring-foreground/5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Shop Starter Bundles. ${ariaText}. View all bundles.`}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <p className="text-sm font-semibold tracking-tight text-foreground">
          Shop Starter Bundles
        </p>
        <span className="text-sm text-muted-foreground">View all bundles</span>
      </div>
      <div className="starter-bundle-marquee__viewport overflow-hidden py-3" aria-hidden>
        <div className="starter-bundle-marquee__track flex w-max gap-3 px-4">
          {track.map((bundle, index) => (
            <BundleMarqueeCard
              key={`${bundle.id}-${index}`}
              bundle={bundle}
              toneIndex={index}
            />
          ))}
        </div>
      </div>
    </Link>
  );
}
