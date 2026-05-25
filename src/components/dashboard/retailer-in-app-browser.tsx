"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Loader2,
  RotateCw,
} from "lucide-react";

import { loadProductPreviewMetaAction } from "@/actions/load-product-preview-meta";
import type { ProductPreviewMeta } from "@/actions/load-product-preview-meta";
import { Button } from "@/components/ui/button";
import {
  hostRequiresExternalBrowserPreview,
  isInteractivePreviewBlockedHtml,
} from "@/lib/product-preview-blocked";
import { hostnameFromProductUrl } from "@/lib/site-name";
import { cn } from "@/lib/utils";

const PREVIEW_FRAME_PATH = "/api/product-preview-frame";

function previewFrameSrc(productUrl: string): string {
  return `${PREVIEW_FRAME_PATH}?url=${encodeURIComponent(productUrl)}`;
}

type RetailerInAppBrowserProps = {
  /** Active retailer product URL to show in the in-app browser, or null for empty state. */
  pageUrl: string | null;
  emptyMessage?: string;
  className?: string;
  frameClassName?: string;
};

export function RetailerInAppBrowser({
  pageUrl,
  emptyMessage = "Enter a URL above and select Load preview to display the listing here.",
  className,
  frameClassName,
}: RetailerInAppBrowserProps) {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [frameLoading, setFrameLoading] = useState(false);
  const [meta, setMeta] = useState<ProductPreviewMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [frameBlocked, setFrameBlocked] = useState(false);
  const frameKeyRef = useRef(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeUrl =
    historyIndex >= 0 && history[historyIndex] ? history[historyIndex] : null;

  useEffect(() => {
    if (!pageUrl) {
      setHistory([]);
      setHistoryIndex(-1);
      setMeta(null);
      return;
    }
    setHistory([pageUrl]);
    setHistoryIndex(0);
    const host = hostnameFromProductUrl(pageUrl);
    const needsExternal = host ? hostRequiresExternalBrowserPreview(host) : false;
    setFrameBlocked(needsExternal);
    setFrameLoading(!needsExternal);
    frameKeyRef.current += 1;
  }, [pageUrl]);

  useEffect(() => {
    if (!activeUrl) {
      setMeta(null);
      return;
    }

    let cancelled = false;
    setMetaLoading(true);
    void loadProductPreviewMetaAction({ productUrl: activeUrl }).then((res) => {
      if (cancelled) return;
      setMetaLoading(false);
      if (res.ok) {
        setMeta(res.meta);
      } else {
        setMeta({ href: activeUrl, title: null, imageUrl: null });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeUrl]);

  const hostname = useMemo(
    () => (activeUrl ? hostnameFromProductUrl(activeUrl) : null),
    [activeUrl],
  );

  const windowTitle =
    meta?.title?.trim() || hostname || "Retailer preview";

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex >= 0 && historyIndex < history.length - 1;

  const openExternal = useCallback(() => {
    if (!activeUrl) return;
    window.open(activeUrl, "_blank", "noopener,noreferrer");
  }, [activeUrl]);

  const refresh = useCallback(() => {
    if (!activeUrl) return;
    const host = hostnameFromProductUrl(activeUrl);
    const needsExternal = host ? hostRequiresExternalBrowserPreview(host) : false;
    setFrameBlocked(needsExternal);
    setFrameLoading(!needsExternal);
    frameKeyRef.current += 1;
  }, [activeUrl]);

  const goBack = useCallback(() => {
    setHistoryIndex((i) => (i > 0 ? i - 1 : i));
    setFrameLoading(true);
    frameKeyRef.current += 1;
  }, []);

  const goForward = useCallback(() => {
    setHistoryIndex((i) =>
      i < history.length - 1 ? i + 1 : i,
    );
    setFrameLoading(true);
    frameKeyRef.current += 1;
  }, [history.length]);

  const frameSrc =
    activeUrl && !frameBlocked ? previewFrameSrc(activeUrl) : null;

  const handleFrameLoad = useCallback(() => {
    setFrameLoading(false);
    if (frameBlocked) return;
    try {
      const doc = iframeRef.current?.contentDocument;
      if (
        doc?.body?.dataset.cart2barrelPreview === "blocked-interactive" ||
        isInteractivePreviewBlockedHtml(doc?.body?.innerText ?? "")
      ) {
        setFrameBlocked(true);
      }
    } catch {
      // Cross-origin or empty document — ignore.
    }
  }, [frameBlocked]);

  const previewBodyClass = cn(
    "h-[min(72vh,560px)] w-full xl:h-[min(78vh,620px)]",
    frameClassName,
  );

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-md border border-border bg-background shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted px-3 py-2">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-red-500/70" />
          <span className="size-2.5 rounded-full bg-amber-500/70" />
          <span className="size-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <p className="min-w-0 flex-1 truncate text-center text-xs font-medium text-foreground">
          {activeUrl ? windowTitle : "Product preview"}
        </p>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={refresh}
            disabled={!activeUrl}
            aria-label="Refresh preview"
          >
            <RotateCw className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={openExternal}
            disabled={!activeUrl}
            aria-label="Open in new tab"
          >
            <ExternalLink className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-b border-border bg-muted px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={goBack}
          disabled={!canGoBack}
          aria-label="Back"
        >
          <ArrowLeft className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={goForward}
          disabled={!canGoForward}
          aria-label="Forward"
        >
          <ArrowRight className="size-3.5" />
        </Button>
        <div
          className="min-w-0 flex-1 truncate rounded-md border border-border/80 bg-background px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground"
          title={activeUrl ?? undefined}
        >
          {activeUrl ?? "https://…"}
        </div>
      </div>

      <div className="relative bg-secondary">
        {activeUrl && (meta?.imageUrl || metaLoading) ?
          <div className="flex items-center gap-3 border-b border-border/60 bg-muted px-3 py-2">
            {meta?.imageUrl ?
              <img
                src={meta.imageUrl}
                alt=""
                className="size-10 shrink-0 rounded border border-border object-cover"
              />
            : (
              <div className="size-10 shrink-0 animate-pulse rounded border border-border bg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {meta?.title ?? (metaLoading ? "Loading listing…" : hostname)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {hostname ?? activeUrl}
              </p>
            </div>
          </div>
        : null}

        {activeUrl && frameBlocked ?
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-5 px-6 py-10 text-center",
              previewBodyClass,
            )}
          >
            <div className="max-w-md space-y-2">
              <p className="text-sm font-medium text-foreground">
                {hostname ?? "This store"} can&apos;t be browsed inside the preview
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                You may see &quot;press and hold&quot; or &quot;robot or human&quot;
                text with no button—that check only works in a normal browser tab
                with JavaScript. It will not work here.
              </p>
            </div>
            {meta?.imageUrl ?
              <img
                src={meta.imageUrl}
                alt=""
                className="max-h-40 rounded-lg border border-border object-contain"
              />
            : null}
            <Button type="button" size="lg" onClick={openExternal}>
              <ExternalLink className="size-4" />
              Open listing on {hostname ?? "retailer site"}
            </Button>
            <p className="max-w-sm text-xs text-muted-foreground">
              Complete any verification in that tab, then return here to fill in
              or submit your request using the product summary above.
            </p>
          </div>
        : frameSrc ?
          <div className="relative">
            {frameLoading ?
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-card backdrop-blur-[1px]">
                <Loader2
                  className="size-6 animate-spin text-muted-foreground"
                  aria-hidden
                />
                <span className="sr-only">Loading retailer page</span>
              </div>
            : null}
            <iframe
              ref={iframeRef}
              key={`${frameKeyRef.current}-${activeUrl}`}
              title={`Retailer preview: ${windowTitle}`}
              src={frameSrc}
              className={cn("bg-background", previewBodyClass)}
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={handleFrameLoad}
            />
          </div>
        : (
          <div
            className={cn(
              "flex items-center justify-center px-6 text-center text-sm text-muted-foreground",
              previewBodyClass,
            )}
          >
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}
