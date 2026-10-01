"use client";

import {
  Globe2,
  Luggage,
  PackageSearch,
  Radar,
  Ship,
  ShoppingCart,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { RevealOnScroll } from "@/components/marketing/reveal-on-scroll";

type Service = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const SERVICES: Service[] = [
  {
    title: "Shop US stores with a quote first",
    description:
      "Paste a product link or pick from our spotlight catalog. Amani Cart2Barrel staff review each request and send an estimate before anything is purchased on your behalf.",
    icon: PackageSearch,
  },
  {
    title: "Pay when you are ready",
    description:
      "Approve quotes, build your cart, and checkout securely. You see merchandise, service fees, and container costs before you pay.",
    icon: ShoppingCart,
  },
  {
    title: "Consolidation into barrels & bins",
    description:
      "We receive your packages at our US hub, log condition and proof, and pack approved items into the container you choose—so multiple orders ship together.",
    icon: Warehouse,
  },
  {
    title: "Hands-on tracking in your dashboard",
    description:
      "Follow every line from awaiting purchase through warehouse receipt, barrel assignment, and outbound shipping—without waiting on email updates.",
    icon: Radar,
  },
  {
    title: "Outside purchases welcome",
    description:
      "Already bought something online? Ship it to our hub using your Amani Cart2Barrel intake details. Service and handling fees apply when you add it to your account.",
    icon: Ship,
  },
  {
    title: "Delivery worldwide",
    description:
      "When your barrel is full, we quote freight from the United States to your saved delivery address—Jamaica, the Caribbean, and other destinations we serve.",
    icon: Globe2,
  },
  {
    title: "Seasonal special-feature offers",
    description:
      "When a suitcase special is in season, a company courier traveler can carry extra bags to Jamaica on a published travel date—faster than waiting for a full barrel, with limited slots and a hard end date.",
    icon: Luggage,
  },
];

export function HowItWorksServices() {
  return (
    <section className="hiw-section space-y-5" data-accent="sky">
      <RevealOnScroll delayMs={0} className="space-y-2">
        <p className="hiw-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
          01
        </p>
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          What Amani Cart2Barrel does for you
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Amani Cart2Barrel is a consolidation service: we buy or receive your US
          store orders, pack them into a shared barrel or bin, and arrange
          international shipping to your custom destination—with clear status at
          every step. When a special-feature suitcase offer is in season, you can
          also send a bag with a company courier traveler instead of waiting for
          a full container.
        </p>
      </RevealOnScroll>

      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2">
        {SERVICES.map((service, index) => {
          const Icon = service.icon;
          const accents = ["sky", "amber", "violet", "emerald", "rose"] as const;
          return (
            <RevealOnScroll key={service.title} delayMs={index * 50} as="li">
              <article
                className="hiw-card h-full rounded-xl p-4"
                data-accent={accents[index % accents.length]}
              >
                <div className="hiw-icon mb-3 inline-flex size-10 items-center justify-center rounded-lg">
                  <Icon className="size-5" aria-hidden />
                </div>
                <h3 className="font-heading text-base font-semibold text-foreground">
                  {service.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {service.description}
                </p>
              </article>
            </RevealOnScroll>
          );
        })}
      </ul>
    </section>
  );
}
