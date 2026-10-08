"use client";

import {
  Building2,
  Info,
  MapPin,
  Package,
  Ship,
  Truck,
  Warehouse,
} from "lucide-react";
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
  return company.country?.trim() || company.location?.trim() || null;
}

function cardDestinations(
  company: PublicOutboundCompanyPricingCard,
): string[] {
  const offeringCountry = company.country?.trim();
  if (offeringCountry) return [offeringCountry];
  const fromRates = uniqueRateDestinations(company.rateTables);
  if (fromRates.length > 0) return fromRates;
  const partner = partnerDestination(company);
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
  size = "sm",
}: {
  containerLabel: string;
  pickupRate: PublicPickupRate | null;
  size?: "sm" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const large = size === "lg";
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={
          large
            ? "h-10 shrink-0 gap-2 rounded-full border-primary/40 bg-primary/10 px-4 text-sm font-semibold tracking-wide text-primary hover:bg-primary/20"
            : "h-7 shrink-0 gap-1 rounded-full border-primary/40 bg-primary/10 px-2.5 text-[11px] font-semibold tracking-wide text-primary hover:bg-primary/20"
        }
        aria-label={`Pickup charge for ${containerLabel}`}
        onClick={() => setOpen(true)}
      >
        <Truck className={large ? "size-4" : "size-3.5"} aria-hidden />
        Pickup
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="pickup-charge-dialog max-h-[min(92vh,44rem)] gap-0 overflow-y-auto p-0 text-base sm:max-w-xl">
          <div className="pickup-charge-hero px-6 pb-5 pt-6">
            <DialogHeader className="relative z-10 gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                <span
                  className="pickup-charge-icon inline-flex size-12 items-center justify-center rounded-xl"
                  aria-hidden
                >
                  <Truck className="size-6" />
                </span>
                <p className="rounded-full border border-primary/35 bg-background/70 px-3 py-1 text-xs font-semibold tracking-wide text-primary">
                  {containerLabel}
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="pickup-charge-kicker text-[11px] font-semibold uppercase tracking-[0.18em]">
                  Hub to freight office
                </p>
                <DialogTitle className="font-heading text-xl font-semibold tracking-tight">
                  Pickup charge
                </DialogTitle>
                <DialogDescription className="max-w-lg text-sm leading-relaxed">
                  Formal rate to move a {containerLabel.toLowerCase()} from the
                  Amani hub warehouse to this company&apos;s freight office.
                  This is not the ocean freight charge.
                </DialogDescription>
              </div>
            </DialogHeader>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div className="space-y-2">
              <div className="pickup-charge-route" aria-hidden>
                <span className="pickup-charge-route-node">
                  <Warehouse className="size-4" />
                </span>
                <span className="pickup-charge-route-line">
                  <span className="pickup-charge-route-packet" />
                </span>
                <span className="pickup-charge-route-node">
                  <Truck className="size-4" />
                </span>
                <span className="pickup-charge-route-line">
                  <span className="pickup-charge-route-packet" />
                </span>
                <span className="pickup-charge-route-node">
                  <Building2 className="size-4" />
                </span>
              </div>
              <div className="grid grid-cols-3 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <span>Hub warehouse</span>
                <span>Pickup</span>
                <span>Freight office</span>
              </div>
            </div>
            {pickupRate ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <article className="pickup-charge-fee-card space-y-2 px-4 py-4">
                    <p className="pickup-charge-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
                      1 container
                    </p>
                    <p className="pricing-overview-fee font-heading text-3xl font-semibold tabular-nums tracking-tight">
                      {formatUsd(pickupRate.costOneCents)}
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      1-container pickup fee for the first unpaid{" "}
                      {containerLabel.toLowerCase()} on the freight quote.
                    </p>
                  </article>
                  <article className="pickup-charge-fee-card space-y-2 px-4 py-4">
                    <p className="pickup-charge-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
                      Each extra
                    </p>
                    <p className="pricing-overview-fee font-heading text-3xl font-semibold tabular-nums tracking-tight">
                      {formatUsd(pickupRate.costTwoPlusCents)}
                    </p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Extra-container fee. Two or more linked unpaid containers
                      use this amount for every container.
                    </p>
                  </article>
                </div>
                <p className="rounded-lg border border-border/80 bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                  One billed container uses the 1-container pickup fee. Two or
                  more containers on the same freight quote use the
                  extra-container fee for every container.
                </p>
              </>
            ) : (
              <p className="rounded-lg border border-border/80 bg-muted/40 px-4 py-4 text-sm leading-relaxed text-muted-foreground">
                No pickup fee is published for {containerLabel}.
              </p>
            )}
          </div>
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
      className="h-10 gap-1.5 rounded-full border-primary/35 bg-primary/10 px-4 text-base font-semibold tracking-tight text-primary hover:bg-primary/15"
      aria-label={`Show charges for ${destination}`}
      onClick={onClick}
    >
      <MapPin className="size-4" aria-hidden />
      {destination}
    </Button>
  );
}

function DestinationRateCards({
  tables,
  pickupRates,
  destination,
}: {
  tables: PublicRateTable[];
  pickupRates: readonly PublicPickupRate[];
  destination: string;
}) {
  const rows = tables.flatMap((table) =>
    table.rows.map((row) => ({ ...row, tableKind: table.tableKind })),
  );
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-border/80 bg-muted/40 px-5 py-6 text-sm leading-relaxed text-muted-foreground">
        Rate table is not published for {destination} yet.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {rows.map((row, rowIndex) => {
        const showPickup = row.tableKind === "container";
        return (
          <article
            key={`${row.tableKind}:${row.rowLabel}:${row.destination ?? ""}`}
            className="destination-rate-card space-y-4 px-5 py-5"
            style={
              {
                "--destination-card-index": rowIndex,
              } as CSSProperties
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="pickup-charge-icon inline-flex size-11 shrink-0 items-center justify-center rounded-xl"
                  aria-hidden
                >
                  <Package className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="pickup-charge-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
                    {row.tableKind === "zone" ? "Local courier zone" : "Container"}
                  </p>
                  <h3 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                    {row.rowLabel}
                  </h3>
                </div>
              </div>
              {showPickup ?
                <PickupChargeButton
                  containerLabel={row.rowLabel}
                  pickupRate={pickupRateForContainer(pickupRates, row.rowLabel)}
                  size="lg"
                />
              : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="pickup-charge-fee-card space-y-2 px-4 py-4">
                <p className="pickup-charge-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
                  1 container
                </p>
                <p className="pricing-overview-fee font-heading text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
                  {formatUsd(row.costOneCents)}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  First unpaid {row.rowLabel.toLowerCase()} on this destination.
                </p>
              </div>
              <div className="pickup-charge-fee-card space-y-2 px-4 py-4">
                <p className="pickup-charge-kicker text-[10px] font-semibold uppercase tracking-[0.16em]">
                  Each extra
                </p>
                <p className="pricing-overview-fee font-heading text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
                  {formatUsd(row.costTwoPlusCents)}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Added for every extra linked unpaid container.
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
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
      <p className="inline-flex items-center rounded-full border border-primary/35 bg-primary/10 px-4 py-2 text-base font-semibold tracking-tight text-primary">
        {label}
      </p>
      {showServiceInfo ?
        <ServiceOfferedDialog companyName={companyName} note={serviceNote} />
      : null}
      {children}
    </div>
  );
}

function overseasServiceHeading(
  company: PublicOutboundCompanyPricingCard,
): string {
  const courier = company.kinds.includes("courier");
  const broker = company.kinds.includes("broker");
  if (courier && !broker) return "Local courier";
  if (broker && !courier) return "Broker";
  return company.serviceLabel;
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
  const offeringCountry = company.country?.trim() ?? "";
  const openTables = openDestination
    ? offeringCountry &&
        openDestination.trim().toLowerCase() === offeringCountry.toLowerCase()
      ? company.rateTables.filter((table) => table.rows.length > 0)
      : tablesForDestination(company.rateTables, openDestination)
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
          <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {overseasServiceHeading(company)}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">
              {company.companyName}
            </p>
            <OutboundCompanyAdButton
              imageUrl={company.imageUrl}
              companyName={company.companyName}
              customerNote={company.customerNote}
            />
          </div>
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
        <DialogContent className="destination-charge-dialog pickup-charge-dialog max-h-[min(94vh,56rem)] gap-0 overflow-y-auto p-0 text-base sm:max-w-2xl">
          <div className="pickup-charge-hero px-6 pb-6 pt-7 sm:px-8">
            <DialogHeader className="relative z-10 gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                <span
                  className="pickup-charge-icon inline-flex size-14 items-center justify-center rounded-2xl"
                  aria-hidden
                >
                  <MapPin className="size-7" />
                </span>
                <p className="rounded-full border border-primary/35 bg-background/70 px-3.5 py-1.5 text-sm font-semibold tracking-wide text-primary">
                  {company.serviceLabel}
                </p>
              </div>
              <div className="space-y-2">
                <p className="pickup-charge-kicker text-[11px] font-semibold uppercase tracking-[0.2em]">
                  {serviceOnly ? "Destination freight" : "Destination charges"}
                </p>
                <DialogTitle className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                  {openDestination ?? "Destination charges"}
                </DialogTitle>
                <DialogDescription className="max-w-xl text-base leading-relaxed">
                  Formal published rates for{" "}
                  {openDestination ?? "this destination"} only. The first unpaid
                  container uses the 1-container cost; each extra linked unpaid
                  container adds the extra-container cost.
                </DialogDescription>
              </div>
            </DialogHeader>
            <div className="relative z-10 mt-6 space-y-2">
              <div className="pickup-charge-route pickup-charge-route-short" aria-hidden>
                <span className="pickup-charge-route-node">
                  {serviceOnly ? <Ship className="size-4" /> : <Truck className="size-4" />}
                </span>
                <span className="pickup-charge-route-line">
                  <span className="pickup-charge-route-packet" />
                </span>
                <span className="pickup-charge-route-node">
                  <MapPin className="size-4" />
                </span>
              </div>
              <div className="grid grid-cols-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px]">
                <span>{serviceOnly ? "Ocean freight" : "Local delivery"}</span>
                <span>{openDestination ?? "Destination"}</span>
              </div>
            </div>
          </div>
          <div className="space-y-6 px-6 py-6 sm:px-8">
            {serviceOnly ? null : <CompanyIdentity company={company} />}
            <DestinationRateCards
              tables={openTables}
              pickupRates={company.pickupRates}
              destination={openDestination ?? "this destination"}
            />
            {openTables.some((table) => table.tableKind === "container") ?
              <p className="rounded-xl border border-border/80 bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                These freight charges do not include the pickup fee. Open Pickup
                next to a container type for that type&apos;s hub-to-office fee.
              </p>
            : null}
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
      <div className="divide-y divide-border">
        {companies.map((company) => (
          <div key={company.companyKey} className="py-3 first:pt-0 last:pb-0">
            <CompanyCard
              company={company}
              identity={identity}
              showServiceInfo={showServiceInfo}
            />
          </div>
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
