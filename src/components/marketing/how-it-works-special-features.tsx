"use client";

import {
  CalendarClock,
  Luggage,
  PackageCheck,
  Plane,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

import { RevealOnScroll } from "@/components/marketing/reveal-on-scroll";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const HOW_IT_RUNS: { title: string; body: string; icon: LucideIcon }[] = [
  {
    title: "A timed window, not year-round",
    body: "Special-feature offers are seasonal. Staff publish a start time, an end time, and a travel date for a company courier going to Jamaica. The offer is live only inside that window. When the window ends—or the suitcase slots fill—the special is no longer available.",
    icon: CalendarClock,
  },
  {
    title: "Courier traveler, not a full barrel",
    body: "Instead of waiting for a barrel or bin to fill, a company courier traveler flies with extra checked bags. Typical capacity is a second and third suitcase (sometimes a fourth). That is why quantities are limited and why you must finish before the special closes.",
    icon: Plane,
  },
  {
    title: "Choose how the suitcase is packed",
    body: "In-app packaging: buy a suitcase from Dashboard → Barrels, request or add products as usual, and Amani Cart2Barrel packs the bag at the hub. Outside packaging: you pack your own suitcase and send it to the hub so it arrives before the special ends.",
    icon: Luggage,
  },
  {
    title: "Hub inspection before travel",
    body: "Every suitcase is inspected for drugs and other illegal items. Bags that fail inspection are rejected and the police are contacted. Do not pack prohibited goods.",
    icon: ShieldAlert,
  },
];

export function HowItWorksSpecialFeatures() {
  const accents = ["sky", "amber", "violet", "rose"] as const;
  return (
    <section className="hiw-section space-y-5" data-accent="emerald">
      <RevealOnScroll delayMs={0} className="space-y-2">
        <p className="hiw-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
          04
        </p>
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Seasonal special-feature offers
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Amani Cart2Barrel also runs timed suitcase specials when they are in
          season. These are separate from everyday barrel and bin shipping: they
          use a company courier traveler for faster delivery to Jamaica during a
          published offer period.
        </p>
      </RevealOnScroll>

      <RevealOnScroll delayMs={40}>
        <Card className="hiw-card border-0 bg-transparent shadow-none ring-0" data-accent="emerald">
          <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
            <div className="hiw-icon flex size-10 shrink-0 items-center justify-center rounded-lg">
              <PackageCheck className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="hiw-kicker text-[10px] font-semibold uppercase tracking-wider">
                When a special is in season
              </p>
              <CardTitle className="font-heading text-base leading-snug">
                How a live offer works from start to travel
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                Live specials appear as a banner on Home and in your dashboard.
                Open the banner or go to Dashboard → Barrels to see the suitcase,
                dates, remaining slots, and charges for that offer.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>
                Staff publish the special with a start date, end date, and travel
                date. You can join only while the offer is live and slots remain.
              </li>
              <li>
                Select a special-feature suitcase and add it to your cart. Sign in
                is required to purchase.
              </li>
              <li>
                For in-app packing, add the products you want in that suitcase,
                then pay at checkout. For outside packing, send your packed
                suitcase to the hub so it arrives before the special ends.
              </li>
              <li>
                The hub receives, inspects, and prepares the bag. The courier
                traveler checks it as extra airline baggage on the published
                flight to Jamaica.
              </li>
              <li>
                After arrival, destination-country charges (duties, inland
                delivery, local handling) may still be collected separately—the
                same as barrel shipments.
              </li>
            </ol>
          </CardContent>
        </Card>
      </RevealOnScroll>

      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2">
        {HOW_IT_RUNS.map((item, index) => {
          const Icon = item.icon;
          return (
            <RevealOnScroll key={item.title} delayMs={index * 50} as="li">
              <article
                className="hiw-card h-full rounded-xl p-4"
                data-accent={accents[index % accents.length]}
              >
                <div className="hiw-icon mb-3 inline-flex size-10 items-center justify-center rounded-lg">
                  <Icon className="size-5" aria-hidden />
                </div>
                <h3 className="font-heading text-base font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </article>
            </RevealOnScroll>
          );
        })}
      </ul>

      <RevealOnScroll delayMs={80}>
        <Card className="hiw-card border-0 bg-transparent shadow-none ring-0" data-accent="violet">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base">
              What you pay on a special
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Charges depend on whether Amani Cart2Barrel packs the suitcase or
              you pack it yourself. Exact totals appear at checkout for the live
              offer.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="hiw-note space-y-2 rounded-lg p-3">
              <p className="text-sm font-medium text-foreground">
                In-app packaging
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Suitcase purchase fee</li>
                <li>Product cost plus service and handling for packed items</li>
                <li>Packing fee for the suitcase</li>
                <li>Transportation / courier fee to the destination</li>
                <li>Airline bag fee (varies by airline and bag number)</li>
              </ul>
            </div>
            <div className="hiw-note space-y-2 rounded-lg p-3">
              <p className="text-sm font-medium text-foreground">
                Outside packaging
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Service and handling for the suitcase and its contents</li>
                <li>Transportation / courier fee to the destination</li>
                <li>Airline bag fee (varies by airline and bag number)</li>
                <li>You supply and pack the suitcase before the special ends</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </RevealOnScroll>

      <RevealOnScroll delayMs={100}>
        <p className="hiw-note rounded-lg px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          Specials are not always on. If you do not see a banner on Home or in
          the dashboard, no suitcase special is in season. Barrel and bin
          consolidation remains available year-round.
        </p>
      </RevealOnScroll>
    </section>
  );
}
