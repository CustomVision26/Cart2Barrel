import { auth } from "@clerk/nextjs/server";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { DashboardPageTitleWithHelp } from "@/components/dashboard/dashboard-page-title-with-help";
import { ShoppingListRequestWorkspace } from "@/components/dashboard/shopping-list-request-workspace";
import { Button } from "@/components/ui/button";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { DASHBOARD_REQUESTED_ITEMS_ROUTE } from "@/lib/dashboard-items-routes";

export const maxDuration = 60;

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Upload your list",
    description: "Photograph a handwritten list, screenshot, or product collage.",
  },
  {
    step: "02",
    title: "Review the table",
    description:
      "AI fills name, quantity, size, color, and notes. Edit every field and add a product photo.",
  },
  {
    step: "03",
    title: "Submit for a quote",
    description:
      "Staff prices each line. When the estimate is ready, preview and accept it on Add item.",
  },
] as const;

export default async function DashboardShoppingListRequestPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

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
            <span className="font-medium text-foreground">Shopping list</span>
          </li>
        </ol>
      </nav>

      <header className="space-y-8 border-b border-border pb-8">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            New list quote
          </p>
          <DashboardPageTitleWithHelp
            title="Shopping list"
            tooltipClassName="w-[28rem]"
            help={
              <>
                Upload one photo of the products you want. AI builds an editable table. Submit
                for staff to add merchandise, shipping, sales tax, and service &amp; handling.
                When they finish, open Add item → Batch quotes to preview and accept into cart.
              </>
            }
          />
        </div>

        <ol className="grid gap-px overflow-hidden rounded-xl border border-border/80 bg-border shadow-sm ring-1 ring-foreground/5 sm:grid-cols-3">
          {WORKFLOW_STEPS.map(({ step, title, description }) => (
            <li
              key={step}
              className="flex flex-col gap-2.5 bg-card px-4 py-4 sm:px-5"
            >
              <span className="inline-flex w-fit items-center rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-primary ring-1 ring-primary/25">
                {step}
              </span>
              <span className="text-sm font-medium text-foreground">{title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                {description}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-3">
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

      <ShoppingListRequestWorkspace />
    </div>
  );
}
