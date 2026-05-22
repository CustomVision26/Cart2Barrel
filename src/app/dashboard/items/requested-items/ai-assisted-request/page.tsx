import { auth } from "@clerk/nextjs/server";
import { ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { ItemRequestWorkspace } from "@/components/dashboard/item-request-workspace";
import { getActiveSpotlightProductForPrefill } from "@/data/spotlight-category-products";
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
              pull title, variant, and a merchandise estimate from the page—or
              compare prices across retailers before you submit.
            </p>
          </div>
          <ol className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            {[
              { step: "1", label: "Load preview", detail: "Shop the listing here" },
              {
                step: "2",
                label: "Fill or compare",
                detail: "AI details or retailer search",
              },
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

      <ItemRequestWorkspace
        initialProductUrl={initialProductUrl}
        spotlightPrefill={spotlightPrefill}
      />
    </div>
  );
}
