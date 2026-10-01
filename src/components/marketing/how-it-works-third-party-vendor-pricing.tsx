"use client";

import { Info } from "lucide-react";

import { OutboundCompanyAdButton } from "@/components/shipping/outbound-company-ad-button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="overflow-hidden rounded-lg border border-border/70">
      <div className="grid grid-cols-[minmax(0,1.1fr)_auto_auto] gap-2 border-b border-border/70 bg-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{isZone ? "Zone / location" : "Container"}</span>
        <span className="text-right">1 container</span>
        <span className="text-right">Each extra</span>
      </div>
      <ul>
        {rows.map((row, index) => (
          <li
            key={row.rowLabel}
            className={`grid grid-cols-[minmax(0,1.1fr)_auto_auto] gap-2 px-3 py-2 text-xs ${
              index % 2 === 0 ? "bg-card" : "bg-muted"
            }`}
          >
            <span className="min-w-0 break-words font-medium text-foreground">
              {row.rowLabel}
            </span>
            <span className="text-right tabular-nums font-semibold text-primary">
              {formatUsd(row.costOneCents)}
            </span>
            <span className="text-right tabular-nums font-semibold text-primary">
              {formatUsd(row.costTwoPlusCents)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatServiceLabel(label: string): string {
  if (!label.trim()) return label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function CompanyCard({
  company,
  identity = "full",
}: {
  company: PublicOutboundCompanyPricingCard;
  identity?: "full" | "service";
}) {
  const serviceOnly = identity === "service";
  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-card/80 px-3 py-3">
      {serviceOnly ?
        <p className="inline-flex items-center rounded-full border border-primary/35 bg-primary/10 px-3.5 py-1.5 text-sm font-semibold tracking-tight text-primary">
          {formatServiceLabel(company.serviceLabel)}
        </p>
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
              <p
                className="font-semibold text-primary"
                title="Where this company transports the container from"
              >
                {company.location}
              </p>
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
  serviceOnlyKeys,
}: {
  title: string;
  description: string;
  companies: PublicOutboundCompanyPricingCard[];
  serviceOnlyKeys?: ReadonlySet<string>;
}) {
  if (companies.length === 0) return null;
  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/40 px-3 py-2.5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
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
            identity={
              serviceOnlyKeys?.has(company.companyKey) ? "service" : "full"
            }
          />
        ))}
      </div>
    </div>
  );
}

export function HowItWorksThirdPartyVendorPricing({
  companies,
}: {
  companies: PublicOutboundCompanyPricingCard[];
}) {
  if (companies.length === 0) return null;
  const inUs = companies.filter((company) =>
    publicCompanyVendorHeadings(company.kinds).includes("in-us"),
  );
  const overseas = companies.filter((company) =>
    publicCompanyVendorHeadings(company.kinds).includes("overseas"),
  );
  const inUsKeys = new Set(inUs.map((company) => company.companyKey));
  const overseasServiceOnlyKeys = new Set(
    overseas
      .filter(
        (company) =>
          inUsKeys.has(company.companyKey) && company.kinds.length >= 2,
      )
      .map((company) => company.companyKey),
  );

  return (
    <Card className="border-primary/25 bg-card/80 shadow-md ring-1 ring-primary/10 backdrop-blur-sm">
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="font-heading text-base">
          Third-party vendors
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed">
          Published freight, broker, and local courier companies. Freight sits
          under In-US vendor; broker and local courier sit under Overseas
          third-party vendor. Freight + broker (or other bundled) companies are
          marked as such; a single-kind company is standalone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <VendorGroup
          title="In-US vendor"
          description="Freight companies that move a container from the United States warehouse to the destination port."
          companies={inUs}
        />
        <VendorGroup
          title="Overseas third-party vendor"
          description="Destination-country clearance and local transportation after the container arrives."
          companies={overseas}
          serviceOnlyKeys={overseasServiceOnlyKeys}
        />
        <p className="inline-flex items-start gap-2 rounded-lg border border-border/70 bg-muted px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          The first unpaid container uses the 1-container cost. Each extra
          linked unpaid container adds the extra-container cost. Your dashboard
          shows the exact total for your barrels.
        </p>
      </CardContent>
    </Card>
  );
}
