"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CartCheckoutProductUrlRevealProps = {
  /** Stable id for a11y (e.g. item request id). */
  lineId: string;
  productUrl: string;
};

export function CartCheckoutProductUrlReveal({
  lineId,
  productUrl,
}: CartCheckoutProductUrlRevealProps) {
  const [open, setOpen] = useState(false);
  const panelId = `checkout-product-url-${lineId}`;
  const btnId = `checkout-product-url-btn-${lineId}`;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs font-medium"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        id={btnId}
      >
        {open ? "Hide Product Url" : "View Product Url"}
      </Button>
      {open ?
        <div
          id={panelId}
          role="region"
          aria-labelledby={btnId}
          className={cn(
            "rounded-md border border-border/60 bg-muted px-3 py-2",
            "text-xs leading-relaxed"
          )}
        >
          <a
            href={productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-1.5 break-all text-primary hover:underline"
          >
            <span>{productUrl}</span>
            <ExternalLink className="mt-0.5 size-3.5 shrink-0 opacity-70" aria-hidden />
          </a>
        </div>
      : null}
    </div>
  );
}
