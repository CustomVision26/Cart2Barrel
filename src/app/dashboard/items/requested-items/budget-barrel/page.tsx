import { auth } from "@clerk/nextjs/server";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { BudgetBarrelWorkspace } from "@/components/dashboard/budget-barrel-workspace";
import { DashboardPageTitleWithHelp } from "@/components/dashboard/dashboard-page-title-with-help";
import { Button } from "@/components/ui/button";
import { BUDGET_BARREL_CARD_TITLE } from "@/lib/budget-barrel/constants";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import {
  DASHBOARD_REQUESTED_ITEMS_ROUTE,
  DASHBOARD_SHOPPING_LIST_REQUEST_ROUTE,
} from "@/lib/dashboard-items-routes";

export const maxDuration = 60;

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Set a merchandise budget",
    description: "Choose categories and retailers. Each category opens its own size, color, pack, and brand fields.",
  },
  {
    step: "02",
    title: "Review the list",
    description: "Compare a one-store list and a multi-store list. Hold products you want, then build again, or change quantities and swap an offer.",
  },
  {
    step: "03",
    title: "Submit for an estimate",
    description: "Staff confirm prices, availability, and fees. Accept the quote on Add item, then pay in cart.",
  },
] as const;

export default async function BudgetBarrelPage() {
  const { userId } = await auth();
  if (!userId) return null;

  return (
    <div className="space-y-10">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <li>
            <Link
              href={DASHBOARD_REQUESTED_ITEMS_ROUTE}
              className="transition-colors hover:text-foreground"
            >
              Requested items
            </Link>
          </li>
          <li className="flex items-center gap-1" aria-hidden>
            <ChevronRight className="size-3.5 shrink-0 opacity-50" />
            <span className="font-medium text-foreground">{BUDGET_BARREL_CARD_TITLE}</span>
          </li>
        </ol>
      </nav>

      <header className="space-y-8 border-b border-border pb-8">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            New list quote
          </p>
          <DashboardPageTitleWithHelp
            title={BUDGET_BARREL_CARD_TITLE}
            tooltipClassName="w-[28rem]"
            help={
              <>
                The budget covers merchandise only. Retailer delivery to the U.S. hub, taxes,
                Cart2Barrel fees, container cost, and freight stay separate and show as To be
                confirmed until staff send the quote.
              </>
            }
          />
        </div>

        <ol className="grid gap-px overflow-hidden rounded-xl border border-border/80 bg-border shadow-sm ring-1 ring-foreground/5 sm:grid-cols-3">
          {WORKFLOW_STEPS.map(({ step, title, description }) => (
            <li key={step} className="flex flex-col gap-2.5 bg-card px-4 py-4 sm:px-5">
              <span className="inline-flex w-fit items-center rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-primary ring-1 ring-primary/25">
                {step}
              </span>
              <span className="text-sm font-medium text-foreground">{title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            nativeButton={false}
            render={<Link href={DASHBOARD_SHOPPING_LIST_REQUEST_ROUTE} />}
            variant="outline"
            size="sm"
          >
            Upload Shopping List
          </Button>
          <Button
            nativeButton={false}
            render={<Link href={DASHBOARD_ADD_ITEM_ROUTES.batchQuotesActive} />}
            variant="outline"
            size="sm"
          >
            View batch quotes
          </Button>
        </div>
      </header>

      <BudgetBarrelWorkspace />
    </div>
  );
}
