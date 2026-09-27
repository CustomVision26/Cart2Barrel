"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  addOutboundShippingCompanyRateAction,
  deleteOutboundShippingCompanyRateAction,
  setOutboundShippingCompanyRateLinksAction,
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
  matchCourierZoneRateRow,
  outboundShippingCompanyKey,
  resolveCompanyRateLinesForKinds,
  sumChargeLineCents,
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
  return kind === "zone" ? "Local courier zones" : "Freight and broker containers";
}

function rowLabelHeading(kind: OutboundShippingCompanyRateTableKind): string {
  return kind === "zone" ? "Zone / Location" : "Container type";
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
    Record<string, { rowLabel: string; costOneUsd: string; costTwoPlusUsd: string }>
  >(() =>
    Object.fromEntries(
      rows.map((row) => [
        row.id,
        {
          rowLabel: row.rowLabel,
          costOneUsd: centsToUsdInput(row.costOneCents),
          costTwoPlusUsd: centsToUsdInput(row.costTwoPlusCents),
        },
      ]),
    ),
  );
  const [newLabel, setNewLabel] = useState("");
  const [newOne, setNewOne] = useState("");
  const [newTwoPlus, setNewTwoPlus] = useState("");
  const listId = `${tableKind}-rate-suggestions`;
  const busy = pending;
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
        rowLabel: draft.rowLabel,
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
        costOneUsd: newOne,
        costTwoPlusUsd: newTwoPlus,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setNewLabel("");
      setNewOne("");
      setNewTwoPlus("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-foreground">{tableTitle(tableKind)}</h4>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {tableKind === "zone" ?
          "Name each zone after the destination parish (for example St. Catherine). The matching zone is billed automatically from the customer's shipping address. "
        : null}
        The first unpaid container uses the 1-container cost. Each extra linked
        unpaid container adds the extra-container cost (for example $10,000 +
        $5,000 + $5,000 = $20,000 for three).
      </p>
      <div className={cn(appTableScroll, "overflow-x-auto")}>
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className={appTableHead}>
              <th className="px-3 py-2 font-medium">{rowLabelHeading(tableKind)}</th>
              <th className="px-3 py-2 font-medium">Cost for 1 container</th>
              <th className="px-3 py-2 font-medium">Cost for each extra container</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ?
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-3 text-xs text-muted-foreground"
                >
                  No pricing rows yet. Add a record below.
                </td>
              </tr>
            : rows.map((row) => {
                const draft = drafts[row.id] ?? {
                  rowLabel: row.rowLabel,
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
        {tableKind === "container"
          ? CONTAINER_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option} />
            ))
          : JAMAICA_PARISHES.map((parish) => (
              <option key={parish} value={parish} />
            ))}
      </datalist>
      {rows.length > 0 ?
        <p className="text-[11px] text-muted-foreground">
          Published costs:{" "}
          {rows
            .map(
              (row) =>
                `${row.rowLabel} ${formatUsd(row.costOneCents)} / ${formatUsd(row.costTwoPlusCents)}`,
            )
            .join(" · ")}
        </p>
      : null}
    </div>
  );
}

function linkedBarrelIdsForCompanyKinds(
  companyKey: string,
  kinds: readonly BarrelOutboundShippingChargeKind[],
  groups: readonly AdminCompanyRateLinkGroup[],
): string[] {
  const ids = new Set<string>();
  for (const kind of kinds) {
    const group = groups.find(
      (item) => item.companyKey === companyKey && item.chargeKind === kind,
    );
    for (const id of group?.barrelIds ?? []) ids.add(id);
  }
  return [...ids];
}

function LinkedContainersPanel({
  companyName,
  companyKey,
  sourceBarrelId,
  kinds,
  containers,
  savedLinks,
  rates,
  tableKinds,
  containerKind,
  destinationParish,
  destinationCityOrTown,
}: {
  companyName: string;
  companyKey: string;
  sourceBarrelId: string;
  kinds: BarrelOutboundShippingChargeKind[];
  containers: AdminRateLinkableContainer[];
  savedLinks: AdminCompanyRateLinkGroup[];
  rates: OutboundShippingCompanyRateRow[];
  tableKinds: OutboundShippingCompanyRateTableKind[];
  containerKind: ContainerOfferingKind;
  destinationParish: string | null;
  destinationCityOrTown: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const savedIds = linkedBarrelIdsForCompanyKinds(
    companyKey,
    kinds,
    savedLinks,
  );
  const eligible = containers.filter((container) => {
    const sharesCompany = kinds.some(
      (kind) => container.partnerKeyByKind[kind] === companyKey,
    );
    return sharesCompany;
  });
  const sourceUnpaid = kinds.every(
    (kind) =>
      eligible.find((item) => item.barrelId === sourceBarrelId)?.unpaidByKind[
        kind
      ] !== false,
  );
  const [selected, setSelected] = useState<string[]>(() => {
    const next = savedIds.filter((id) =>
      eligible.some((item) => item.barrelId === id),
    );
    if (!next.includes(sourceBarrelId)) next.unshift(sourceBarrelId);
    return [...new Set(next)];
  });

  useEffect(() => {
    const next = savedIds.filter((id) =>
      eligible.some((item) => item.barrelId === id),
    );
    if (!next.includes(sourceBarrelId)) next.unshift(sourceBarrelId);
    setSelected([...new Set(next)]);
  }, [sourceBarrelId, savedIds.join("|")]);

  const zoneHints = destinationCourierZoneHints({
    parish: destinationParish,
    cityOrTown: destinationCityOrTown,
  });
  const linkedCount = selected.length;
  const previewLines = resolveCompanyRateLinesForKinds({
    rates,
    companyName,
    kinds,
    containerKind,
    destinationHints: zoneHints,
    containerCount: linkedCount,
  });
  const amountCents =
    previewLines.length > 0 ? sumChargeLineCents(previewLines) : null;
  const extras = Math.max(0, linkedCount - 1);
  const breakdown =
    linkedCount >= 2 && previewLines.length > 0
      ? previewLines
          .map((line) => {
            const row = rates.find((item) => item.rowLabel === line.label);
            if (!row) return `${line.label} ${formatUsd(line.amountCents)}`;
            return `${line.label}: 1 × ${formatUsd(row.costOneCents)} + ${extras} × ${formatUsd(row.costTwoPlusCents)}`;
          })
          .join(" · ")
      : null;
  const selectedLabels = selected
    .map(
      (id) =>
        eligible.find((item) => item.barrelId === id)?.alias ?? "Container",
    )
    .join(" + ");

  function toggle(barrelId: string, unpaid: boolean) {
    if (barrelId === sourceBarrelId || !unpaid || !sourceUnpaid) return;
    setSelected((current) =>
      current.includes(barrelId)
        ? current.filter((id) => id !== barrelId)
        : [...current, barrelId],
    );
  }

  function saveLinks() {
    startTransition(async () => {
      const res = await setOutboundShippingCompanyRateLinksAction({
        sourceBarrelId,
        companyName,
        kinds,
        linkedBarrelIds: selected,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  if (eligible.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-3">
      <h4 className="text-sm font-medium text-foreground">
        Link unpaid containers
      </h4>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Same freight, broker, courier, or consolidated company only. Paid
        containers cannot be merged. The first unpaid container uses the
        1-container rate; each extra linked unpaid container adds the extra
        rate. One payment marks every linked container paid.
      </p>
      <ul className="space-y-1.5">
        {eligible.map((container) => {
          const unpaid = kinds.every(
            (kind) => container.unpaidByKind[kind] !== false,
          );
          const isSource = container.barrelId === sourceBarrelId;
          const checked = selected.includes(container.barrelId);
          const disabled = isSource || !unpaid || !sourceUnpaid || pending;
          return (
            <li key={container.barrelId}>
              <label
                className={cn(
                  "flex items-start gap-2 rounded-md px-1.5 py-1 text-sm",
                  !unpaid && "opacity-70",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-3.5 accent-primary"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(container.barrelId, unpaid)}
                />
                <span>
                  <span className="font-medium text-foreground">
                    {container.alias}
                  </span>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {container.slotLabel}
                    {isSource ? " · this container" : null}
                    {!unpaid ? " · paid" : null}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {amountCents != null ?
        <p className="text-sm font-medium tabular-nums text-foreground">
          {tableKinds.includes("zone") && destinationParish ?
            <span className="mr-1 font-normal text-muted-foreground">
              Zone matched from destination parish {destinationParish}.{" "}
            </span>
          : null}
          {linkedCount < 2 ?
            <>1 container: {formatUsd(amountCents)}</>
          : (
            <>
              {linkedCount} linked: {formatUsd(amountCents)}
              {breakdown ? ` (${breakdown})` : null} one payment covers{" "}
              {selectedLabels}
            </>
          )}
        </p>
      : tableKinds.includes("zone") && destinationParish ?
        <p className="text-xs text-muted-foreground">
          No zone matches destination parish {destinationParish}. Add a zone
          with that parish name.
        </p>
      : null}
      {!sourceUnpaid ?
        <p className="text-xs text-muted-foreground">
          This container is already paid, so it cannot be linked to others.
        </p>
      : (
        <Button type="button" size="sm" disabled={pending} onClick={saveLinks}>
          {pending ? "Saving…" : "Save container links"}
        </Button>
      )}
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
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const checked = kindsToToggle.every((kind) => enabledKinds.includes(kind));
  const [open, setOpen] = useState(false);
  const companyKey = companyName ? outboundShippingCompanyKey(companyName) : "";
  const companyRates = useMemo(
    () => (rates ?? []).filter((row) => row.companyKey === companyKey),
    [companyKey, rates],
  );

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
        <input
          type="checkbox"
          className="size-3.5 accent-primary"
          checked={checked}
          disabled={pending}
          aria-label="Bill customer from company rate card"
          onChange={(e) => toggleRateCard(e.target.checked)}
        />
        {checked ?
          <Button
            type="button"
            size="sm"
            className="h-7 px-2.5 text-xs"
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
        : null}
      </div>
      {checked ?
        <p className="text-[11px] leading-snug text-muted-foreground">
          Form amounts below are not billed. The customer pays this company&apos;s
          rate card.
        </p>
      : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(94vh,58rem)] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {companyName ? `${companyName} pricing` : "Company pricing"}
            </DialogTitle>
            <DialogDescription>
              These rates belong to this company and are what the customer is
              charged when the rate card is on. Local courier zones are matched
              to the destination parish on the shipping address. Link unpaid
              containers that share this freight, broker, courier, or
              consolidated company: the first uses the 1-container rate and each
              extra adds the extra-container rate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {companyName && companyKey ?
              <LinkedContainersPanel
                companyName={companyName}
                companyKey={companyKey}
                sourceBarrelId={barrelId}
                kinds={kindsToToggle}
                containers={linkableContainers}
                savedLinks={companyRateLinks}
                rates={companyRates}
                tableKinds={tableKinds}
                containerKind={containerKind}
                destinationParish={destinationParish}
                destinationCityOrTown={destinationCityOrTown}
              />
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
