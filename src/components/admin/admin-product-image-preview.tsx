"use client";

import { useEffect, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type AdminProductImagePreviewProps = {
  imageUrl: string | null | undefined;
  productLabel?: string | null;
  productUrl?: string | null;
  className?: string;
  frameClassName?: string;
  imageClassName?: string;
};

export function AdminProductImagePreview({
  imageUrl,
  productLabel,
  productUrl,
  className,
  frameClassName,
  imageClassName,
}: AdminProductImagePreviewProps) {
  const url = imageUrl?.trim() ?? null;
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [url]);

  if (!url) return null;

  const alt =
    productLabel?.trim() ?
      `Product: ${productLabel.trim()}`
    : "Product image";

  return (
    <div
      className={cn(
        "overflow-hidden border border-border bg-muted/30",
        frameClassName ?? "rounded-xl",
        className,
      )}
    >
      {loadFailed ?
        <div className="flex min-h-[8rem] flex-col items-center justify-center gap-2 px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            Preview could not load (retailer may block hotlinking).
          </p>
          {productUrl?.trim() ?
            <a
              href={productUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              Open product page
              <ExternalLinkIcon className="size-3.5" aria-hidden />
            </a>
          : null}
        </div>
      : (
        /* eslint-disable-next-line @next/next/no-img-element -- retailer or Blob URLs */
        <img
          src={url}
          alt={alt}
          className={cn(
            "mx-auto w-full object-contain",
            imageClassName ?? "max-h-44",
          )}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setLoadFailed(true)}
        />
      )}
    </div>
  );
}
