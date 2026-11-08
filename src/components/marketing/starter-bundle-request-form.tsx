"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitStarterBundleQuoteAction } from "@/actions/submit-starter-bundle-quote";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input";
import type { PublishedStarterBundleDetail } from "@/data/starter-bundles";
import { formatUsd } from "@/lib/admin-markup";
import { dashboardBatchQuotesActiveCreatedHref } from "@/lib/dashboard-add-item-routes";
import {
  STARTER_BUNDLE_FEE_DISCLAIMER,
  STARTER_BUNDLES_ROUTES,
} from "@/lib/starter-bundles";
import { cn } from "@/lib/utils";

export function StarterBundleRequestForm({
  initialBundle,
  isSignedIn,
  preview,
}: {
  initialBundle: PublishedStarterBundleDetail;
  isSignedIn: boolean;
  preview?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [bundle, setBundle] = useState(initialBundle);
  const [customerNote, setCustomerNote] = useState("");
  const [staleMessage, setStaleMessage] = useState<string | null>(null);
  const signInHref = `/login?redirect_url=${encodeURIComponent(STARTER_BUNDLES_ROUTES.detail(bundle.id))}`;

  function submit() {
    if (preview) {
      toast.error("Preview only — publish this bundle before shoppers can request an estimate.");
      return;
    }
    if (!isSignedIn) {
      router.push(signInHref);
      return;
    }
    startTransition(async () => {
      const res = await submitStarterBundleQuoteAction({
        bundleId: bundle.id,
        bundleUpdatedAt: bundle.updatedAt,
        customerNote: customerNote.trim() || undefined,
      });
      if (!res.ok) {
        if (res.code === "archived" || res.code === "missing") {
          toast.error(res.message);
          router.push(`${STARTER_BUNDLES_ROUTES.listing}?notice=archived`);
          return;
        }
        if (res.code === "stale" && res.bundle) {
          setBundle(res.bundle);
          setStaleMessage(res.message);
          toast.error(res.message);
          return;
        }
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.push(dashboardBatchQuotesActiveCreatedHref(res.batchSessionId));
    });
  }

  return (
    <div className="space-y-8">
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        className="-ml-2 w-fit gap-1.5 text-muted-foreground hover:text-foreground"
        render={<Link href="/" prefetch={false} />}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to home
      </Button>
      {preview ?
        <p className="rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Admin preview. Shoppers only see this bundle after it is published.
        </p>
      : null}
      {staleMessage ?
        <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          {staleMessage}
        </p>
      : null}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {bundle.imageUrl ?
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bundle.imageUrl}
            alt=""
            className="h-44 w-full rounded-2xl border border-border object-cover shadow-sm sm:h-48 sm:w-60"
          />
        : null}
        <div className="min-w-0 space-y-3">
          <div className="space-y-1.5">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              {bundle.name}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {bundle.description}
            </p>
          </div>
          {bundle.barrelSize || bundle.barrelFillLevel ?
            <p className="text-sm text-muted-foreground">
              {bundle.barrelSize ? `Barrel size: ${bundle.barrelSize}` : null}
              {bundle.barrelSize && bundle.barrelFillLevel ? " · " : null}
              {bundle.barrelFillLevel
                ? `Approximate fill: ${bundle.barrelFillLevel}`
                : null}
            </p>
          : null}
          <div className="space-y-0.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Estimated merchandise subtotal
            </p>
            <p className="font-heading text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {formatUsd(bundle.merchandiseSubtotalCents)}
            </p>
          </div>
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {STARTER_BUNDLE_FEE_DISCLAIMER}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Color / variant</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Estimated unit price</th>
              <th className="px-4 py-3 font-medium">Line total</th>
            </tr>
          </thead>
          <tbody>
            {bundle.items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 font-medium text-foreground">{item.productName}</td>
                <td className="px-4 py-3 tabular-nums">{item.quantity}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.productColor || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.productSize || "—"}</td>
                <td className="px-4 py-3 tabular-nums">
                  {formatUsd(item.estimatedUnitPriceCents)}
                </td>
                <td className="px-4 py-3 tabular-nums font-medium">
                  {formatUsd(item.lineTotalCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="starter-bundle-note" className="text-sm font-medium text-foreground">
          Add a note (optional)
        </label>
        <textarea
          id="starter-bundle-note"
          value={customerNote}
          disabled={pending || preview}
          rows={3}
          className={cn(inputFieldClassName, "min-h-24 rounded-2xl px-3.5 py-3")}
          onChange={(e) => setCustomerNote(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isSignedIn || preview ?
          <Button
            type="button"
            disabled={pending || preview}
            className="h-11 rounded-full px-5 text-sm font-semibold"
            onClick={submit}
          >
            {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
            Request an estimate
          </Button>
        : <Button
            nativeButton={false}
            className="h-11 rounded-full px-5 text-sm font-semibold"
            render={<Link href={signInHref} prefetch={false} />}
          >
            Sign in to request an estimate
          </Button>}
        <Button
          type="button"
          variant="ghost"
          nativeButton={false}
          className="h-11 rounded-full px-4 text-muted-foreground hover:text-foreground"
          render={<Link href={STARTER_BUNDLES_ROUTES.listing} prefetch={false} />}
        >
          Back to bundles
        </Button>
      </div>
    </div>
  );
}
