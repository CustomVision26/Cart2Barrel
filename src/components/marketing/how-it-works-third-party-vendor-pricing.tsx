"use client";

import { Info, Ship } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";

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

type PublicRateTable = PublicOutboundCompanyPricingCard["rateTables"][number];
type PublicPickupRate = PublicOutboundCompanyPricingCard["pickupRates"][number];

function pickupRateForContainer(
  pickupRates: readonly PublicPickupRate[],
  containerLabel: string,
): PublicPickupRate | null {
  const hint = containerLabel.trim().toLowerCase();
  if (!hint) return null;
  return (
    pickupRates.find((row) => row.rowLabel.trim().toLowerCase() === hint) ??
    pickupRates.find((row) => {
      const label = row.rowLabel.trim().toLowerCase();
      return label.includes(hint) || hint.includes(label);
    }) ??
    null
  );
}

function uniqueRateDestinations(tables: PublicRateTable[]): string[] {
  const seen = new Set<string>();
  const dests: string[] = [];
  for (const table of tables) {
    for (const row of table.rows) {
      const dest = row.destination?.trim();
      if (!dest) continue;
      const key = dest.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      dests.push(dest);
    }
  }
  return dests;
}

function partnerDestination(
  company: PublicOutboundCompanyPricingCard,
): string | null {
  return company.location?.trim() || company.country?.trim() || null;
}

function cardDestinations(
  company: PublicOutboundCompanyPricingCard,
): string[] {
  const fromRates = uniqueRateDestinations(company.rateTables);
  if (fromRates.length > 0) return fromRates;
  const isFreight = company.kinds.includes("freight");
  const partner = isFreight
    ? company.country?.trim() || company.location?.trim() || null
    : partnerDestination(company);
  return partner ? [partner] : [];
}

function tablesForDestination(
  tables: PublicRateTable[],
  destination: string,
): PublicRateTable[] {
  const key = destination.trim().toLowerCase();
  return tables
    .map((table) => {
      if (table.tableKind !== "container") return table;
      const hasLabeled = table.rows.some((row) => row.destination?.trim());
      const rows = hasLabeled
        ? table.rows.filter(
            (row) => row.destination?.trim().toLowerCase() === key,
          )
        : table.rows;
      return { ...table, rows };
    })
    .filter((table) => table.rows.length > 0);
}

function PickupChargeButton({
  containerLabel,
  pickupRate,
}: {
  containerLabel: string;
  pickupRate: PublicPickupRate | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-6 shrink-0 rounded-full px-2 text-[10px] font-semibold"
        aria-label={`Pickup charge for ${containerLabel}`}
        onClick={() => setOpen(true)}
      >
        Pickup
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(90vh,32rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pickup charge — {containerLabel}</DialogTitle>
            <DialogDescription>
              These rates are the pickup fee to move a {containerLabel.toLowerCase()}{" "}
              from the hub to this company&apos;s freight office. They are not
              the ocean freight charge.
            </DialogDescription>
          </DialogHeader>
          {pickupRate ? (
            <div className="space-y-1.5">
              <div className="pricing-overview-ledger overflow-hidden rounded-lg">
                <div className="pricing-overview-ledger-head grid grid-cols-[minmax(0,1.1fr)_auto_auto] gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
                  <span>Container</span>
                  <span className="text-right">1 container</span>
                  <span className="text-right">Each extra</span>
                </div>
                <ul>
                  <li className="pricing-overview-row grid grid-cols-[minmax(0,1.1fr)_auto_auto] gap-2 px-3 py-2 text-xs">
                    <span className="min-w-0 break-words font-medium text-foreground">
                      {pickupRate.rowLabel}
                    </span>
                    <span className="pricing-overview-fee text-right tabular-nums font-semibold">
                      {formatUsd(pickupRate.costOneCents)}
                    </span>
                    <span className="pricing-overview-fee text-right tabular-nums font-semibold">
                      {formatUsd(pickupRate.costTwoPlusCents)}
                    </span>
                  </li>
                </ul>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                One billed container uses the 1-container pickup fee. Two or
                more containers on the same freight quote use the extra-container
                fee for every container.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No pickup fee is published for {containerLabel}.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RateTable({
  tableKind,
  rows,
  pickupRates = [],
}: PublicRateTable & { pickupRates?: readonly PublicPickupRate[] }) {
  const isZone = tableKind === "zone";
  const showPickup = !isZone && tableKind === "container";
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
              key={`${row.rowLabel}:${row.destination ?? ""}`}
              className="pricing-overview-row grid grid-cols-[minmax(0,1.1fr)_auto_auto] gap-2 px-3 py-2 text-xs transition-colors"
              style={
                {
                  "--pricing-row-index": rowIndex,
                } as CSSProperties
              }
            >
              <span className="flex min-w-0 flex-wrap items-center gap-1.5 font-medium text-foreground">
                <span className="min-w-0 break-words">{row.rowLabel}</span>
                {showPickup ?
                  <PickupChargeButton
                    containerLabel={row.rowLabel}
                    pickupRate={pickupRateForContainer(pickupRates, row.rowLabel)}
                  />
                : null}
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
          These freight charges do not include the pickup fee. Open Pickup next
          to a container type for that type&apos;s hub-to-office fee.
        </p>
      )}
    </div>
  );
}

function DestinationButton({
  destination,
  onClick,
}: {
  destination: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 rounded-full border-primary/35 bg-primary/10 px-3.5 text-sm font-semibold tracking-tight text-primary hover:bg-primary/15"
      aria-label={`Show charges for ${destination}`}
      onClick={onClick}
    >
      {destination}
    </Button>
  );
}

function CompanyIdentity({
  company,
}: {
  company: PublicOutboundCompanyPricingCard;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-heading text-sm font-semibold text-foreground">
          {company.companyName}
        </p>
        <OutboundCompanyAdButton
          imageUrl={company.imageUrl}
          companyName={company.companyName}
          customerNote={company.customerNote}
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
  children,
}: {
  label: string;
  showServiceInfo?: boolean;
  companyName: string;
  serviceNote: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="inline-flex items-center rounded-full border border-primary/35 bg-primary/10 px-3.5 py-1.5 text-sm font-semibold tracking-tight text-primary">
        {label}
      </p>
      {showServiceInfo ?
        <ServiceOfferedDialog companyName={companyName} note={serviceNote} />
      : null}
      {children}
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
  const destinations = cardDestinations(company);
  const [openDestination, setOpenDestination] = useState<string | null>(null);
  const openTables = openDestination
    ? tablesForDestination(company.rateTables, openDestination)
    : [];
  const destinationButtons = destinations.map((destination) => (
    <DestinationButton
      key={destination}
      destination={destination}
      onClick={() => setOpenDestination(destination)}
    />
  ));
  const hideInlineRates = destinations.length > 0;

  return (
    <div className="pricing-overview-vendor-card space-y-3 overflow-visible rounded-lg px-3 py-3">
      {serviceOnly ? (
        <ServiceBadge
          label={company.serviceLabel}
          showServiceInfo={showServiceInfo}
          companyName={company.companyName}
          serviceNote={serviceNote}
        >
          {destinationButtons}
        </ServiceBadge>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-heading text-sm font-semibold text-foreground">
              {company.companyName}
            </p>
            <OutboundCompanyAdButton
              imageUrl={company.imageUrl}
              companyName={company.companyName}
              customerNote={company.customerNote}
            />
          </div>
          <StatusBadge kind="quoted">{company.serviceLabel}</StatusBadge>
          {hideInlineRates ? (
            <div className="flex flex-wrap items-center gap-2">
              {destinationButtons}
            </div>
          ) : (
            <div className="space-y-0.5 text-xs leading-relaxed text-muted-foreground">
              {company.country ? <p>{company.country}</p> : null}
              {company.location ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge kind="quoted">Operate from</StatusBadge>
                  <p
                    className="font-semibold text-primary"
                    title="Where this company operates from"
                  >
                    {company.location}
                  </p>
                </div>
              ) : null}
              {company.address ? (
                <p className="whitespace-pre-wrap">{company.address}</p>
              ) : null}
              {company.phone ? <p>Tel {company.phone}</p> : null}
            </div>
          )}
        </div>
      )}
      {hideInlineRates ? null : (
        company.rateTables.length > 0 ? (
          company.rateTables.map((table) => (
            <RateTable
              key={table.tableKind}
              {...table}
              pickupRates={company.pickupRates}
            />
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            Rate table is not published for this company yet.
          </p>
        )
      )}
      <Dialog
        open={openDestination != null}
        onOpenChange={(open) => {
          if (!open) setOpenDestination(null);
        }}
      >
        <DialogContent className="max-h-[min(90vh,42rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {openDestination ?? "Destination charges"}
            </DialogTitle>
            <DialogDescription>
              {serviceOnly
                ? `These prices are for ${openDestination ?? "this destination"} only.`
                : `These charges are for ${openDestination ?? "this destination"} only.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {serviceOnly ? null : <CompanyIdentity company={company} />}
            {openTables.length > 0 ?
              openTables.map((table) => (
                <RateTable
                  key={table.tableKind}
                  {...table}
                  pickupRates={company.pickupRates}
                />
              ))
            : (
              <p className="text-xs text-muted-foreground">
                Rate table is not published for this destination yet.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
