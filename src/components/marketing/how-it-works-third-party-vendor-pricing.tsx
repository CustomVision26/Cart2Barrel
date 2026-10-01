"use client";

import { Info, Ship } from "lucide-react";
import { useState, type CSSProperties } from "react";

import { OutboundCompanyAdButton } from "@/components/shipping/outbound-company-ad-button";
import { PricingOverviewSection } from "@/components/marketing/how-it-works-pricing-overview";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  publicCompanyVendorHeadings,
  type PublicOutboundCompanyPricingCard,
} from "@/lib/public-outbound-company-pricing";
import { formatUsd } from "@/lib/admin-markup";

function RateTable({
  tableKind,
  rows,
}: PublicOutboundCompanyPricingCard["rateTables"][number]) {
  const isZone = tableKind === "zone";
  return (
    <div className="space-y-1.5">
      <div className="pricing-overview-ledger overflow-hidden rounded-lg">
        <div className="pricing-overview-ledger-head grid grid-cols-[minmax(0,1.1fr)_auto_auto] gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
          <span>{isZone ? "Zone / location" : "Container"}</span>
          <span className="text-right">1 container</span>
          <span className="text-right">Each extra</span>
        </div>
        <ul>
          {rows.map((row, rowIndex) => (
            <li
              key={row.rowLabel}
              className="pricing-overview-row grid grid-cols-[minmax(0,1.1fr)_auto_auto] gap-2 px-3 py-2 text-xs transition-colors"
              style={
                {
                  "--pricing-row-index": rowIndex,
                } as CSSProperties
              }
            >
              <span className="min-w-0 break-words font-medium text-foreground">
                {row.rowLabel}
              </span>
              <span className="pricing-overview-fee text-right tabular-nums font-semibold">
                {formatUsd(row.costOneCents)}
              </span>
              <span className="pricing-overview-fee text-right tabular-nums font-semibold">
                {formatUsd(row.costTwoPlusCents)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {isZone ? null : (
        <p className="text-[11px] leading-snug text-muted-foreground">
          These freight charges do not include the pickup fee.
        </p>
      )}
    </div>
  );
}

function ServiceOfferedDialog({
  companyName,
  note,
}: {
  companyName: string;
  note: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="size-7 shrink-0 rounded-full"
        aria-label={`Service offered by ${companyName}`}
        onClick={() => setOpen(true)}
      >
        <Info className="size-3.5" aria-hidden />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(90vh,32rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Service offered</DialogTitle>
            <DialogDescription className="whitespace-pre-wrap text-left text-sm leading-relaxed text-foreground">
              {note}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ServiceBadge({
  label,
  showServiceInfo,
  companyName,
  serviceNote,
}: {
  label: string;
  showServiceInfo?: boolean;
  companyName: string;
  serviceNote: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="inline-flex items-center rounded-full border border-primary/35 bg-primary/10 px-3.5 py-1.5 text-sm font-semibold tracking-tight text-primary">
        {label}
      </p>
      {showServiceInfo ?
        <ServiceOfferedDialog companyName={companyName} note={serviceNote} />
      : null}
    </div>
  );
}

function CompanyCard({
  company,
  identity = "full",
  showServiceInfo = false,
}: {
  company: PublicOutboundCompanyPricingCard;
  identity?: "full" | "service";
  showServiceInfo?: boolean;
}) {
  const serviceOnly = identity === "service";
  const serviceNote =
    company.customerNote?.trim() ||
    "This company moves a container from the United States warehouse to the destination port.";
  return (
    <div className="pricing-overview-vendor-card space-y-3 overflow-visible rounded-lg px-3 py-3">
      {serviceOnly ?
        <ServiceBadge
          label={company.serviceLabel}
          showServiceInfo={showServiceInfo}
          companyName={company.companyName}
          serviceNote={serviceNote}
        />
      : (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-heading text-sm font-semibold text-foreground">
              {company.companyName}
            </p>
            <OutboundCompanyAdButton
              imageUrl={company.imageUrl}
              companyName={company.companyName}
            />
          </div>
          <StatusBadge kind="quoted">{company.serviceLabel}</StatusBadge>
          <div className="space-y-0.5 text-xs leading-relaxed text-muted-foreground">
            {company.country ? <p>{company.country}</p> : null}
            {company.location ?
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge kind="quoted">Operate from</StatusBadge>
                <p
                  className="font-semibold text-primary"
                  title="Where this company operates from"
                >
                  {company.location}
                </p>
              </div>
            : null}
            {company.address ?
              <p className="whitespace-pre-wrap">{company.address}</p>
            : null}
            {company.phone ? <p>Tel {company.phone}</p> : null}
          </div>
        </div>
      )}
      {company.rateTables.length > 0 ?
        company.rateTables.map((table) => (
          <RateTable key={table.tableKind} {...table} />
        ))
      : (
        <p className="text-xs text-muted-foreground">
          Rate table is not published for this company yet.
        </p>
      )}
    </div>
  );
}

function VendorGroup({
  title,
  description,
  companies,
  showServiceInfo = false,
  identity = "full",
}: {
  title: string;
  description: string;
  companies: PublicOutboundCompanyPricingCard[];
  showServiceInfo?: boolean;
  identity?: "full" | "service";
}) {
  if (companies.length === 0) return null;
  return (
    <div className="space-y-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground">
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="space-y-3">
        {companies.map((company) => (
          <CompanyCard
            key={company.companyKey}
            company={company}
            identity={identity}
            showServiceInfo={showServiceInfo}
          />
        ))}
      </div>
    </div>
  );
}

export function HowItWorksThirdPartyVendorPricing({
  companies,
  index = 5,
}: {
  companies: PublicOutboundCompanyPricingCard[];
  index?: number;
}) {
  if (companies.length === 0) return null;
  const inUs = companies.filter((company) =>
    publicCompanyVendorHeadings(company.kinds).includes("in-us"),
  );
  const inUsKeys = new Set(inUs.map((company) => company.companyKey));
  const overseas = companies.filter((company) => {
    if (!publicCompanyVendorHeadings(company.kinds).includes("overseas")) {
      return false;
    }
    return !inUsKeys.has(company.companyKey);
  });

  return (
    <PricingOverviewSection
      index={index}
      icon={<Ship className="size-4" />}
      title="Third-party vendors"
      description="Published freight, broker, and local courier companies. Freight sits under In-US vendor; broker and local courier sit under Overseas third-party vendor."
      accent="rose"
      footer={
        <p className="inline-flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          The first unpaid container uses the 1-container cost. Each extra
          linked unpaid container adds the extra-container cost. Your dashboard
          shows the exact total for your barrels.
        </p>
      }
    >
      <div className="space-y-4">
        <VendorGroup
          title="In-US vendor"
          description="Freight companies that move a container from the United States warehouse to the destination port."
          companies={inUs}
          identity="service"
          showServiceInfo
        />
        <VendorGroup
          title="Overseas third-party vendor"
          description="Destination-country clearance and local transportation after the container arrives."
          companies={overseas}
        />
      </div>
    </PricingOverviewSection>
  );
}
