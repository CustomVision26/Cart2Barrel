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
import { formatShippoLiveTrackingStatus } from "@/lib/dashboard-line-tracking";
import { cn } from "@/lib/utils";

type Props = {
  trackingUrl?: string | null;
  retailerCompany?: string | null;
  trackingNumber?: string | null;
  trackingStatus?: string | null;
  trackingStatusDetails?: string | null;
  productLabel: string;
  className?: string;
};

function trimOrEmpty(v: string | null | undefined): string {
  const t = v?.trim() ?? "";
  return t;
}

export function DashboardOrderLineTracking(props: Props) {
  const {
    trackingUrl,
    retailerCompany,
    trackingNumber,
    trackingStatus,
    trackingStatusDetails,
    productLabel,
    className,
  } = props;
  const url = trimOrEmpty(trackingUrl);
  const company = trimOrEmpty(retailerCompany);
  const num = trimOrEmpty(trackingNumber);
  const liveStatus = formatShippoLiveTrackingStatus(trackingStatus, trackingStatusDetails);
  const [openDetails, setOpenDetails] = useState(false);

  const statusChip =
    liveStatus ?
      <span className="text-xs font-medium text-muted-foreground">{liveStatus}</span>
    : null;

  const wrapClass = cn("inline-flex flex-wrap items-center gap-2", className);

  if (url) {
    return (
      <span className={wrapClass}>
        {statusChip}
        <Link
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 inline-flex")}
        >
          Track shipment
          <ExternalLinkIcon className="ms-1.5 size-3.5 opacity-70" aria-hidden />
        </Link>
      </span>
    );
  }

  if (num || company) {
    return (
      <span className={wrapClass}>
        {statusChip}
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
              {liveStatus ?
                <div>
                  <dt className="font-medium text-muted-foreground">Status</dt>
                  <dd className="font-medium text-foreground">{liveStatus}</dd>
                </div>
              : null}
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
      </span>
    );
  }

  if (liveStatus) {
    return statusChip;
  }

  return <span className="text-xs text-muted-foreground">—</span>;
}
