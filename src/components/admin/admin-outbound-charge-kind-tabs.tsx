"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { saveBarrelOutboundShippingChargeAction } from "@/actions/admin-barrel-outbound-shipping-charge";
import {
  addBarrelOutboundShippingPartnerAction,
  applyCatalogOutboundShippingPartnerAction,
  deleteBarrelOutboundShippingPartnerAction,
  setBarrelOutboundShippingPartnerPrimaryAction,
  updateBarrelOutboundShippingPartnerAction,
} from "@/actions/admin-barrel-outbound-shipping-partner";
import { AdminOutboundOffPlatformPaymentReview } from "@/components/admin/admin-outbound-off-platform-payment-review";
import { Button } from "@/components/ui/button";
import {
  Input,
  inputFieldClassName,
  nativeSelectFieldClassName,
} from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatUsd } from "@/lib/admin-markup";
import { appTableHead, appTableRowHover, appTableScroll } from "@/lib/app-table-surfaces";
import { SHIPPING_COUNTRIES } from "@/lib/shipping-countries";
import type { AdminBarrelOutboundShippingChargeRow } from "@/lib/barrel-outbound-shipping-charge";
import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_DEFAULT_LABELS,
  BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS,
  BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS,
  FREIGHT_SHIPPER_CHARGE_LABEL,
  FREIGHT_TRANSPORTATION_FEE_LABEL,
  chargeViewForKind,
  isOffPlatformOutboundChargeKind,
  isOffPlatformPaymentPendingReview,
  splitFreightChargeLines,
  type BarrelOutboundShippingChargeKind,
} from "@/lib/barrel-outbound-shipping-charge";
import { parseUsdInputToCents } from "@/lib/validations/barrel-outbound-shipping-charge";
import { cn } from "@/lib/utils";

function centsToUsdInput(cents: number): string {
  return cents > 0 ? (cents / 100).toFixed(2) : "";
}

function PartnerRecordsEditor({
  row,
  chargeKind,
  formDisabled,
}: {
  row: AdminBarrelOutboundShippingChargeRow;
  chargeKind: BarrelOutboundShippingChargeKind;
  formDisabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const records = row.partners.filter((p) => p.chargeKind === chargeKind);
  const localCount = records.filter((p) => p.barrelId === row.barrelId).length;
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [cashappId, setCashappId] = useState("");
  const [cashappAccount, setCashappAccount] = useState("");
  const [zelleId, setZelleId] = useState("");
  const [zelleAccount, setZelleAccount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [makePrimary, setMakePrimary] = useState(localCount === 0);
  const busy = formDisabled || pending;
  const isFreight = chargeKind === "freight";
  const nameLabel =
    chargeKind === "freight"
      ? "Company name"
      : chargeKind === "broker"
        ? "Broker name"
        : "Courier name";
  const addressLabel =
    chargeKind === "freight"
      ? "Freight address"
      : chargeKind === "broker"
        ? "Broker address"
        : "Courier address";
  const addLabel =
    chargeKind === "freight"
      ? "Add company"
      : chargeKind === "broker"
        ? "Add broker"
        : "Add courier";
  const saveLabel =
    chargeKind === "freight"
      ? "Save company"
      : chargeKind === "broker"
        ? "Save broker"
        : "Save courier";

  function resetForm(nextCount: number) {
    setEditingId(null);
    setName("");
    setLocation("");
    setAddress("");
    setCountry("");
    setPhone("");
    setCashappId("");
    setCashappAccount("");
    setZelleId("");
    setZelleAccount("");
    setMakePrimary(nextCount === 0);
  }

  function startEdit(record: (typeof records)[number]) {
    setEditingId(record.id);
    setName(record.name);
    setLocation(record.location ?? "");
    setAddress(record.address ?? "");
    setCountry(record.country ?? "");
    setPhone(record.phone ?? "");
    setCashappId(record.cashappId ?? "");
    setCashappAccount(record.cashappAccount ?? "");
    setZelleId(record.zelleId ?? "");
    setZelleAccount(record.zelleAccount ?? "");
    setMakePrimary(record.isPrimary);
  }

  function saveRecord() {
    startTransition(async () => {
      const payload = {
        name,
        location: isFreight ? "" : location,
        address,
        country: isFreight ? "" : country,
        phone,
        cashappId,
        cashappAccount,
        zelleId,
        zelleAccount,
        isPrimary: makePrimary || localCount === 0,
      };
      const res =
        editingId
          ? await updateBarrelOutboundShippingPartnerAction({
              id: editingId,
              ...payload,
            })
          : await addBarrelOutboundShippingPartnerAction({
              barrelId: row.barrelId,
              chargeKind,
              ...payload,
            });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      resetForm(Math.max(records.length, 1));
      router.refresh();
    });
  }

  function setPrimary(record: (typeof records)[number]) {
    startTransition(async () => {
      const res =
        record.barrelId === row.barrelId
          ? await setBarrelOutboundShippingPartnerPrimaryAction({ id: record.id })
          : await applyCatalogOutboundShippingPartnerAction({
              sourcePartnerId: record.id,
              barrelId: row.barrelId,
            });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function removeRecord(id: string) {
    startTransition(async () => {
      const res = await deleteBarrelOutboundShippingPartnerAction({ id });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${row.barrelId}-${chargeKind}-name`}>{nameLabel}</Label>
          <Input
            id={`${row.barrelId}-${chargeKind}-name`}
            value={name}
            disabled={busy}
            placeholder={
              chargeKind === "freight"
                ? "e.g. Tropical Shipping"
                : chargeKind === "broker"
                  ? "e.g. Kingston port customs broker"
                  : "e.g. Knutsford Express Cargo"
            }
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {!isFreight ?
          <>
            <div className="space-y-1">
              <Label htmlFor={`${row.barrelId}-${chargeKind}-location`}>
                Location
              </Label>
              <Input
                id={`${row.barrelId}-${chargeKind}-location`}
                value={location}
                disabled={busy}
                placeholder="e.g. Kingston / Newport West"
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${row.barrelId}-${chargeKind}-country`}>
                Country
              </Label>
              <select
                id={`${row.barrelId}-${chargeKind}-country`}
                value={country}
                disabled={busy}
                className={nativeSelectFieldClassName}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="">Select country</option>
                {SHIPPING_COUNTRIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </>
        : null}
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${row.barrelId}-${chargeKind}-address`}>
            {addressLabel}
          </Label>
          <textarea
            id={`${row.barrelId}-${chargeKind}-address`}
            rows={3}
            disabled={busy}
            className={cn(inputFieldClassName, "min-h-16 py-2 text-sm")}
            placeholder="Street, city, and postal details"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${row.barrelId}-${chargeKind}-phone`}>
            Telephone number
          </Label>
          <Input
            id={`${row.barrelId}-${chargeKind}-phone`}
            type="tel"
            value={phone}
            disabled={busy}
            placeholder="e.g. 876-555-0100"
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${row.barrelId}-${chargeKind}-cashapp`}>
            Company Cash App ID
          </Label>
          <Input
            id={`${row.barrelId}-${chargeKind}-cashapp`}
            value={cashappId}
            disabled={busy}
            placeholder="$companyhandle"
            onChange={(e) => setCashappId(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${row.barrelId}-${chargeKind}-cashapp-account`}>
            Cash App account name
          </Label>
          <Input
            id={`${row.barrelId}-${chargeKind}-cashapp-account`}
            value={cashappAccount}
            disabled={busy}
            placeholder="Name on the Cash App account"
            onChange={(e) => setCashappAccount(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${row.barrelId}-${chargeKind}-zelle`}>
            Company Zelle ID
          </Label>
          <Input
            id={`${row.barrelId}-${chargeKind}-zelle`}
            value={zelleId}
            disabled={busy}
            placeholder="email or mobile number for Zelle"
            onChange={(e) => setZelleId(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${row.barrelId}-${chargeKind}-zelle-account`}>
            Zelle account name
          </Label>
          <Input
            id={`${row.barrelId}-${chargeKind}-zelle-account`}
            value={zelleAccount}
            disabled={busy}
            placeholder="Name on the Zelle account"
            onChange={(e) => setZelleAccount(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={records.length === 0 ? true : makePrimary}
            disabled={busy || localCount === 0}
            onChange={(e) => setMakePrimary(e.target.checked)}
          />
          Set as primary
        </label>
        <Button type="button" size="sm" disabled={busy} onClick={saveRecord}>
          {pending ? "Saving…" : editingId ? saveLabel : addLabel}
        </Button>
        {editingId ?
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => resetForm(records.length)}
          >
            Cancel
          </Button>
        : null}
      </div>

      {records.length === 0 ?
        <p className="text-xs text-muted-foreground">
          Added records appear in the table below. Select one as primary for this
          charge.
        </p>
      : (
        <div className="space-y-1.5">
          {localCount < records.length ?
            <p className="text-xs text-muted-foreground">
              Companies already saved on other containers are listed here. Select
              Primary to use one on this container.
            </p>
          : null}
          <div className={cn(appTableScroll, "overflow-x-auto")}>
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className={appTableHead}>
                <th className="px-3 py-2 font-medium">Primary</th>
                <th className="px-3 py-2 font-medium">
                  {isFreight ? "Company" : "Name"}
                </th>
                {!isFreight ?
                  <>
                    <th className="px-3 py-2 font-medium">Country</th>
                    <th className="px-3 py-2 font-medium">Location</th>
                  </>
                : null}
                <th className="px-3 py-2 font-medium">Address</th>
                <th className="px-3 py-2 font-medium">Telephone</th>
                <th className="px-3 py-2 font-medium">Cash App</th>
                <th className="px-3 py-2 font-medium">Cash App account</th>
                <th className="px-3 py-2 font-medium">Zelle</th>
                <th className="px-3 py-2 font-medium">Zelle account</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((record) => {
                const onThisBarrel = record.barrelId === row.barrelId;
                return (
                <tr
                  key={record.id}
                  className={cn(
                    appTableRowHover,
                    editingId === record.id && "bg-primary/10",
                  )}
                >
                  <td className="px-3 py-2">
                    <input
                      type="radio"
                      name={`${row.barrelId}-${chargeKind}-primary`}
                      className="size-4 accent-primary"
                      checked={onThisBarrel && record.isPrimary}
                      disabled={busy}
                      aria-label={`Set ${record.name} as primary`}
                      onChange={() => setPrimary(record)}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      {record.name}
                      {onThisBarrel && record.isPrimary ?
                        <StatusBadge kind="fullyReceived">Primary</StatusBadge>
                      : !onThisBarrel ?
                        <StatusBadge kind="draft">Saved</StatusBadge>
                      : null}
                    </span>
                  </td>
                  {!isFreight ?
                    <>
                      <td className="px-3 py-2 text-muted-foreground">
                        {record.country || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {record.location || "—"}
                      </td>
                    </>
                  : null}
                  <td className="max-w-[16rem] whitespace-pre-wrap px-3 py-2 text-muted-foreground">
                    {record.address || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {record.phone || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {record.cashappId || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {record.cashappAccount || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {record.zelleId || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {record.zelleAccount || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {onThisBarrel ?
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => startEdit(record)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => removeRecord(record.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    : (
                      <span className="text-xs text-muted-foreground">
                        Select Primary to use
                      </span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}

function AdminChargeKindForm({
  row,
  chargeKind,
  publishEnabled,
  lockMessage,
}: {
  row: AdminBarrelOutboundShippingChargeRow;
  chargeKind: BarrelOutboundShippingChargeKind;
  publishEnabled: boolean;
  lockMessage?: string;
}) {
  const router = useRouter();
  const existing = chargeViewForKind(row.charges, chargeKind);
  const freightLines = splitFreightChargeLines(existing?.lines);
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(
    chargeKind === "freight"
      ? (freightLines.shipper?.label ?? FREIGHT_SHIPPER_CHARGE_LABEL)
      : (existing?.lines[0]?.label ??
        BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_DEFAULT_LABELS[chargeKind]),
  );
  const [amountUsd, setAmountUsd] = useState(
    centsToUsdInput(
      chargeKind === "freight"
        ? (freightLines.shipper?.amountCents ?? 0)
        : (existing?.totalCents ?? 0),
    ),
  );
  const [transportAmountUsd, setTransportAmountUsd] = useState(
    centsToUsdInput(freightLines.transportation?.amountCents ?? 0),
  );
  const [adminNote, setAdminNote] = useState(existing?.adminNote ?? "");
  const isPaid = existing?.paidAt != null;
  const pendingReview = existing
    ? isOffPlatformPaymentPendingReview(existing)
    : false;
  const formDisabled = isPaid || pendingReview || pending || !publishEnabled;
  const kindLabel = BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[chargeKind];
  const freightTotalCents =
    parseUsdInputToCents(amountUsd) + parseUsdInputToCents(transportAmountUsd);

  function save() {
    startTransition(async () => {
      const lines =
        chargeKind === "freight"
          ? [
              {
                label: label.trim() || FREIGHT_SHIPPER_CHARGE_LABEL,
                amountUsd,
              },
              ...(parseUsdInputToCents(transportAmountUsd) > 0
                ? [
                    {
                      label: FREIGHT_TRANSPORTATION_FEE_LABEL,
                      amountUsd: transportAmountUsd,
                    },
                  ]
                : []),
            ]
          : [{ label, amountUsd }];
      const res = await saveBarrelOutboundShippingChargeAction({
        barrelId: row.barrelId,
        chargeKind,
        partnerName: "",
        partnerLocation: "",
        partnerAddress: "",
        partnerCountry: "",
        adminNote,
        lines,
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
    <div className="space-y-3">
      <p className="text-[11px] leading-snug text-muted-foreground">
        {isOffPlatformOutboundChargeKind(chargeKind)
          ? `Publish this ${kindLabel.toLowerCase()} so the customer can pay with Zelle, Cash App, or at the local office.`
          : `Publish this ${kindLabel.toLowerCase()} so it appears on the customer Shipping page for add to cart.`}
      </p>
      {lockMessage ?
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-foreground">
          {lockMessage}
        </p>
      : null}
      {existing &&
      (existing.offPlatformSubmittedAt || existing.offPlatformReceiptUrl) ?
        <AdminOutboundOffPlatformPaymentReview
          charge={existing}
          customerName={row.customerName}
          customerEmail={row.customerEmail}
        />
      : null}
      {isPaid && existing && !existing.offPlatformSubmittedAt ?
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-foreground">
          Paid{" "}
          {new Date(existing.paidAt!).toLocaleDateString(undefined, {
            dateStyle: "medium",
          })}
          . This {kindLabel.toLowerCase()} is locked.
        </p>
      : !existing?.offPlatformSubmittedAt && existing ?
        <p className="text-xs text-muted-foreground">
          Published {formatUsd(existing.totalCents)} — editing updates the
          customer{" "}
          {isOffPlatformOutboundChargeKind(chargeKind)
            ? "payment details"
            : "cart item"}
          .
        </p>
      : null}

      <PartnerRecordsEditor
        row={row}
        chargeKind={chargeKind}
        formDisabled={isPaid}
      />

      {chargeKind === "freight" ?
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <div className="space-y-1">
              <Label htmlFor={`${row.barrelId}-${chargeKind}-label`}>
                Shipper charge
              </Label>
              <Input
                id={`${row.barrelId}-${chargeKind}-label`}
                value={label}
                disabled={formDisabled}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${row.barrelId}-${chargeKind}-amount`}>
                Amount (USD)
              </Label>
              <Input
                id={`${row.barrelId}-${chargeKind}-amount`}
                inputMode="decimal"
                value={amountUsd}
                disabled={formDisabled}
                placeholder="0.00"
                onChange={(e) => setAmountUsd(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <div className="space-y-1">
              <Label htmlFor={`${row.barrelId}-${chargeKind}-transport-amount`}>
                Transportation fee
              </Label>
              <p
                className={cn(
                  inputFieldClassName,
                  "flex h-8 items-center py-1 text-sm",
                )}
              >
                {FREIGHT_TRANSPORTATION_FEE_LABEL}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${row.barrelId}-${chargeKind}-transport-amount`}>
                Amount (USD)
              </Label>
              <Input
                id={`${row.barrelId}-${chargeKind}-transport-amount`}
                inputMode="decimal"
                value={transportAmountUsd}
                disabled={formDisabled}
                placeholder="0.00"
                onChange={(e) => setTransportAmountUsd(e.target.value)}
              />
            </div>
          </div>
          {freightTotalCents > 0 ?
            <p className="text-xs font-medium tabular-nums text-muted-foreground">
              Freight total {formatUsd(freightTotalCents)}
            </p>
          : null}
        </div>
      : (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div className="space-y-1">
            <Label htmlFor={`${row.barrelId}-${chargeKind}-label`}>
              Charge label
            </Label>
            <Input
              id={`${row.barrelId}-${chargeKind}-label`}
              value={label}
              disabled={formDisabled}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${row.barrelId}-${chargeKind}-amount`}>
              Amount (USD)
            </Label>
            <Input
              id={`${row.barrelId}-${chargeKind}-amount`}
              inputMode="decimal"
              value={amountUsd}
              disabled={formDisabled}
              placeholder="0.00"
              onChange={(e) => setAmountUsd(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor={`${row.barrelId}-${chargeKind}-note`}>
          Note to customer (optional)
        </Label>
        <textarea
          id={`${row.barrelId}-${chargeKind}-note`}
          rows={3}
          disabled={formDisabled}
          className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
        />
      </div>

      <Button type="button" disabled={formDisabled} onClick={save}>
        {pending ? "Publishing…" : existing ? "Update & publish" : "Publish"}
      </Button>
    </div>
  );
}

export function AdminOutboundChargeKindTabs({
  row,
  publishEnabled,
  lockMessage,
}: {
  row: AdminBarrelOutboundShippingChargeRow;
  publishEnabled: boolean;
  lockMessage?: string;
}) {
  const kinds = useMemo(() => [...BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS], []);
  const [tab, setTab] = useState<BarrelOutboundShippingChargeKind>(() => {
    const pendingKind = kinds.find((kind) => {
      const charge = chargeViewForKind(row.charges, kind);
      return charge ? isOffPlatformPaymentPendingReview(charge) : false;
    });
    return pendingKind ?? "freight";
  });

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Outbound charge types"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {kinds.map((kind) => {
          const published = chargeViewForKind(row.charges, kind);
          return (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={tab === kind}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === kind
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab(kind)}
            >
              {BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[kind]}
              {published ?
                <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                  {formatUsd(published.totalCents)}
                </span>
              : null}
              {published && isOffPlatformPaymentPendingReview(published) ?
                <span className="ml-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                  Verify
                </span>
              : null}
            </button>
          );
        })}
      </div>
      <AdminChargeKindForm
        key={`${row.barrelId}-${tab}-${chargeViewForKind(row.charges, tab)?.chargeId ?? "new"}`}
        row={row}
        chargeKind={tab}
        publishEnabled={publishEnabled}
        lockMessage={lockMessage}
      />
    </div>
  );
}
