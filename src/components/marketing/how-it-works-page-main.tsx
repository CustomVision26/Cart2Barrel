"use client";

import Link from "next/link";

import { ContainerCatalogChart } from "@/components/marketing/container-catalog-chart";
import {
  ContainerPackingFeeChart,
} from "@/components/marketing/container-packing-fee-chart";
import { HowItWorksCustomerCosts } from "@/components/marketing/how-it-works-customer-costs";
import { HowItWorksJourney } from "@/components/marketing/how-it-works-journey";
import { HowItWorksServices } from "@/components/marketing/how-it-works-services";
import { RevealOnScroll } from "@/components/marketing/reveal-on-scroll";
import { ServiceHandlingFeeChart } from "@/components/marketing/service-handling-fee-chart";
import { Button } from "@/components/ui/button";
import type {
  ContainerCatalogChartRow,
  ContainerPackingFeeChartRow,
} from "@/lib/container-packing-fee-chart";
import type { ServiceHandlingFeeChartRow } from "@/lib/service-handling-fee-chart";

type HowItWorksPageMainProps = {
  isSignedIn: boolean;
  inAppServiceFeeChartRows: ServiceHandlingFeeChartRow[];
  outsidePurchaseServiceFeeChartRows: ServiceHandlingFeeChartRow[];
  containerCatalogChartRows: ContainerCatalogChartRow[];
  containerPackingChartRows: ContainerPackingFeeChartRow[];
};

export function HowItWorksPageMain({
  isSignedIn,
  inAppServiceFeeChartRows,
  outsidePurchaseServiceFeeChartRows,
  containerCatalogChartRows,
  containerPackingChartRows,
}: HowItWorksPageMainProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10 md:py-12">
      <RevealOnScroll variant="load" delayMs={0} className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          How it works
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Your path from US shopping to custom destination
        </h1>
      </RevealOnScroll>

      <RevealOnScroll variant="load" delayMs={120}>
        <p className="max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Cart2Barrel helps you shop US retailers, consolidate packages at our
          hub, and ship everything in a barrel or bin to your address. This page
          explains our services, the step-by-step process, and typical costs—so
          you know what to expect before you sign up.
        </p>
      </RevealOnScroll>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-12">
        <aside className="order-1 lg:sticky lg:top-6 lg:order-2 lg:justify-self-end lg:w-full">
          <RevealOnScroll variant="scroll" delayMs={0}>
            <div className="space-y-4 lg:ml-auto lg:max-w-[340px]">
              <div className="space-y-1 px-0.5">
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">
                  Pricing overview
                </h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Current published rates. Your signed-in dashboard shows exact
                  totals at checkout.
                </p>
              </div>
              <div className="space-y-6">
                <ServiceHandlingFeeChart
                  kind="in-app"
                  rows={inAppServiceFeeChartRows}
                />
                <ServiceHandlingFeeChart
                  kind="outside"
                  rows={outsidePurchaseServiceFeeChartRows}
                />
                <ContainerCatalogChart rows={containerCatalogChartRows} />
                <ContainerPackingFeeChart rows={containerPackingChartRows} />
              </div>
            </div>
          </RevealOnScroll>
        </aside>

        <div className="order-2 min-w-0 space-y-12 lg:order-1">
          <HowItWorksServices />
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
            Create free account
          </Button>
        }
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          Back home
        </Button>
      </RevealOnScroll>
    </main>
  );
}
