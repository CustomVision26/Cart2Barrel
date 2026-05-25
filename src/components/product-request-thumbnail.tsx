"use client";

import { cn } from "@/lib/utils";

export type ProductRequestThumbnailVariant = "list" | "cart" | "dialog" | "admin";

const frameByVariant: Record<ProductRequestThumbnailVariant, string> = {
  list: "w-14 max-w-[3.5rem] shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:w-16 sm:max-w-[4rem]",
  cart: "shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:w-28 w-full max-w-[11rem]",
  dialog:
    "w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:w-20",
  admin:
    "w-11 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:w-12",
};

const imgByVariant: Record<ProductRequestThumbnailVariant, string> = {
  list: "aspect-square size-full object-cover",
  cart: "aspect-square w-full max-w-[11rem] object-cover sm:max-w-none",
  dialog: "aspect-square size-full object-cover",
  admin: "aspect-square size-full object-cover",
};

type ProductRequestThumbnailProps = {
  imageUrl: string | null | undefined;
  productLabel?: string | null;
  variant?: ProductRequestThumbnailVariant;
  className?: string;
};

export function ProductRequestThumbnail({
  imageUrl,
  productLabel,
  variant = "list",
  className,
}: ProductRequestThumbnailProps) {
  const url = imageUrl?.trim();
  const altBase = productLabel?.trim() || "Product";

  if (url) {
    return (
      <div className={cn(frameByVariant[variant], className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- external retailer CDN URLs */}
        <img
          src={url}
          alt={`Photo: ${altBase}`}
          className={imgByVariant[variant]}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        frameByVariant[variant],
        "flex items-center justify-center border-dashed bg-muted text-center text-[10px] leading-tight text-muted-foreground",
        className
      )}
      aria-hidden
    >
      No photo
    </div>
  );
}
