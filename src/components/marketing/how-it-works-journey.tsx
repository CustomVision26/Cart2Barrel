"use client";

import {
  ClipboardCheck,
  CreditCard,
  MapPin,
  PackageCheck,
  Radar,
  ShoppingBag,
  Ship,
  type LucideIcon,
} from "lucide-react";

import { RevealOnScroll } from "@/components/marketing/reveal-on-scroll";
import { cn } from "@/lib/utils";

type JourneyStep = {
  step: number;
  title: string;
  description: string;
  liveNote: string;
  icon: LucideIcon;
};

const JOURNEY_STEPS: JourneyStep[] = [
  {
    step: 1,
    title: "Create your account & delivery label",
    description:
      "Sign up and complete onboarding with your delivery address. That label is separate from your account contact info and is used for every barrel shipment — whether you are in Jamaica, the Caribbean, or anywhere else we serve.",
    liveNote: "Your saved address is ready before your first order.",
    icon: MapPin,
  },
  {
    step: 2,
    title: "Browse, request, and get a quote",
    description:
      "Shop from the spotlight catalog or paste a product link for an AI-assisted request. Staff review each item and send an agreed estimate before anything is purchased.",
    liveNote: "Quote history and active requests stay in your dashboard.",
    icon: ShoppingBag,
  },
  {
    step: 3,
    title: "Approve & pay at checkout",
    description:
      "Accept the estimate, add vetted items to your cart, and pay securely at checkout. Cart2Barrel purchases on your behalf and your order moves into fulfillment.",
    liveNote: "Orders and payment status update in real time after checkout.",
    icon: CreditCard,
  },
  {
    step: 4,
    title: "Hub receives your goods",
    description:
      "Packages arrive at our consolidation hub. Warehouse staff log receipt, condition, and proof. You confirm delivery condition when needed so good items can enter the barrel pipeline.",
    liveNote: "Receipt details and fulfillment status appear on your order lines.",
    icon: PackageCheck,
  },
  {
    step: 5,
    title: "Watch products pack into your barrel",
    description:
      "Open Product to barrel in your dashboard to see every inbound item, its fulfillment stage, container alias, and when staff assigned it. Outside purchases you ship to us show here too.",
    liveNote: "Hands-on visibility — no guessing what is in your barrel.",
    icon: Radar,
  },
  {
    step: 6,
    title: "Barrel fills, ships, and delivers",
    description:
      "Track container capacity as it moves from open for packing to ready to ship. When your barrel is full, outbound shipping is arranged to your saved address worldwide through shipped and delivered.",
    liveNote: "Container status and assignment history stay on your timeline.",
    icon: Ship,
  },
];

const EXPERIENCE_HIGHLIGHTS = [
  {
    title: "Real-time dashboard",
    body: "Product to barrel and order history reflect staff actions as they happen — assignments, container aliases, and status changes without waiting on email.",
    icon: Radar,
  },
  {
    title: "You stay in control",
    body: "Approve quotes before we buy, confirm receipt condition when it matters, and choose when to checkout. The app keeps you informed at every warehouse step.",
    icon: ClipboardCheck,
  },
  {
    title: "Built for barrel consolidation",
    body: "Every flow — cart purchases, staff quotes, and outside buys shipped to the hub — feeds into the same packing pipeline headed for your delivery address, wherever you are.",
    icon: Ship,
  },
];

export function HowItWorksJourney() {
  return (
    <div className="space-y-10">
      <section className="grid gap-4 sm:grid-cols-3">
        {EXPERIENCE_HIGHLIGHTS.map((item, index) => {
          const Icon = item.icon;
          return (
            <RevealOnScroll
              key={item.title}
              delayMs={index * 90}
              className="marketing-highlight-card rounded-xl border border-border/80 bg-card/60 p-4 shadow-sm ring-1 ring-foreground/5 backdrop-blur-sm"
            >
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon className="size-5" aria-hidden />
              </div>
              <h2 className="font-heading text-base font-semibold text-foreground">
                {item.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </RevealOnScroll>
          );
        })}
      </section>

      <section className="space-y-6">
        <RevealOnScroll delayMs={0} className="space-y-1">
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            Step by step: cart to barrel to your door
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Cart2Barrel is designed so you can follow your shipment hands-on — from
            the first request through packing and final delivery.
          </p>
        </RevealOnScroll>

        <ol className="relative space-y-0">
          {JOURNEY_STEPS.map((item, index) => {
            const Icon = item.icon;
            const isLast = index === JOURNEY_STEPS.length - 1;

            return (
              <RevealOnScroll
                key={item.step}
                as="li"
                delayMs={index * 70}
                className="marketing-reveal-static relative flex gap-4 pb-10 sm:gap-6"
              >
                {!isLast ?
                  <span
                    aria-hidden
                    className="marketing-timeline-line absolute top-12 bottom-0 left-[1.375rem] w-px bg-gradient-to-b from-primary/50 via-border to-border sm:left-6"
                  />
                : null}

                <div className="marketing-step-column relative z-10 flex shrink-0 flex-col items-center">
                  <div
                    className={cn(
                      "marketing-step-icon flex size-11 items-center justify-center rounded-xl border-2 border-primary/60 bg-primary text-primary-foreground shadow-md sm:size-12",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Step {item.step}
                  </span>
                </div>

                <div className="marketing-step-card min-w-0 flex-1 space-y-2 rounded-xl border border-border/80 bg-card/50 p-4 shadow-sm ring-1 ring-foreground/5 sm:p-5">
                  <h3 className="font-heading text-lg font-semibold leading-snug text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                  <p className="marketing-live-note inline-flex items-start gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium leading-relaxed text-primary">
                    <Radar className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {item.liveNote}
                  </p>
                </div>
              </RevealOnScroll>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
