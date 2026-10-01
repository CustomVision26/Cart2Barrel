"use client";

import Link from "next/link";
import { useEffect } from "react";

import { ContainerCatalogChart } from "@/components/marketing/container-catalog-chart";
import {
  ContainerPackingFeeChart,
} from "@/components/marketing/container-packing-fee-chart";
import { HowItWorksCustomerCosts } from "@/components/marketing/how-it-works-customer-costs";
import { HowItWorksJourney } from "@/components/marketing/how-it-works-journey";
import { HowItWorksServices } from "@/components/marketing/how-it-works-services";
import { HowItWorksSpecialFeatures } from "@/components/marketing/how-it-works-special-features";
import { HowItWorksSubTabNav } from "@/components/marketing/how-it-works-sub-tab-nav";
import { HowItWorksPanel, HowItWorksPricingOverview } from "@/components/marketing/how-it-works-pricing-overview";
import { HowItWorksThirdPartyVendorPricing } from "@/components/marketing/how-it-works-third-party-vendor-pricing";
import { RevealOnScroll } from "@/components/marketing/reveal-on-scroll";
import { ServiceHandlingFeeChart } from "@/components/marketing/service-handling-fee-chart";
import { UserDocumentationBrowser } from "@/components/documentation/user-documentation-browser";
import { Button } from "@/components/ui/button";
import type {
  ContainerCatalogChartRow,
  ContainerPackingFeeChartRow,
} from "@/lib/container-packing-fee-chart";
import type { HowItWorksTab } from "@/lib/how-it-works-routes";
import type { PublicOutboundCompanyPricingCard } from "@/lib/public-outbound-company-pricing";
import type { ServiceHandlingFeeChartRow } from "@/lib/service-handling-fee-chart";

type HowItWorksPageMainProps = {
  activeTab: HowItWorksTab;
  isSignedIn: boolean;
  inAppServiceFeeChartRows: ServiceHandlingFeeChartRow[];
  outsidePurchaseServiceFeeChartRows: ServiceHandlingFeeChartRow[];
  containerCatalogChartRows: ContainerCatalogChartRow[];
  containerPackingChartRows: ContainerPackingFeeChartRow[];
  thirdPartyVendorPricing: PublicOutboundCompanyPricingCard[];
};

export function HowItWorksPageMain({
  activeTab,
  isSignedIn,
  inAppServiceFeeChartRows,
  outsidePurchaseServiceFeeChartRows,
  containerCatalogChartRows,
  containerPackingChartRows,
  thirdPartyVendorPricing,
}: HowItWorksPageMainProps) {
  const isUserGuide = activeTab === "user-guide";

  useEffect(() => {
    if (!isUserGuide) return;
    requestAnimationFrame(() => {
      document
        .getElementById("user-guide-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [isUserGuide]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 md:gap-10 md:py-12">
      <RevealOnScroll variant="load" delayMs={0} className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          How it works
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {isUserGuide ?
            "User guide"
          : "Your path from US shopping to custom destination"}
        </h1>
      </RevealOnScroll>

      <RevealOnScroll variant="load" delayMs={120}>
        <p className="max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
          {isUserGuide ?
            "Formal reference for every customer page, header control, and account feature. Each topic includes a quick reference for scanning and a full article for deeper reading—no sign-in required."
          : "Amani Cart2Barrel helps you shop US retailers, consolidate packages at our hub, and ship everything in a barrel or bin to your address. When a special-feature suitcase offer is in season, you can also send a bag with a company courier traveler. This page explains our services, seasonal specials, the step-by-step process, and typical costs—so you know what to expect before you sign up."}
        </p>
      </RevealOnScroll>

      <HowItWorksSubTabNav activeTab={activeTab} />

      {isUserGuide ?
        <RevealOnScroll variant="load" delayMs={80}>
          <div id="user-guide-panel" className="scroll-mt-6">
            <HowItWorksPanel
              stamp="Reference"
              title="Customer handbook"
              description="Search any customer page or control. Each topic has a quick reference for scanning and a full article for the complete walkthrough."
            >
              <UserDocumentationBrowser variant="page" tone="hiw" />
            </HowItWorksPanel>
          </div>
        </RevealOnScroll>
      : <>
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-12">
            <aside className="order-1 lg:sticky lg:top-6 lg:order-2 lg:justify-self-end lg:w-full">
              <RevealOnScroll variant="scroll" delayMs={0}>
                <div className="lg:ml-auto lg:max-w-[22.5rem]">
                  <HowItWorksPricingOverview>
                    <ServiceHandlingFeeChart
                      kind="in-app"
                      rows={inAppServiceFeeChartRows}
                      index={1}
                    />
                    <ServiceHandlingFeeChart
                      kind="outside"
                      rows={outsidePurchaseServiceFeeChartRows}
                      index={2}
                    />
                    <ContainerCatalogChart
                      rows={containerCatalogChartRows}
                      index={3}
                    />
                    <ContainerPackingFeeChart
                      rows={containerPackingChartRows}
                      index={4}
                    />
                    <HowItWorksThirdPartyVendorPricing
                      companies={thirdPartyVendorPricing}
                      index={5}
                    />
                  </HowItWorksPricingOverview>
                </div>
              </RevealOnScroll>
            </aside>

            <div className="order-2 min-w-0 lg:order-1">
              <HowItWorksPanel
                stamp="Overview"
                title="From cart to barrel"
                description="Services, the live dashboard journey, what you pay at each stage, and seasonal suitcase specials."
              >
                <HowItWorksServices />
                <HowItWorksJourney />
                <HowItWorksCustomerCosts />
                <HowItWorksSpecialFeatures />
              </HowItWorksPanel>
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
        </>
      }
    </main>
  );
}
