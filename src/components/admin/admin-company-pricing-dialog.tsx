"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  addOutboundShippingCompanyRateAction,
  deleteOutboundShippingCompanyRateAction,
  updateOutboundShippingCompanyRateAction,
} from "@/actions/admin-outbound-shipping-company-rates";
import { setBarrelOutboundCompanyRateKindsAction } from "@/actions/admin-barrel-outbound-shipping-charge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsd } from "@/lib/admin-markup";
import { appTableHead, appTableRowHover, appTableScroll } from "@/lib/app-table-surfaces";
import {
  destinationCourierZoneHints,
  isAdminShippingCatalogPreviewBarrelId,
  matchCourierZoneRateRow,
  outboundShippingCompanyKey,
  outboundShippingCountryKey,
  quotedHubTransportFeeCents,
  unpaidLinkedContainerCount,
  type AdminCompanyRateLinkGroup,
  type AdminRateLinkableContainer,
  type BarrelOutboundShippingChargeKind,
  type OutboundShippingCompanyRateRow,
  type OutboundShippingCompanyRateTableKind,
} from "@/lib/barrel-outbound-shipping-charge";
import { JAMAICA_PARISHES } from "@/lib/parishes";
import type { ContainerOfferingKind } from "@/lib/validations/container-offering";
import { cn } from "@/lib/utils";

const CONTAINER_TYPE_OPTIONS = ["Barrel", "Bin", "Suitcase"] as const;

function centsToUsdInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function tableTitle(kind: OutboundShippingCompanyRateTableKind): string {
  if (kind === "zone") return "Local courier zones";
  if (kind === "transport") return "Hub to freight office";
  return "Freight and broker containers";
}

function rowLabelHeading(kind: OutboundShippingCompanyRateTableKind): string {
  return kind === "zone" ? "Zone / Location" : "Container type";
}

function costOneHeading(kind: OutboundShippingCompanyRateTableKind): string {
  return kind === "transport"
    ? "1-container pickup fee"
    : "Cost for 1 container";
}

function costExtraHeading(kind: OutboundShippingCompanyRateTableKind): string {
  return kind === "transport"
    ? "Extra-container fee (2+)"
    : "Cost for each extra container";
}

function tableHelp(kind: OutboundShippingCompanyRateTableKind): string {
  if (kind === "zone") {
    return "Name each zone after the destination parish (for example St. Catherine). The matching zone is billed automatically from the customer's shipping address. The first unpaid container uses the 1-container cost. Each extra linked unpaid container adds the extra-container cost (for example $10,000 + $5,000 + $5,000 = $20,000 for three).";
  }
  if (kind === "transport") {
    return "Pickup fee to move a container from the hub to this company's freight office. One billed container uses the 1-container pickup fee. Two or more barrels on the same freight quote use the extra-container fee for every container (2 linked barrels = 2 × extra-container fee).";
  }
  return "Name the destination this rate applies to (for example Jamaica or Kingston Container Terminal). The first unpaid container uses the 1-container cost. Each extra linked unpaid container adds the extra-container cost (for example $10,000 + $5,000 + $5,000 = $20,000 for three).";
}

function RateTableEditor({
  companyName,
  tableKind,
  rows,
  destinationParish,
  destinationCityOrTown,
}: {
  companyName: string;
  tableKind: OutboundShippingCompanyRateTableKind;
  rows: OutboundShippingCompanyRateRow[];
  destinationParish?: string | null;
  destinationCityOrTown?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        rowLabel: string;
        destination: string;
        costOneUsd: string;
        costTwoPlusUsd: string;
      }
    >
  >(() =>
    Object.fromEntries(
      rows.map((row) => [
        row.id,
        {
          rowLabel: row.rowLabel,
          destination: row.destination ?? "",
          costOneUsd: centsToUsdInput(row.costOneCents),
          costTwoPlusUsd: centsToUsdInput(row.costTwoPlusCents),
        },
      ]),
    ),
  );
  const [newLabel, setNewLabel] = useState("");
  const [newDestination, setNewDestination] = useState("");
  const [newOne, setNewOne] = useState("");
  const [newTwoPlus, setNewTwoPlus] = useState("");
  const listId = `${tableKind}-rate-suggestions`;
  const busy = pending;
  const showDestination = tableKind === "container";
  const columnCount = showDestination ? 5 : 4;
  const matchedZoneLabel =
    tableKind === "zone"
      ? matchCourierZoneRateRow(
          rows,
          destinationCourierZoneHints({
            parish: destinationParish,
            cityOrTown: destinationCityOrTown,
          }),
        )?.rowLabel ?? null
      : null;

  function saveExisting(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    startTransition(async () => {
      const res = await updateOutboundShippingCompanyRateAction({
        id,
        tableKind,
        rowLabel: draft.rowLabel,
        destination: draft.destination,
        costOneUsd: draft.costOneUsd,
        costTwoPlusUsd: draft.costTwoPlusUsd,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function removeRow(id: string) {
    startTransition(async () => {
      const res = await deleteOutboundShippingCompanyRateAction({ id });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function addRow() {
    startTransition(async () => {
      const res = await addOutboundShippingCompanyRateAction({
        companyName,
        tableKind,
        rowLabel: newLabel,
        destination: newDestination,
        costOneUsd: newOne,
        costTwoPlusUsd: newTwoPlus,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setNewLabel("");
      setNewDestination("");
      setNewOne("");
      setNewTwoPlus("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-foreground">{tableTitle(tableKind)}</h4>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {tableHelp(tableKind)}
      </p>
      <div className={cn(appTableScroll, "overflow-x-auto")}>
        <table className={cn("w-full text-left text-sm", showDestination ? "min-w-[50rem]" : "min-w-[40rem]")}>
          <thead>
            <tr className={appTableHead}>
              <th className="px-3 py-2 font-medium">{rowLabelHeading(tableKind)}</th>
              {showDestination ?
                <th className="px-3 py-2 font-medium">Destination</th>
              : null}
              <th className="px-3 py-2 font-medium">{costOneHeading(tableKind)}</th>
              <th className="px-3 py-2 font-medium">{costExtraHeading(tableKind)}</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ?
              <tr>
                <td
                  colSpan={columnCount}
                  className="px-3 py-3 text-xs text-muted-foreground"
                >
                  No pricing rows yet. Add a record below.
                </td>
              </tr>
            : rows.map((row) => {
                const draft = drafts[row.id] ?? {
                  rowLabel: row.rowLabel,
                  destination: row.destination ?? "",
                  costOneUsd: centsToUsdInput(row.costOneCents),
                  costTwoPlusUsd: centsToUsdInput(row.costTwoPlusCents),
                };
                return (
                  <tr key={row.id} className={appTableRowHover}>
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        <Input
                          list={listId}
                          value={draft.rowLabel}
                          disabled={busy}
                          onChange={(e) =>
                            setDrafts((current) => ({
                              ...current,
                              [row.id]: { ...draft, rowLabel: e.target.value },
                            }))
                          }
                        />
                        {matchedZoneLabel === row.rowLabel ?
                          <p className="text-[11px] text-primary">
                            Matches destination parish
                            {destinationParish ? ` ${destinationParish}` : ""}.
                          </p>
                        : null}
                      </div>
                    </td>
                    {showDestination ?
                      <td className="px-3 py-2">
                        <Input
                          value={draft.destination}
                          disabled={busy}
                          placeholder="e.g. Jamaica"
                          onChange={(e) =>
                            setDrafts((current) => ({
                              ...current,
                              [row.id]: {
                                ...draft,
                                destination: e.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                    : null}
                    <td className="px-3 py-2">
                      <Input
                        inputMode="decimal"
                        value={draft.costOneUsd}
                        disabled={busy}
                        onChange={(e) =>
                          setDrafts((current) => ({
                            ...current,
                            [row.id]: { ...draft, costOneUsd: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        inputMode="decimal"
                        value={draft.costTwoPlusUsd}
                        disabled={busy}
                        onChange={(e) =>
                          setDrafts((current) => ({
                            ...current,
                            [row.id]: {
                              ...draft,
                              costTwoPlusUsd: e.target.value,
                            },
                          }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => saveExisting(row.id)}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => removeRow(row.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            <tr className={appTableRowHover}>
              <td className="px-3 py-2">
                <Input
                  list={listId}
                  value={newLabel}
                  disabled={busy}
                  placeholder={
                    tableKind === "zone"
                      ? "e.g. St. Catherine"
                      : "e.g. Barrel"
                  }
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </td>
              {showDestination ?
                <td className="px-3 py-2">
                  <Input
                    value={newDestination}
                    disabled={busy}
                    placeholder="e.g. Jamaica"
                    onChange={(e) => setNewDestination(e.target.value)}
                  />
                </td>
              : null}
              <td className="px-3 py-2">
                <Input
                  inputMode="decimal"
                  value={newOne}
                  disabled={busy}
                  placeholder="0.00"
                  onChange={(e) => setNewOne(e.target.value)}
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  inputMode="decimal"
                  value={newTwoPlus}
                  disabled={busy}
                  placeholder="0.00"
                  onChange={(e) => setNewTwoPlus(e.target.value)}
                />
              </td>
              <td className="px-3 py-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-primary text-primary-foreground"
                  disabled={pending}
                  onClick={addRow}
                >
                  {pending ? "Adding…" : "Add record"}
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <datalist id={listId}>
        {tableKind === "zone"
          ? JAMAICA_PARISHES.map((parish) => (
              <option key={parish} value={parish} />
            ))
          : CONTAINER_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
      </datalist>
      {rows.length > 0 ?
        <p className="text-[11px] text-muted-foreground">
          Published costs:{" "}
          {rows
            .map((row) => {
              const dest = row.destination?.trim();
              return dest
                ? `${row.rowLabel} → ${dest} ${formatUsd(row.costOneCents)} / ${formatUsd(row.costTwoPlusCents)}`
                : `${row.rowLabel} ${formatUsd(row.costOneCents)} / ${formatUsd(row.costTwoPlusCents)}`;
            })
            .join(" · ")}
        </p>
      : null}
    </div>
  );
}

export function ChargeLabelWithCompanyPricing({
  htmlFor,
  label,
  companyName,
  tableKinds,
  rates,
  barrelId,
  kindsToToggle,
  enabledKinds,
  linkableContainers = [],
  companyRateLinks = [],
  containerKind = "barrel",
  destinationParish = null,
  destinationCityOrTown = null,
  destinationCountry = null,
  showRateCardToggle = true,
  dialogVariant = "company",
}: {
  htmlFor: string;
  label: string;
  companyName: string | null;
  tableKinds: OutboundShippingCompanyRateTableKind[];
  rates: OutboundShippingCompanyRateRow[];
  barrelId: string;
  kindsToToggle: BarrelOutboundShippingChargeKind[];
  enabledKinds: BarrelOutboundShippingChargeKind[];
  linkableContainers?: AdminRateLinkableContainer[];
  companyRateLinks?: AdminCompanyRateLinkGroup[];
  containerKind?: ContainerOfferingKind;
  destinationParish?: string | null;
  destinationCityOrTown?: string | null;
  destinationCountry?: string | null;
  /** When false, only the Charge button (no rate-card checkbox). */
  showRateCardToggle?: boolean;
  dialogVariant?: "company" | "hub-transport";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const checked = kindsToToggle.every((kind) => enabledKinds.includes(kind));
  const [open, setOpen] = useState(false);
  const catalogPreview = isAdminShippingCatalogPreviewBarrelId(barrelId);
  const companyKey = companyName ? outboundShippingCompanyKey(companyName) : "";
  const destKey = outboundShippingCountryKey(destinationCountry);
  const companyRates = useMemo(
    () =>
      (rates ?? []).filter((row) => {
        if (row.companyKey !== companyKey) return false;
        if (!destKey || row.tableKind === "transport") return true;
        const rowDest = outboundShippingCountryKey(row.destination);
        return !rowDest || rowDest === destKey;
      }),
    [companyKey, destKey, rates],
  );
  const hubTransportCount = unpaidLinkedContainerCount({
    barrelId,
    companyName,
    chargeKind: "freight",
    companyRateLinks,
    linkableContainers,
  });
  const hubTransportQuotedCents = quotedHubTransportFeeCents({
    rates: companyRates,
    companyName,
    containerKind,
    containerCount: hubTransportCount,
  });

  function toggleRateCard(nextChecked: boolean) {
    if (nextChecked && !companyName) {
      toast.error("Add a company first.");
      return;
    }
    const nextKinds = nextChecked
      ? BARREL_KINDS_ORDER.filter(
          (kind) => enabledKinds.includes(kind) || kindsToToggle.includes(kind),
        )
      : enabledKinds.filter((kind) => !kindsToToggle.includes(kind));
    startTransition(async () => {
      const res = await setBarrelOutboundCompanyRateKindsAction({
        barrelId,
        kinds: nextKinds,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {catalogPreview || !showRateCardToggle ? null : (
          <input
            type="checkbox"
            className="size-3.5 accent-primary"
            checked={checked}
            disabled={pending}
            aria-label="Bill customer from company rate card"
            onChange={(e) => toggleRateCard(e.target.checked)}
          />
        )}
        <Button
          type="button"
          size="sm"
          className="h-7 px-2.5 text-xs"
          disabled={pending}
          onClick={() => {
            if (!companyName) {
              toast.error("Add a company first.");
              return;
            }
            setOpen(true);
          }}
        >
          Charge
        </Button>
      </div>
      {showRateCardToggle && catalogPreview && companyName ?
        <p className="text-[11px] leading-snug text-muted-foreground">
          Set this company&apos;s rates now. They apply to every customer
          container that uses this company.
        </p>
      : showRateCardToggle && checked ?
        <p className="text-[11px] leading-snug text-muted-foreground">
          Form amounts below are not billed. The customer pays this company&apos;s
          rate card.
        </p>
      : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(94vh,58rem)] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {dialogVariant === "hub-transport"
                ? companyName
                  ? `${companyName} pickup pricing`
                  : "Pickup pricing"
                : companyName
                  ? `${companyName}${destinationCountry ? ` · ${destinationCountry}` : ""} pricing`
                  : "Company pricing"}
            </DialogTitle>
            <DialogDescription>
              {dialogVariant === "hub-transport" ?
                "These rates are the pickup fee to move a container from the hub to this company's freight office. They are not the ocean freight charge. One billed container uses the 1-container pickup fee. Two or more barrels on the same freight quote use the extra-container fee for every container (2 linked barrels = 2 × extra-container fee)."
              : "These rates belong to this company and are what the customer is charged when the rate card is on. Freight and broker container rows need a destination; that name is the destination button on How it works. Local courier zones are matched to the destination parish on the shipping address. The first unpaid container uses the 1-container rate; each extra linked unpaid container adds the extra-container rate. Customers link unpaid containers on Dashboard → Shipping."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {dialogVariant === "hub-transport" && hubTransportQuotedCents != null ?
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
                This freight quote is billing {hubTransportCount}{" "}
                {hubTransportCount === 1 ? "container" : "containers"}
                {hubTransportCount >= 2
                  ? ` × extra-container fee = ${formatUsd(hubTransportQuotedCents)}`
                  : ` at the 1-container pickup fee = ${formatUsd(hubTransportQuotedCents)}`}
                .
              </p>
            : null}
            {tableKinds.map((tableKind) => (
              <RateTableEditor
                key={tableKind}
                companyName={companyName ?? ""}
                tableKind={tableKind}
                rows={companyRates.filter((row) => row.tableKind === tableKind)}
                destinationParish={destinationParish}
                destinationCityOrTown={destinationCityOrTown}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const BARREL_KINDS_ORDER: BarrelOutboundShippingChargeKind[] = [
  "freight",
  "broker",
  "courier",
];
