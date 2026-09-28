"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  saveBarrelOutboundShippingChargeAction,
  setBarrelOutboundChargeBundleAction,
} from "@/actions/admin-barrel-outbound-shipping-charge";
import {
  addBarrelOutboundShippingPartnerAction,
  applyCatalogOutboundShippingPartnerAction,
  deleteBarrelOutboundShippingPartnerAction,
  setBarrelOutboundShippingPartnerPrimaryAction,
  updateBarrelOutboundShippingPartnerAction,
} from "@/actions/admin-barrel-outbound-shipping-partner";
import { AdminOutboundOffPlatformPaymentReview } from "@/components/admin/admin-outbound-off-platform-payment-review";
import { adminUploadOutboundShippingCompanyImageAction } from "@/actions/admin-upload-outbound-shipping-company-image";
import { ChargeLabelWithCompanyPricing } from "@/components/admin/admin-company-pricing-dialog";
import { AdminProductImagePreview } from "@/components/admin/admin-product-image-preview";
import { ImageFileInput } from "@/components/ui/image-file-input";
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
  chargeKindUsesCompanyRates,
  isAdminShippingCatalogPreview,
  isOffPlatformOutboundChargeKind,
  isOffPlatformPaymentPendingReview,
  outboundChargeBundleHost,
  outboundChargeBundleLabel,
  outboundChargeBundleSameCompanyTitle,
  outboundShippingRateTableKindForChargeKind,
  outboundShippingRateTableKindsForTabs,
  primaryPartnerNameForKind,
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
  const catalogPreview = isAdminShippingCatalogPreview(row);
  const localCount = records.filter((p) =>
    catalogPreview ? !p.barrelId : p.barrelId === row.barrelId,
  ).length;
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [cashappId, setCashappId] = useState("");
  const [cashappAccount, setCashappAccount] = useState("");
  const [zelleId, setZelleId] = useState("");
  const [zelleAccount, setZelleAccount] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [makePrimary, setMakePrimary] = useState(localCount === 0);
  const [formOpen, setFormOpen] = useState(false);
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
    setImageUrl("");
    setMakePrimary(nextCount === 0);
    setFormOpen(false);
  }

  function openAddForm() {
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
    setImageUrl("");
    setMakePrimary(localCount === 0);
    setFormOpen(true);
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
    setImageUrl(record.imageUrl ?? "");
    setMakePrimary(record.isPrimary);
    setFormOpen(true);
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
        imageUrl,
        isPrimary: makePrimary || localCount === 0,
      };
      const res =
        editingId
          ? await updateBarrelOutboundShippingPartnerAction({
              id: editingId,
              ...payload,
            })
          : await addBarrelOutboundShippingPartnerAction({
              ...(catalogPreview ? {} : { barrelId: row.barrelId }),
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

  function uploadCompanyImage(files: FileList | null) {
    const file = files?.[0];
    if (!file || busy) return;
    startTransition(async () => {
      const fd = new FormData();
      if (!catalogPreview) {
        fd.set("barrelId", row.barrelId);
      }
      fd.append("file", file);
      const res = await adminUploadOutboundShippingCompanyImageAction(fd);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setImageUrl(res.imageUrl);
      toast.success("Company image uploaded. Save the company to keep it.");
    });
  }

  function setPrimary(record: (typeof records)[number]) {
    startTransition(async () => {
      const res =
        catalogPreview || record.barrelId === row.barrelId
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
      {formOpen ?
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`${row.barrelId}-${chargeKind}-name`}>
                {nameLabel}
              </Label>
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
            <div className="space-y-1 sm:col-span-2">
              <Label>Company image (Ad)</Label>
              <p className="text-[11px] text-muted-foreground">
                Customers can open this image with Ad on freight, broker, local
                courier, or a consolidated company quote.
              </p>
              <ImageFileInput
                id={`${row.barrelId}-${chargeKind}-image`}
                onFiles={uploadCompanyImage}
              />
              {imageUrl ?
                <div className="space-y-2">
                  <AdminProductImagePreview
                    imageUrl={imageUrl}
                    productLabel={name || "Company image"}
                    imageClassName="max-h-40"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setImageUrl("")}
                  >
                    Remove image
                  </Button>
                </div>
              : null}
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
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => resetForm(records.length)}
            >
              Cancel
            </Button>
          </div>
        </>
      : (
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={openAddForm}
        >
          {addLabel}
        </Button>
      )}

      {records.length === 0 && !formOpen ?
        <p className="text-xs text-muted-foreground">
          Click {addLabel.toLowerCase()} to enter name, address, and payment IDs.
        </p>
      : records.length === 0 ?
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
                <th className="px-3 py-2 font-medium">Ad</th>
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
                const onThisBarrel = catalogPreview
                  ? record.barrelId == null
                  : record.barrelId === row.barrelId;
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
                  <td className="px-3 py-2">
                    {record.imageUrl ?
                      /* eslint-disable-next-line @next/next/no-img-element -- blob URL thumbnail */
                      <img
                        src={record.imageUrl}
                        alt=""
                        className="size-10 rounded-md object-cover"
                      />
                    : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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
  const useRateCard = chargeKindUsesCompanyRates(
    chargeKind,
    row.companyRateKinds ?? [],
    row.chargeBundle,
  );
  const amountsLocked = formDisabled || useRateCard;
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
              <ChargeLabelWithCompanyPricing
                htmlFor={`${row.barrelId}-${chargeKind}-label`}
                label="Shipper charge"
                companyName={primaryPartnerNameForKind(
                  row.partners,
                  row.barrelId,
                  chargeKind,
                )}
                tableKinds={[
                  outboundShippingRateTableKindForChargeKind(chargeKind),
                ]}
                rates={row.companyRates ?? []}
                barrelId={row.barrelId}
                kindsToToggle={[chargeKind]}
                enabledKinds={row.companyRateKinds ?? []}
                linkableContainers={row.rateLinkableContainers ?? []}
                companyRateLinks={row.companyRateLinks ?? []}
                containerKind={row.kind}
                destinationParish={row.destinationParish}
                destinationCityOrTown={row.destinationCityOrTown}
              />
              <Input
                id={`${row.barrelId}-${chargeKind}-label`}
                value={label}
                disabled={amountsLocked}
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
                disabled={amountsLocked}
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
                disabled={amountsLocked}
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
            <ChargeLabelWithCompanyPricing
              htmlFor={`${row.barrelId}-${chargeKind}-label`}
              label="Charge label"
              companyName={primaryPartnerNameForKind(
                row.partners,
                row.barrelId,
                chargeKind,
              )}
              tableKinds={[
                outboundShippingRateTableKindForChargeKind(chargeKind),
              ]}
              rates={row.companyRates ?? []}
              barrelId={row.barrelId}
              kindsToToggle={[chargeKind]}
              enabledKinds={row.companyRateKinds ?? []}
              linkableContainers={row.rateLinkableContainers ?? []}
              companyRateLinks={row.companyRateLinks ?? []}
              containerKind={row.kind}
              destinationParish={row.destinationParish}
              destinationCityOrTown={row.destinationCityOrTown}
            />
            <Input
              id={`${row.barrelId}-${chargeKind}-label`}
              value={label}
              disabled={amountsLocked}
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
              disabled={amountsLocked}
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

function AdminMergedBundleForm({
  row,
  bundledKinds,
  publishEnabled,
  lockMessage,
}: {
  row: AdminBarrelOutboundShippingChargeRow;
  bundledKinds: BarrelOutboundShippingChargeKind[];
  publishEnabled: boolean;
  lockMessage?: string;
}) {
  const router = useRouter();
  const host = outboundChargeBundleHost(bundledKinds) ?? bundledKinds[0] ?? "freight";
  const absorbed = bundledKinds.filter((kind) => kind !== host);
  const hostCharge = chargeViewForKind(row.charges, host);
  const freightLines = splitFreightChargeLines(hostCharge?.lines);
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(
    host === "freight"
      ? (freightLines.shipper?.label ?? FREIGHT_SHIPPER_CHARGE_LABEL)
      : (hostCharge?.lines[0]?.label ??
        BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_DEFAULT_LABELS[host]),
  );
  const [amountUsd, setAmountUsd] = useState(
    centsToUsdInput(
      host === "freight"
        ? (freightLines.shipper?.amountCents ?? 0)
        : (hostCharge?.totalCents ?? 0),
    ),
  );
  const [transportAmountUsd, setTransportAmountUsd] = useState(
    centsToUsdInput(freightLines.transportation?.amountCents ?? 0),
  );
  const [adminNote, setAdminNote] = useState(hostCharge?.adminNote ?? "");
  const [extraLabels, setExtraLabels] = useState<
    Partial<Record<BarrelOutboundShippingChargeKind, string>>
  >(() =>
    Object.fromEntries(
      absorbed.map((kind) => {
        const extra = chargeViewForKind(row.charges, kind);
        return [
          kind,
          extra?.lines[0]?.label ??
            BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_DEFAULT_LABELS[kind],
        ];
      }),
    ),
  );
  const [extraAmounts, setExtraAmounts] = useState<
    Partial<Record<BarrelOutboundShippingChargeKind, string>>
  >(() =>
    Object.fromEntries(
      absorbed.map((kind) => {
        const extra = chargeViewForKind(row.charges, kind);
        return [kind, centsToUsdInput(extra?.totalCents ?? 0)];
      }),
    ),
  );

  const anyPaid = bundledKinds.some(
    (kind) => chargeViewForKind(row.charges, kind)?.paidAt != null,
  );
  const pendingReview = bundledKinds.some((kind) => {
    const charge = chargeViewForKind(row.charges, kind);
    return charge ? isOffPlatformPaymentPendingReview(charge) : false;
  });
  const formDisabled = anyPaid || pendingReview || pending || !publishEnabled;
  const useRateCard = bundledKinds.every((kind) =>
    (row.companyRateKinds ?? []).includes(kind),
  );
  const amountsLocked = formDisabled || useRateCard;
  const hostTotalCents =
    host === "freight"
      ? parseUsdInputToCents(amountUsd) + parseUsdInputToCents(transportAmountUsd)
      : parseUsdInputToCents(amountUsd);
  const extraTotalCents = absorbed.reduce(
    (sum, kind) => sum + parseUsdInputToCents(extraAmounts[kind] ?? ""),
    0,
  );
  const combinedTotalCents = hostTotalCents + extraTotalCents;
  const title = outboundChargeBundleSameCompanyTitle(bundledKinds);

  function save() {
    startTransition(async () => {
      const hostLines =
        host === "freight"
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
      const hostRes = await saveBarrelOutboundShippingChargeAction({
        barrelId: row.barrelId,
        chargeKind: host,
        partnerName: "",
        partnerLocation: "",
        partnerAddress: "",
        partnerCountry: "",
        adminNote,
        lines: hostLines,
      });
      if (!hostRes.ok) {
        toast.error(hostRes.message);
        return;
      }
      for (const kind of absorbed) {
        const extraAmount = extraAmounts[kind] ?? "";
        if (parseUsdInputToCents(extraAmount) <= 0) continue;
        const extraRes = await saveBarrelOutboundShippingChargeAction({
          barrelId: row.barrelId,
          chargeKind: kind,
          partnerName: "",
          partnerLocation: "",
          partnerAddress: "",
          partnerCountry: "",
          adminNote: "",
          lines: [
            {
              label:
                extraLabels[kind]?.trim() ||
                BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_DEFAULT_LABELS[kind],
              amountUsd: extraAmount,
            },
          ],
        });
        if (!extraRes.ok) {
          toast.error(extraRes.message);
          return;
        }
      }
      toast.success(hostRes.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Company, address, and payment IDs are shared. Publish freight and
          broker amounts on this one quote — not a separate broker company.
        </p>
      </div>
      {lockMessage ?
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-foreground">
          {lockMessage}
        </p>
      : null}
      {bundledKinds.map((kind) => {
        const charge = chargeViewForKind(row.charges, kind);
        if (
          !charge ||
          !(charge.offPlatformSubmittedAt || charge.offPlatformReceiptUrl)
        ) {
          return null;
        }
        return (
          <AdminOutboundOffPlatformPaymentReview
            key={charge.chargeId}
            charge={charge}
            customerName={row.customerName}
            customerEmail={row.customerEmail}
          />
        );
      })}
      {anyPaid && hostCharge && !hostCharge.offPlatformSubmittedAt ?
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-foreground">
          Paid{" "}
          {new Date(hostCharge.paidAt!).toLocaleDateString(undefined, {
            dateStyle: "medium",
          })}
          . This combined quote is locked.
        </p>
      : hostCharge && !hostCharge.offPlatformSubmittedAt ?
        <p className="text-xs text-muted-foreground">
          Published {formatUsd(hostCharge.totalCents + extraTotalCents)} —
          editing updates the customer cart item.
        </p>
      : null}

      <PartnerRecordsEditor
        row={row}
        chargeKind={host}
        formDisabled={anyPaid}
      />

      {host === "freight" ?
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <div className="space-y-1">
              <ChargeLabelWithCompanyPricing
                htmlFor={`${row.barrelId}-bundle-label`}
                label="Shipper charge"
                companyName={primaryPartnerNameForKind(
                  row.partners,
                  row.barrelId,
                  host,
                )}
                tableKinds={outboundShippingRateTableKindsForTabs(bundledKinds)}
                rates={row.companyRates ?? []}
                barrelId={row.barrelId}
                kindsToToggle={bundledKinds}
                enabledKinds={row.companyRateKinds ?? []}
                linkableContainers={row.rateLinkableContainers ?? []}
                companyRateLinks={row.companyRateLinks ?? []}
                containerKind={row.kind}
                destinationParish={row.destinationParish}
                destinationCityOrTown={row.destinationCityOrTown}
              />
              <Input
                id={`${row.barrelId}-bundle-label`}
                value={label}
                disabled={amountsLocked}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${row.barrelId}-bundle-amount`}>
                Amount (USD)
              </Label>
              <Input
                id={`${row.barrelId}-bundle-amount`}
                inputMode="decimal"
                value={amountUsd}
                disabled={amountsLocked}
                placeholder="0.00"
                onChange={(e) => setAmountUsd(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <div className="space-y-1">
              <Label htmlFor={`${row.barrelId}-bundle-transport-amount`}>
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
              <Label htmlFor={`${row.barrelId}-bundle-transport-amount`}>
                Amount (USD)
              </Label>
              <Input
                id={`${row.barrelId}-bundle-transport-amount`}
                inputMode="decimal"
                value={transportAmountUsd}
                disabled={amountsLocked}
                placeholder="0.00"
                onChange={(e) => setTransportAmountUsd(e.target.value)}
              />
            </div>
          </div>
        </div>
      : (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div className="space-y-1">
            <ChargeLabelWithCompanyPricing
              htmlFor={`${row.barrelId}-bundle-label`}
              label="Charge label"
              companyName={primaryPartnerNameForKind(
                row.partners,
                row.barrelId,
                host,
              )}
              tableKinds={outboundShippingRateTableKindsForTabs(bundledKinds)}
              rates={row.companyRates ?? []}
              barrelId={row.barrelId}
              kindsToToggle={bundledKinds}
              enabledKinds={row.companyRateKinds ?? []}
              linkableContainers={row.rateLinkableContainers ?? []}
              companyRateLinks={row.companyRateLinks ?? []}
              containerKind={row.kind}
              destinationParish={row.destinationParish}
              destinationCityOrTown={row.destinationCityOrTown}
            />
            <Input
              id={`${row.barrelId}-bundle-label`}
              value={label}
              disabled={amountsLocked}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${row.barrelId}-bundle-amount`}>Amount (USD)</Label>
            <Input
              id={`${row.barrelId}-bundle-amount`}
              inputMode="decimal"
              value={amountUsd}
              disabled={amountsLocked}
              placeholder="0.00"
              onChange={(e) => setAmountUsd(e.target.value)}
            />
          </div>
        </div>
      )}

      {absorbed.map((kind) => (
        <div
          key={kind}
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]"
        >
          <div className="space-y-1">
            <Label htmlFor={`${row.barrelId}-bundle-${kind}-label`}>
              {BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[kind]} amount
            </Label>
            <Input
              id={`${row.barrelId}-bundle-${kind}-label`}
              value={extraLabels[kind] ?? ""}
              disabled={amountsLocked}
              onChange={(e) =>
                setExtraLabels((current) => ({
                  ...current,
                  [kind]: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${row.barrelId}-bundle-${kind}-amount`}>
              Amount (USD)
            </Label>
            <Input
              id={`${row.barrelId}-bundle-${kind}-amount`}
              inputMode="decimal"
              value={extraAmounts[kind] ?? ""}
              disabled={amountsLocked}
              placeholder="0.00"
              onChange={(e) =>
                setExtraAmounts((current) => ({
                  ...current,
                  [kind]: e.target.value,
                }))
              }
            />
          </div>
        </div>
      ))}

      {combinedTotalCents > 0 ?
        <p className="text-xs font-medium tabular-nums text-muted-foreground">
          Combined total {formatUsd(combinedTotalCents)}
        </p>
      : null}

      <div className="space-y-1">
        <Label htmlFor={`${row.barrelId}-bundle-note`}>
          Note to customer (optional)
        </Label>
        <textarea
          id={`${row.barrelId}-bundle-note`}
          rows={3}
          disabled={formDisabled}
          className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
        />
      </div>

      <Button type="button" disabled={formDisabled} onClick={save}>
        {pending ? "Publishing…" : hostCharge ? "Update & publish" : "Publish"}
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
  const bundle = row.chargeBundle ?? [];
  const groups = useMemo(() => {
    const host = outboundChargeBundleHost(bundle);
    if (!host) {
      return kinds.map((kind) => ({
        id: kind,
        kinds: [kind],
        label: BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[kind],
      }));
    }
    const grouped = kinds.filter((kind) => bundle.includes(kind));
    const rest = kinds.filter((kind) => !bundle.includes(kind));
    return [
      {
        id: host,
        kinds: grouped,
        label: outboundChargeBundleLabel(grouped),
      },
      ...rest.map((kind) => ({
        id: kind,
        kinds: [kind],
        label: BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[kind],
      })),
    ];
  }, [bundle, kinds]);
  const [tab, setTab] = useState<string>(() => {
    const pendingKind = kinds.find((kind) => {
      const charge = chargeViewForKind(row.charges, kind);
      return charge ? isOffPlatformPaymentPendingReview(charge) : false;
    });
    const pendingGroup = groups.find(
      (group) => pendingKind && group.kinds.includes(pendingKind),
    );
    return pendingGroup?.id ?? groups[0]?.id ?? "freight";
  });
  const activeGroup = groups.find((group) => group.id === tab) ?? groups[0];

  return (
    <div className="space-y-3">
      <AdminChargeBundleControls row={row} />
      <div
        role="tablist"
        aria-label="Outbound charge types"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {groups.map((group) => {
          const publishedCents = group.kinds.reduce((sum, kind) => {
            const published = chargeViewForKind(row.charges, kind);
            return sum + (published?.totalCents ?? 0);
          }, 0);
          const pendingReview = group.kinds.some((kind) => {
            const published = chargeViewForKind(row.charges, kind);
            return published
              ? isOffPlatformPaymentPendingReview(published)
              : false;
          });
          return (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={tab === group.id}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === group.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab(group.id)}
            >
              {group.label}
              {publishedCents > 0 ?
                <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                  {formatUsd(publishedCents)}
                </span>
              : null}
              {pendingReview ?
                <span className="ml-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                  Verify
                </span>
              : null}
            </button>
          );
        })}
      </div>
      {activeGroup ?
        activeGroup.kinds.length > 1 ?
          <AdminMergedBundleForm
            row={row}
            bundledKinds={activeGroup.kinds}
            publishEnabled={publishEnabled}
            lockMessage={lockMessage}
          />
        : (
          <AdminChargeKindForm
            key={`${row.barrelId}-${activeGroup.kinds[0]}-${chargeViewForKind(row.charges, activeGroup.kinds[0]!)?.chargeId ?? "new"}`}
            row={row}
            chargeKind={activeGroup.kinds[0]!}
            publishEnabled={publishEnabled}
            lockMessage={lockMessage}
          />
        )
      : null}
    </div>
  );
}

function AdminChargeBundleControls({
  row,
}: {
  row: AdminBarrelOutboundShippingChargeRow;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const catalogPreview = isAdminShippingCatalogPreview(row);
  const saved = row.chargeBundle ?? [];
  const [selected, setSelected] = useState<BarrelOutboundShippingChargeKind[]>(
    saved,
  );

  useEffect(() => {
    setSelected(row.chargeBundle ?? []);
  }, [row.chargeBundle]);

  function toggle(kind: BarrelOutboundShippingChargeKind) {
    setSelected((current) =>
      current.includes(kind)
        ? current.filter((item) => item !== kind)
        : [...BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS.filter((item) =>
            item === kind || current.includes(item),
          )],
    );
  }

  function apply(kinds: BarrelOutboundShippingChargeKind[]) {
    startTransition(async () => {
      const res = await setBarrelOutboundChargeBundleAction({
        barrelId: row.barrelId,
        kinds,
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
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2.5">
      <p className="text-xs font-medium text-foreground">
        Consolidate sub-tab charges
      </p>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Select two or all three. Freight and broker share one company form and
        one clearance PDF section.
        {catalogPreview
          ? " This merger is saved for all future customer containers."
          : " New containers for this customer reuse the same merger."}
      </p>
      <div className="flex flex-wrap gap-3">
        {BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS.map((kind) => (
          <label
            key={kind}
            className="inline-flex items-center gap-1.5 text-xs text-foreground"
          >
            <input
              type="checkbox"
              className="size-3.5 accent-primary"
              checked={selected.includes(kind)}
              disabled={pending}
              onChange={() => toggle(kind)}
            />
            {BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[kind]}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || selected.length < 2}
          onClick={() => apply(selected)}
        >
          {pending ? "Saving…" : "Consolidate selected"}
        </Button>
        {saved.length >= 2 ?
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setSelected([]);
              apply([]);
            }}
          >
            Separate tabs
          </Button>
        : null}
      </div>
    </div>
  );
}
