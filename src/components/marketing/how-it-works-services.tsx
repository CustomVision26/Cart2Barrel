"use client";

import {
  Globe2,
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
      "Paste a product link or pick from our spotlight catalog. Cart2Barrel staff review each request and send an estimate before anything is purchased on your behalf.",
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
      "Already bought something online? Ship it to our hub using your Cart2Barrel intake details. Service and handling fees apply when you add it to your account.",
    icon: Ship,
  },
  {
    title: "Delivery worldwide",
    description:
      "When your barrel is full, we quote freight from the United States to your saved delivery address—Jamaica, the Caribbean, and other destinations we serve.",
    icon: Globe2,
  },
];

export function HowItWorksServices() {
  return (
    <section className="space-y-5">
      <RevealOnScroll delayMs={0} className="space-y-2">
        <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          What Cart2Barrel does for you
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Cart2Barrel is a consolidation service: we buy or receive your US
          store orders, pack them into a shared barrel or bin, and arrange
          international shipping to your door—with clear status at every step.
        </p>
      </RevealOnScroll>

      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2">
        {SERVICES.map((service, index) => {
          const Icon = service.icon;
          return (
            <RevealOnScroll key={service.title} delayMs={index * 50} as="li">
              <article className="h-full rounded-xl border border-border/80 bg-card/50 p-4 shadow-sm ring-1 ring-foreground/5">
                <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
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
