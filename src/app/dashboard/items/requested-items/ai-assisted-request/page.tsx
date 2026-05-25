import { auth } from "@clerk/nextjs/server";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { ItemRequestWorkspace } from "@/components/dashboard/item-request-workspace";
import { DashboardPageTitleWithHelp } from "@/components/dashboard/dashboard-page-title-with-help";
import { getActiveSpotlightProductForPrefill } from "@/data/spotlight-category-products";
import { Button } from "@/components/ui/button";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { DASHBOARD_REQUESTED_ITEMS_ROUTE } from "@/lib/dashboard-items-routes";
import {
  normalizeSpotlightProductUrlInput,
  resolveSpotlightProductPageMeta,
} from "@/lib/spotlight-product-preview";
import { sanitizeSpotlightUuidQueryParam } from "@/lib/spotlight-request-prefill";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Product from store",
    description:
      "Paste the retailer URL and load variants (SerpAPI) to confirm size, color, and price.",
  },
  {
    step: "02",
    title: "Request details",
    description:
      "Apply a store variant to fill the form, or edit fields manually. Use Compare prices tab to check other retailers.",
  },
  {
    step: "03",
    title: "Submit for review",
    description: "Send the completed request to staff for verification and an official quote.",
  },
] as const;

function firstQueryParam(
  raw: string | string[] | undefined,
): string | undefined {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0];
  return undefined;
}

export default async function DashboardAiAssistedItemRequestPage({
  searchParams,
}: PageProps) {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const rawSp = (await searchParams) ?? {};
  const spotlightProductId = sanitizeSpotlightUuidQueryParam(
    firstQueryParam(rawSp.spotlightProductId),
  );
  const spotlightVariantId = sanitizeSpotlightUuidQueryParam(
    firstQueryParam(rawSp.spotlightVariantId),
  );
  const productUrlParam = firstQueryParam(rawSp.productUrl);
  const normalizedUrl = normalizeSpotlightProductUrlInput(productUrlParam ?? "");

  let spotlightPrefill = null;
  try {
    spotlightPrefill = await getActiveSpotlightProductForPrefill({
      id: spotlightProductId,
      variantId: spotlightVariantId,
      productUrl: normalizedUrl ?? undefined,
    });
  } catch {
    spotlightPrefill = null;
  }

  if (spotlightPrefill) {
    const needsImage = !spotlightPrefill.imageUrl?.trim();
    const needsName = !spotlightPrefill.label?.trim();
    if (needsImage || needsName) {
      try {
        const meta = await resolveSpotlightProductPageMeta(
          spotlightPrefill.productUrl,
        );
        spotlightPrefill = {
          ...spotlightPrefill,
          imageUrl:
            spotlightPrefill.imageUrl?.trim() || meta.imageUrl || null,
          label: spotlightPrefill.label?.trim() || meta.title || null,
        };
      } catch {
        // Keep DB values only.
      }
    }
  }

  const initialProductUrl =
    spotlightPrefill?.productUrl ?? normalizedUrl ?? undefined;

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
            <span className="font-medium text-foreground">
              AI-assisted request
            </span>
          </li>
        </ol>
      </nav>

      <header className="space-y-8 border-b border-border pb-8">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            New item request
          </p>
          <DashboardPageTitleWithHelp
            title="AI-assisted item request"
            tooltipClassName="w-[28rem]"
            help={
              <>
                Provide a product URL, review the listing, and submit structured details for staff
                review. AI can extract title, variant, and an estimated merchandise total, or help
                you compare verified offers from other retailers before submission.
              </>
            }
          />
        </div>

        <ol className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          {WORKFLOW_STEPS.map(({ step, title, description }) => (
            <li
              key={step}
              className="flex flex-col gap-2 bg-background px-4 py-4 sm:px-5"
            >
              <span className="font-mono text-xs font-medium tabular-nums text-muted-foreground">
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
            render={
              <Link href={DASHBOARD_ADD_ITEM_ROUTES.productsActive} />
            }
            variant="outline"
            size="sm"
          >
            View submitted requests
          </Button>
        </div>
      </header>

      <ItemRequestWorkspace
        initialProductUrl={initialProductUrl}
        spotlightPrefill={spotlightPrefill}
      />
    </div>
  );
}
