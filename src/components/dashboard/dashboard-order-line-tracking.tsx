"use client";

import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  trackingUrl?: string | null;
  retailerCompany?: string | null;
  trackingNumber?: string | null;
  productLabel: string;
};

function trimOrEmpty(v: string | null | undefined): string {
  const t = v?.trim() ?? "";
  return t;
}

export function DashboardOrderLineTracking(props: Props) {
  const { trackingUrl, retailerCompany, trackingNumber, productLabel } = props;
  const url = trimOrEmpty(trackingUrl);
  const company = trimOrEmpty(retailerCompany);
  const num = trimOrEmpty(trackingNumber);
  const [openDetails, setOpenDetails] = useState(false);

  if (url) {
    return (
      <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 inline-flex")}
      >
        Track shipment
        <ExternalLinkIcon className="ms-1.5 size-3.5 opacity-70" aria-hidden />
      </Link>
    );
  }

  if (num || company) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => setOpenDetails(true)}
        >
          Tracking details
        </Button>
        <Dialog open={openDetails} onOpenChange={setOpenDetails}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Shipment tracking</DialogTitle>
              <DialogDescription>{productLabel}</DialogDescription>
            </DialogHeader>
            <dl className="grid gap-3 text-sm">
              {company ?
                <div>
                  <dt className="font-medium text-muted-foreground">Carrier / retailer</dt>
                  <dd className="font-medium text-foreground">{company}</dd>
                </div>
              : null}
              {num ?
                <div>
                  <dt className="font-medium text-muted-foreground">Tracking number</dt>
                  <dd className="break-all font-mono text-[13px] text-foreground">{num}</dd>
                </div>
              : null}
            </dl>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return <span className="text-xs text-muted-foreground">—</span>;
}
