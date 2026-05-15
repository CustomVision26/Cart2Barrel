import { auth } from "@clerk/nextjs/server";
import { ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { ItemRequestWorkspace } from "@/components/dashboard/item-request-workspace";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { DASHBOARD_REQUESTED_ITEMS_ROUTE } from "@/lib/dashboard-items-routes";

export default async function DashboardAiAssistedItemRequestPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link
              href={DASHBOARD_REQUESTED_ITEMS_ROUTE}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Requested items
            </Link>
          </li>
          <li className="flex items-center gap-1.5" aria-hidden>
            <ChevronRight className="size-3.5 shrink-0 opacity-60" />
            <span className="text-muted-foreground">AI-assisted request</span>
          </li>
        </ol>
      </nav>

      <header className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            Smart listing read
          </div>
          <div className="space-y-2">
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Request an item with AI help
            </h1>
            <p className="max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
              Paste a product link, preview the store in your browser, then let AI
              pull title, variant, and a merchandise estimate from the page. You
              review everything before staff quotes you.
            </p>
          </div>
          <ol className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            {[
              { step: "1", label: "Load preview", detail: "Shop the listing here" },
              { step: "2", label: "Fill with AI", detail: "Match URL & quantity" },
              { step: "3", label: "Submit", detail: "Staff reviews & quotes" },
            ].map(({ step, label, detail }) => (
              <li
                key={step}
                className="flex min-w-0 items-start gap-3 rounded-xl border border-border/80 bg-background/60 px-3 py-2.5 shadow-sm backdrop-blur sm:max-w-[13rem]"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {step}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {label}
                  </span>
                  <span className="text-xs text-muted-foreground">{detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href={DASHBOARD_ADD_ITEM_ROUTES.productsActive}
              className="inline-flex items-center justify-center rounded-lg border border-transparent bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              View your requests
            </Link>
          </div>
        </div>
      </header>

      <ItemRequestWorkspace />
    </div>
  );
}
