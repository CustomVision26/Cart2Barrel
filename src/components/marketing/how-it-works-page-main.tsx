"use client";

import Link from "next/link";

import { HowItWorksCustomerCosts } from "@/components/marketing/how-it-works-customer-costs";
import { HowItWorksJourney } from "@/components/marketing/how-it-works-journey";
import { RevealOnScroll } from "@/components/marketing/reveal-on-scroll";
import { ServiceHandlingFeeChart } from "@/components/marketing/service-handling-fee-chart";
import { Button } from "@/components/ui/button";
import type { ServiceHandlingFeeChartRow } from "@/lib/service-handling-fee-chart";

type HowItWorksPageMainProps = {
  isSignedIn: boolean;
  serviceFeeChartRows: ServiceHandlingFeeChartRow[];
};

export function HowItWorksPageMain({
  isSignedIn,
  serviceFeeChartRows,
}: HowItWorksPageMainProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10 md:py-12">
      <RevealOnScroll variant="load" delayMs={0} className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          How it works
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Ship more home for less
        </h1>
      </RevealOnScroll>

      <RevealOnScroll variant="load" delayMs={120}>
        <p className="max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Cart2Barrel is a hands-on shipping experience: request US store items,
          pay when you are ready, then follow every package into your barrel and
          all the way to your delivery address anywhere in the world — with live
          status in the app.
        </p>
      </RevealOnScroll>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-12">
        <aside className="order-1 lg:sticky lg:top-6 lg:order-2 lg:justify-self-end lg:w-full">
          <RevealOnScroll variant="scroll" delayMs={0}>
            <div className="lg:ml-auto lg:max-w-[340px]">
              <ServiceHandlingFeeChart rows={serviceFeeChartRows} />
            </div>
          </RevealOnScroll>
        </aside>

        <div className="order-2 min-w-0 space-y-10 lg:order-1">
          <HowItWorksJourney />
          <HowItWorksCustomerCosts />
        </div>
      </div>

      <RevealOnScroll
        variant="scroll"
        delayMs={80}
        className="flex flex-wrap items-center gap-3 border-t border-border/80 pt-8"
      >
        {isSignedIn ?
          <Button nativeButton={false} render={<Link href="/dashboard" />}>
            Open dashboard
          </Button>
        : <Button nativeButton={false} render={<Link href="/signup" />}>
            Get started
          </Button>
        }
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          Back home
        </Button>
      </RevealOnScroll>
    </main>
  );
}
