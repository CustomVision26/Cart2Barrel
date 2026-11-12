"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitStarterBundleQuoteAction } from "@/actions/submit-starter-bundle-quote";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, inputFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublishedStarterBundleDetail } from "@/data/starter-bundles";
import { formatUsd } from "@/lib/admin-markup";
import { centsToUsdInput, parseUsdToCents } from "@/lib/admin-pricing-form-utils";
import { dashboardBatchQuotesActiveCreatedHref } from "@/lib/dashboard-add-item-routes";
import {
  STARTER_BUNDLE_FEE_DISCLAIMER,
  STARTER_BUNDLES_ROUTES,
  starterBundleLineTotalCents,
  starterBundleMerchandiseSubtotalCents,
} from "@/lib/starter-bundles";
import { cn } from "@/lib/utils";

type BundleItem = PublishedStarterBundleDetail["items"][number];

type ProductEditor = {
  id: string;
  productName: string;
  size: string;
  color: string;
  price: string;
  quantity: string;
  retailerUrl: string | null;
  imageUrl: string | null;
};

function httpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

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
  const [posted, setPosted] = useState(initialBundle);
  const [bundle, setBundle] = useState(initialBundle);
  const [customerNote, setCustomerNote] = useState("");
  const [staleMessage, setStaleMessage] = useState<string | null>(null);
  const [editor, setEditor] = useState<ProductEditor | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const signInHref = `/login?redirect_url=${encodeURIComponent(STARTER_BUNDLES_ROUTES.detail(bundle.id))}`;
  const merchandiseSubtotalCents = starterBundleMerchandiseSubtotalCents(bundle.items);

  function openEditor(item: BundleItem) {
    setEditorError(null);
    setEditor({
      id: item.id,
      productName: item.productName,
      size: item.productSize ?? "",
      color: item.productColor ?? "",
      price: centsToUsdInput(item.estimatedUnitPriceCents),
      quantity: String(item.quantity),
      retailerUrl: httpsUrl(item.retailerUrl),
      imageUrl: httpsUrl(item.productImageUrl),
    });
  }

  function saveEditor() {
    if (!editor) return;
    const priceCents = parseUsdToCents(editor.price);
    const quantity = Number(editor.quantity);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setEditorError("Enter a USD price, such as 12.99.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) {
      setEditorError("Enter a quantity from 1 to 10,000.");
      return;
    }
    setBundle((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === editor.id
          ? {
              ...item,
              productSize: editor.size.trim() || null,
              productColor: editor.color.trim() || null,
              estimatedUnitPriceCents: priceCents,
              quantity,
              lineTotalCents: starterBundleLineTotalCents(quantity, priceCents),
            }
          : item,
      ),
    }));
    setEditor(null);
  }

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
        bundleId: posted.id,
        bundleUpdatedAt: posted.updatedAt,
        customerNote: customerNote.trim() || undefined,
      });
      if (!res.ok) {
        if (res.code === "archived" || res.code === "missing") {
          toast.error(res.message);
          router.push(`${STARTER_BUNDLES_ROUTES.listing}?notice=archived`);
          return;
        }
        if (res.code === "stale" && res.bundle) {
          setPosted(res.bundle);
          setBundle(res.bundle);
          setEditor(null);
          setStaleMessage(res.message);
          toast.error(res.message);
          return;
        }
        toast.error(res.message);
        return;
      }
      setBundle(posted);
      setEditor(null);
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
              {formatUsd(merchandiseSubtotalCents)}
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
            {bundle.items.map((item) => {
              const imageUrl = httpsUrl(item.productImageUrl);
              return (
                <tr key={item.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-3 text-left font-medium text-foreground underline-offset-2 hover:underline"
                      onClick={() => openEditor(item)}
                    >
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageUrl}
                          alt=""
                          className="size-12 shrink-0 rounded-md border border-border object-cover"
                        />
                      ) : (
                        <span className="size-12 shrink-0 rounded-md border border-dashed border-border bg-muted" />
                      )}
                      <span>{item.productName}</span>
                    </button>
                  </td>
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
              );
            })}
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

      <Dialog
        open={editor != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditor(null);
            setEditorError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editor?.productName ?? "Product"}</DialogTitle>
            <DialogDescription>
              Size, color, price, and quantity. Request an estimate sends the bundle as posted
              and returns this list to those values.
            </DialogDescription>
          </DialogHeader>
          {editor ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                saveEditor();
              }}
            >
              <div className="flex items-start gap-3">
                {editor.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={editor.imageUrl}
                    alt=""
                    className="size-16 shrink-0 rounded-md border border-border object-cover"
                  />
                ) : (
                  <span className="size-16 shrink-0 rounded-md border border-dashed border-border bg-muted" />
                )}
                {editor.retailerUrl ? (
                  <a
                    href={editor.retailerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    <ExternalLinkIcon />
                    View on retailer site
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">No retailer page on this product.</p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bundle-product-size">Size</Label>
                  <Input
                    id="bundle-product-size"
                    value={editor.size}
                    onChange={(event) => {
                      setEditorError(null);
                      setEditor({ ...editor, size: event.target.value });
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bundle-product-color">Color</Label>
                  <Input
                    id="bundle-product-color"
                    value={editor.color}
                    onChange={(event) => {
                      setEditorError(null);
                      setEditor({ ...editor, color: event.target.value });
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bundle-product-price">Price (USD)</Label>
                  <Input
                    id="bundle-product-price"
                    inputMode="decimal"
                    value={editor.price}
                    onChange={(event) => {
                      setEditorError(null);
                      setEditor({ ...editor, price: event.target.value });
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bundle-product-quantity">Quantity</Label>
                  <Input
                    id="bundle-product-quantity"
                    type="number"
                    min={1}
                    max={10000}
                    value={editor.quantity}
                    onChange={(event) => {
                      setEditorError(null);
                      setEditor({ ...editor, quantity: event.target.value });
                    }}
                  />
                </div>
              </div>
              {editorError ? <p className="text-sm text-destructive">{editorError}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                  Close
                </Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
