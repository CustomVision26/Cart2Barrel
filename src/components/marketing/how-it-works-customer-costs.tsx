"use client";

import {
  Box,
  Globe2,
  Package,
  Ship,
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

type CostPhase = {
  step: number;
  title: string;
  description: string;
  items: string[];
  when: string;
  icon: LucideIcon;
};

const COST_PHASES: CostPhase[] = [
  {
    step: 1,
    title: "Product cost + service & handling",
    description:
      "In-app requests include retailer price plus our in-app service and handling fee per unit. Outside purchases you ship to us use a separate outside-purchase fee schedule (see Pricing overview)—merchandise is not billed on those lines.",
    items: [
      "Merchandise subtotal from your approved quote",
      "Service and handling fee per unit × quantity",
      "Sales tax on merchandise when applicable",
    ],
    when: "Due at checkout when you pay for cart items",
    icon: Package,
  },
  {
    step: 2,
    title: "Container / barrel cost",
    description:
      "Choose a barrel or bin from the in-app catalog and add it to your cart. Container list prices and packing fees are shown in Pricing overview before you pay.",
    items: [
      "Container price from the catalog (Dashboard → Barrels)",
      "Packing fee based on how many barrels and bins are in your cart",
    ],
    when: "When you add containers to your cart or at checkout",
    icon: Box,
  },
  {
    step: 3,
    title: "Shipping / freight (US → you)",
    description:
      "When your container is full and ready to ship, staff publish outbound charges. You pay Cart2Barrel before we release the container to the freight or pickup company.",
    items: [
      "Freight / shipper charge (United States to your destination country)",
      "Customs clearance charges (where quoted upfront)",
      "Local pickup or courier handoff fees (where quoted upfront)",
    ],
    when: "Quoted in your dashboard under Shipping before we release to the courier",
    icon: Ship,
  },
  {
    step: 4,
    title: "Destination country charges (on arrival)",
    description:
      "After the container lands, carriers and customs in your country may bill separately. These are not always included in the US outbound quote.",
    items: [
      "Customs duties and import taxes",
      "Inland delivery to your address",
      "Port or warehouse storage fees",
      "Local handling and release fees",
    ],
    when: "Typically collected by destination customs, freight agent, or courier",
    icon: Globe2,
  },
];

export function HowItWorksCustomerCosts() {
  return (
    <section className="space-y-5">
      <RevealOnScroll delayMs={0} className="space-y-2">
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          What you pay along the way
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Cart2Barrel separates costs by stage so you always know what is due in
          the app versus what may be collected locally when your barrel arrives.
        </p>
      </RevealOnScroll>

      <ol className="grid list-none gap-4 p-0">
        {COST_PHASES.map((phase, index) => {
          const Icon = phase.icon;
          return (
            <RevealOnScroll key={phase.step} delayMs={index * 60} as="li">
              <Card className="border-border/80 bg-card/50 shadow-sm ring-1 ring-foreground/5">
                <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/15 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Cost {phase.step}
                    </p>
                    <CardTitle className="font-heading text-base leading-snug">
                      {phase.title}
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {phase.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {phase.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
                    When due:{" "}
                    <span className="font-normal text-muted-foreground">
                      {phase.when}
                    </span>
                  </p>
                </CardContent>
              </Card>
            </RevealOnScroll>
          );
        })}
      </ol>
    </section>
  );
}
