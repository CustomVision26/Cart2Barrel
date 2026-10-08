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
  setOutboundCompanyCustomerNoteAction,
  setOutboundShippingPartnerPublicPricingAction,
  updateBarrelOutboundShippingPartnerAction,
} from "@/actions/admin-barrel-outbound-shipping-partner";
import { AdminOutboundOffPlatformPaymentReview } from "@/components/admin/admin-outbound-off-platform-payment-review";
import { ChargeLabelWithCompanyPricing } from "@/components/admin/admin-company-pricing-dialog";
import { OutboundChargePaymentStatus } from "@/components/shipping/outbound-charge-payment-status";
import { adminUploadOutboundShippingCompanyImageAction } from "@/actions/admin-upload-outbound-shipping-company-image";
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
  companyCustomerNoteFromPartners,
  isAdminShippingCatalogPreview,
  isOffPlatformOutboundChargeKind,
  isOffPlatformPaymentPendingReview,
  outboundChargeBundleHost,
  outboundChargeBundleLabel,
  outboundChargeBundleSameCompanyTitle,
  outboundShippingCompanyKey,
  outboundShippingRateTableKindForChargeKind,
  outboundShippingRateTableKindsForTabs,
  primaryPartnerNameForKind,
  quotedHubTransportFeeCents,
  splitFreightChargeLines,
  unpaidLinkedContainerCount,
  type BarrelOutboundShippingChargeKind,
} from "@/lib/barrel-outbound-shipping-charge";
import { parseUsdInputToCents } from "@/lib/validations/barrel-outbound-shipping-charge";
import { cn } from "@/lib/utils";

function centsToUsdInput(cents: number): string {
  return cents > 0 ? (cents / 100).toFixed(2) : "";
}

function kindsForCompanyName(
  partners: AdminBarrelOutboundShippingChargeRow["partners"],
  name: string,
): BarrelOutboundShippingChargeKind[] {
  const key = outboundShippingCompanyKey(name);
  if (!key) return [];
  return BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS.filter((kind) =>
    partners.some(
      (partner) =>
        partner.chargeKind === kind &&
        outboundShippingCompanyKey(partner.name) === key,
    ),
  );
}

function tabIdForCompanyKinds(
  kinds: readonly BarrelOutboundShippingChargeKind[],
  bundle: readonly BarrelOutboundShippingChargeKind[],
): string {
  const host = outboundChargeBundleHost(bundle);
  if (host && kinds.some((kind) => bundle.includes(kind))) return host;
  return kinds[0] ?? "freight";
}

function companyTypeLabel(
  partners: AdminBarrelOutboundShippingChargeRow["partners"],
  name: string,
): string | null {
  const typeKinds = kindsForCompanyName(partners, name);
  if (typeKinds.length === 0) return null;
  return typeKinds.length >= 2
    ? outboundChargeBundleLabel(typeKinds)
    : BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[typeKinds[0]!];
}

function uniquePartnerRecords(
  partners: AdminBarrelOutboundShippingChargeRow["partners"],
  preferredKind: BarrelOutboundShippingChargeKind,
) {
  const byKey = new Map<string, (typeof partners)[number]>();
  for (const partner of partners) {
    const key = outboundShippingCompanyKey(partner.name);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, partner);
      continue;
    }
    if (
      partner.chargeKind === preferredKind &&
      existing.chargeKind !== preferredKind
    ) {
      byKey.set(key, partner);
    }
  }
  return [...byKey.values()];
}

function hubTransportQuote(row: AdminBarrelOutboundShippingChargeRow): {
  containerCount: number;
  quotedCents: number | null;
} {
  const companyName = primaryPartnerNameForKind(
    row.partners,
    row.barrelId,
    "freight",
  );
  const containerCount = unpaidLinkedContainerCount({
    barrelId: row.barrelId,
    companyName,
    chargeKind: "freight",
    companyRateLinks: row.companyRateLinks ?? [],
    linkableContainers: row.rateLinkableContainers ?? [],
  });
  return {
    containerCount,
    quotedCents: quotedHubTransportFeeCents({
      rates: row.companyRates ?? [],
      companyName,
      containerKind: row.kind,
      containerCount,
    }),
  };
}

function hubTransportAmountUsd(
  quote: { quotedCents: number | null },
  fallbackUsd: string,
  locked: boolean,
): string {
  if (locked || quote.quotedCents == null) return fallbackUsd;
  return (quote.quotedCents / 100).toFixed(2);
}

function CompanyServiceNoteField({
  row,
  chargeKind,
  adminNote,
  setAdminNote,
  noteLocked,
}: {
  row: AdminBarrelOutboundShippingChargeRow;
  chargeKind: BarrelOutboundShippingChargeKind;
  adminNote: string;
  setAdminNote: (value: string) => void;
  noteLocked: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const companyName = primaryPartnerNameForKind(
    row.partners,
    row.barrelId,
    chargeKind,
  );
  const noteId = `${row.barrelId}-${chargeKind}-company-note`;

  function saveNote() {
    if (!companyName) {
      toast.error("Add a company first.");
      return;
    }
    startTransition(async () => {
      const res = await setOutboundCompanyCustomerNoteAction({
        companyName,
        customerNote: adminNote,
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
    <div className="space-y-1">
      <Label htmlFor={noteId}>Note to customer (optional)</Label>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Unique to this company. Visitors see it on How it works when they tap
        Ad, or the info button on In-US freight. Edit it here or on Container
        Control.
      </p>
      <textarea
        id={noteId}
        rows={3}
        disabled={noteLocked || pending}
        className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={adminNote}
        onChange={(e) => setAdminNote(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={noteLocked || pending}
        onClick={saveNote}
      >
        {pending ? "Saving…" : "Save note"}
      </Button>
    </div>
  );
}

const PARTNER_LOCATION_FROM_HINT =
  "Where this company transports the container from";

function PartnerRecordValue({
  value,
  className,
  emphasize,
  titleSuffix,
}: {
  value: string | null | undefined;
  className?: string;
  emphasize?: boolean;
  titleSuffix?: string;
}) {
  const raw = value?.trim() || "";
  const compact = raw.replace(/\s+/g, " ");
  const title = compact
    ? titleSuffix
      ? `${raw} — ${titleSuffix}`
      : raw
    : undefined;
  return (
    <td
      className={cn(
        "px-3 py-2 text-muted-foreground",
        emphasize && "bg-primary/10",
        className,
      )}
    >
      {compact ?
        <span
          className={cn(
            "block max-w-[7.5rem] truncate",
            emphasize && "font-semibold text-primary",
          )}
          title={title}
        >
          {compact}
        </span>
      : "—"}
    </td>
  );
}

function PartnerRecordsEditor({
  row,
  chargeKind,
  formDisabled,
  selectedCompanyKey = null,
  onSelectCompany,
}: {
  row: AdminBarrelOutboundShippingChargeRow;
  chargeKind: BarrelOutboundShippingChargeKind;
  formDisabled: boolean;
  selectedCompanyKey?: string | null;
  onSelectCompany?: (
    record: AdminBarrelOutboundShippingChargeRow["partners"][number],
  ) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const kindRecords = row.partners.filter((p) => p.chargeKind === chargeKind);
  const records = uniquePartnerRecords(row.partners, chargeKind);
  const catalogPreview = isAdminShippingCatalogPreview(row);
  const localCount = kindRecords.filter((p) =>
    catalogPreview ? true : p.barrelId === row.barrelId,
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
  const [companyRole, setCompanyRole] = useState<"standalone" | "consolidate">(
    "standalone",
  );
  const [formKinds, setFormKinds] = useState<BarrelOutboundShippingChargeKind[]>(
    [chargeKind],
  );
  const busy = formDisabled || pending;
  const isFreight = chargeKind === "freight";
  const showOperateFrom = formKinds.some((kind) => kind !== "freight");
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
    setCompanyRole("standalone");
    setFormKinds([chargeKind]);
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
    setCompanyRole("standalone");
    setFormKinds([chargeKind]);
    setFormOpen(true);
  }

  function startEdit(record: (typeof records)[number]) {
    const kinds = kindsForCompanyName(row.partners, record.name);
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
    setCompanyRole(kinds.length >= 2 ? "consolidate" : "standalone");
    setFormKinds(kinds.length > 0 ? kinds : [record.chargeKind]);
    setFormOpen(true);
    onSelectCompany?.(record);
  }

  function saveRecord() {
    const kindsToSave =
      companyRole === "standalone"
        ? [formKinds[0] ?? chargeKind]
        : BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS.filter((kind) =>
            formKinds.includes(kind),
          );
    if (companyRole === "standalone" && kindsToSave.length !== 1) {
      toast.error("Choose Freight, Broker, or Local courier for a standalone company.");
      return;
    }
    if (companyRole === "consolidate" && kindsToSave.length < 2) {
      toast.error("Select two or three charges to consolidate this company.");
      return;
    }
    startTransition(async () => {
      const makeThisPrimary = makePrimary || localCount === 0;
      for (const kind of kindsToSave) {
        const operateFrom = kind !== "freight";
        const payload = {
          name,
          location: operateFrom ? location : "",
          address,
          country: operateFrom ? country : "",
          phone,
          cashappId,
          cashappAccount,
          zelleId,
          zelleAccount,
          imageUrl,
          isPrimary: makeThisPrimary,
        };
        const existing = row.partners.find(
          (partner) =>
            partner.chargeKind === kind &&
            outboundShippingCompanyKey(partner.name) ===
              outboundShippingCompanyKey(name) &&
            (catalogPreview || partner.barrelId === row.barrelId || partner.barrelId == null),
        );
        const res =
          existing
            ? await updateBarrelOutboundShippingPartnerAction({
                id: existing.id,
                ...payload,
                keepOnlyThisKind: companyRole === "standalone",
              })
            : await addBarrelOutboundShippingPartnerAction({
                ...(catalogPreview ? {} : { barrelId: row.barrelId }),
                chargeKind: kind,
                ...payload,
                keepOnlyThisKind: companyRole === "standalone",
              });
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
      }
      const savedKind = kindsToSave[0] ?? chargeKind;
      onSelectCompany?.({
        id: editingId ?? "",
        barrelId: catalogPreview ? null : row.barrelId,
        chargeKind: savedKind,
        name,
        location: location || null,
        address: address || null,
        country: country || null,
        phone: phone || null,
        cashappId: cashappId || null,
        cashappAccount: cashappAccount || null,
        zelleId: zelleId || null,
        zelleAccount: zelleAccount || null,
        imageUrl: imageUrl || null,
        isPrimary: makeThisPrimary,
        customerNote: null,
        publicPricingPublishedAt: null,
      });
      toast.success(
        companyRole === "consolidate"
          ? `${outboundChargeBundleLabel(kindsToSave)} saved as one company.`
          : "Record saved.",
      );
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
        catalogPreview
          ? await setBarrelOutboundShippingPartnerPrimaryAction({
              id: record.id,
              catalog: true,
            })
          : record.barrelId === row.barrelId
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
      onSelectCompany?.(record);
      router.refresh();
    });
  }

  function togglePublicPricing(
    record: (typeof records)[number],
    published: boolean,
  ) {
    startTransition(async () => {
      const res = await setOutboundShippingPartnerPublicPricingAction({
        id: record.id,
        published,
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
          <div className="space-y-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2.5">
            <p className="text-xs font-medium text-foreground">
              Company type
            </p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Standalone is one charge. Consolidate shares one company form
              across two or three charges (Freight and broker use the same
              quote).
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-1.5 text-xs text-foreground">
                <input
                  type="radio"
                  name={`${row.barrelId}-${chargeKind}-company-role`}
                  className="size-3.5 accent-primary"
                  checked={companyRole === "standalone"}
                  disabled={busy}
                  onChange={() => {
                    setCompanyRole("standalone");
                    setFormKinds([formKinds[0] ?? chargeKind]);
                  }}
                />
                Standalone
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-foreground">
                <input
                  type="radio"
                  name={`${row.barrelId}-${chargeKind}-company-role`}
                  className="size-3.5 accent-primary"
                  checked={companyRole === "consolidate"}
                  disabled={busy}
                  onChange={() => {
                    setCompanyRole("consolidate");
                    setFormKinds(
                      formKinds.length >= 2
                        ? formKinds
                        : (["freight", "broker"] as BarrelOutboundShippingChargeKind[]),
                    );
                  }}
                />
                Consolidate
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              {BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS.map((kind) => {
                const checked = formKinds.includes(kind);
                return (
                  <label
                    key={kind}
                    className="inline-flex items-center gap-1.5 text-xs text-foreground"
                  >
                    <input
                      type={companyRole === "standalone" ? "radio" : "checkbox"}
                      name={
                        companyRole === "standalone"
                          ? `${row.barrelId}-${chargeKind}-form-kind`
                          : undefined
                      }
                      className="size-3.5 accent-primary"
                      checked={checked}
                      disabled={busy}
                      onChange={() => {
                        if (companyRole === "standalone") {
                          setFormKinds([kind]);
                          return;
                        }
                        setFormKinds((current) =>
                          current.includes(kind)
                            ? current.filter((item) => item !== kind)
                            : BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS.filter(
                                (item) => item === kind || current.includes(item),
                              ),
                        );
                      }}
                    />
                    {BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[kind]}
                  </label>
                );
              })}
            </div>
          </div>
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
            {showOperateFrom ?
              <>
                <div className="space-y-1 rounded-md border border-primary/30 bg-primary/10 p-2">
                  <Label htmlFor={`${row.barrelId}-${chargeKind}-location`}>
                    Location
                  </Label>
                  <Input
                    id={`${row.barrelId}-${chargeKind}-location`}
                    value={location}
                    disabled={busy}
                    placeholder="e.g. Kingston Container Terminal (KCT)"
                    onChange={(e) => setLocation(e.target.value)}
                  />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {PARTNER_LOCATION_FROM_HINT}.
                  </p>
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
          {!catalogPreview && localCount < records.length ?
            <p className="text-xs text-muted-foreground">
              Companies already saved on other containers are listed here. Click
              a row to select it and switch the tab to that company&apos;s type.
              Select Primary to use one on this container.
            </p>
          : catalogPreview ?
            <p className="text-xs text-muted-foreground">
              Companies saved here or on a shipment card. Click a row to select
              it — the tab bar shows that company&apos;s type (standalone or
              consolidated). Edit address, payment IDs, and Charge rate tables
              without opening a container.
            </p>
          : (
            <p className="text-xs text-muted-foreground">
              Click a company to select it. The tab bar switches to that
              company&apos;s type.
            </p>
          )}
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
                    <th
                      className="bg-primary/10 px-3 py-2 font-medium text-primary"
                      title={PARTNER_LOCATION_FROM_HINT}
                    >
                      Location
                    </th>
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
                const onThisBarrel =
                  catalogPreview || record.barrelId === row.barrelId;
                const showAsPrimary = catalogPreview
                  ? record.barrelId == null && record.isPrimary
                  : onThisBarrel && record.isPrimary;
                const isSelected =
                  selectedCompanyKey === outboundShippingCompanyKey(record.name);
                const typeLabel = companyTypeLabel(row.partners, record.name);
                return (
                <tr
                  key={record.id}
                  className={cn(
                    appTableRowHover,
                    "cursor-pointer",
                    (editingId === record.id || isSelected) && "bg-primary/10",
                  )}
                  onClick={() => onSelectCompany?.(record)}
                >
                  <td className="px-3 py-2">
                    <input
                      type="radio"
                      name={`${row.barrelId}-${chargeKind}-primary`}
                      className="size-4 accent-primary"
                      checked={record.chargeKind === chargeKind && showAsPrimary}
                      disabled={busy || record.chargeKind !== chargeKind}
                      aria-label={`Set ${record.name} as primary`}
                      onChange={() => {
                        onSelectCompany?.(record);
                        setPrimary(record);
                      }}
                    />
                  </td>
                  <td className="max-w-[9rem] px-3 py-2 font-medium text-foreground">
                    <span className="inline-flex max-w-full flex-wrap items-center gap-1.5">
                      <span className="truncate" title={record.name}>
                        {record.name}
                      </span>
                      {showAsPrimary ?
                        <StatusBadge kind="fullyReceived">Primary</StatusBadge>
                      : !onThisBarrel && !catalogPreview ?
                        <StatusBadge kind="draft">Saved</StatusBadge>
                      : null}
                      {record.publicPricingPublishedAt ?
                        <StatusBadge kind="quoted">How it works</StatusBadge>
                      : null}
                      {typeLabel ?
                        <StatusBadge kind="quoted">{typeLabel}</StatusBadge>
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
                      <PartnerRecordValue value={record.country} />
                      <PartnerRecordValue
                        value={record.location}
                        emphasize
                        titleSuffix={PARTNER_LOCATION_FROM_HINT}
                      />
                    </>
                  : null}
                  <PartnerRecordValue value={record.address} />
                  <PartnerRecordValue value={record.phone} />
                  <PartnerRecordValue value={record.cashappId} />
                  <PartnerRecordValue value={record.cashappAccount} />
                  <PartnerRecordValue value={record.zelleId} />
                  <PartnerRecordValue value={record.zelleAccount} />
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          record.publicPricingPublishedAt ? "outline" : "default"
                        }
                        disabled={busy}
                        onClick={() =>
                          togglePublicPricing(
                            record,
                            !record.publicPricingPublishedAt,
                          )
                        }
                      >
                        {record.publicPricingPublishedAt
                          ? "Unpublish from How it works"
                          : "Publish to How it works"}
                      </Button>
                      {onThisBarrel ?
                        <>
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
                        </>
                      : (
                        <span className="text-xs text-muted-foreground">
                          Select Primary to use
                        </span>
                      )}
                    </div>
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
  selectedCompanyKey = null,
  onSelectCompany,
}: {
  row: AdminBarrelOutboundShippingChargeRow;
  chargeKind: BarrelOutboundShippingChargeKind;
  publishEnabled: boolean;
  lockMessage?: string;
  selectedCompanyKey?: string | null;
  onSelectCompany?: (
    record: AdminBarrelOutboundShippingChargeRow["partners"][number],
  ) => void;
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
  const [adminNote, setAdminNote] = useState(
    existing?.adminNote ??
      companyCustomerNoteFromPartners(
        row.partners,
        primaryPartnerNameForKind(row.partners, row.barrelId, chargeKind),
      ) ??
      "",
  );
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
  const hubTransport = hubTransportQuote(row);
  const billedTransportUsd = hubTransportAmountUsd(
    hubTransport,
    transportAmountUsd,
    isPaid || pendingReview,
  );
  const kindLabel = BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[chargeKind];
  const freightTotalCents =
    parseUsdInputToCents(amountUsd) + parseUsdInputToCents(billedTransportUsd);

  function save() {
    startTransition(async () => {
      const lines =
        chargeKind === "freight"
          ? [
              {
                label: label.trim() || FREIGHT_SHIPPER_CHARGE_LABEL,
                amountUsd,
              },
              ...(parseUsdInputToCents(billedTransportUsd) > 0
                ? [
                    {
                      label: FREIGHT_TRANSPORTATION_FEE_LABEL,
                      amountUsd: billedTransportUsd,
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
      {existing && pendingReview ?
        null
      : existing &&
        (existing.offPlatformSubmittedAt || existing.offPlatformReceiptUrl) ?
        <AdminOutboundOffPlatformPaymentReview
          charge={existing}
          customerName={row.customerName}
          customerEmail={row.customerEmail}
        />
      : existing ?
        <OutboundChargePaymentStatus
          charges={[existing]}
          audience="admin"
          customerName={row.customerName}
          customerEmail={row.customerEmail}
        />
      : null}
      {isPaid && existing && !pendingReview ?
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-foreground">
          Paid{" "}
          {new Date(existing.paidAt!).toLocaleDateString(undefined, {
            dateStyle: "medium",
          })}
          . This {kindLabel.toLowerCase()} is locked.
        </p>
      : existing && !pendingReview ?
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
        formDisabled={isPaid || pendingReview}
        selectedCompanyKey={selectedCompanyKey}
        onSelectCompany={onSelectCompany}
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
              <ChargeLabelWithCompanyPricing
                htmlFor={`${row.barrelId}-${chargeKind}-transport-amount`}
                label="Pickup fee"
                showRateCardToggle={false}
                dialogVariant="hub-transport"
                companyName={primaryPartnerNameForKind(
                  row.partners,
                  row.barrelId,
                  chargeKind,
                )}
                tableKinds={["transport"]}
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
                value={billedTransportUsd}
                disabled={amountsLocked || hubTransport.quotedCents != null}
                placeholder="0.00"
                onChange={(e) => setTransportAmountUsd(e.target.value)}
              />
              {hubTransport.quotedCents != null ?
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {hubTransport.containerCount >= 2
                    ? `${hubTransport.containerCount} linked barrels × extra-container fee`
                    : "1-container pickup fee"}
                </p>
              : null}
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

      <CompanyServiceNoteField
        row={row}
        chargeKind={chargeKind}
        adminNote={adminNote}
        setAdminNote={setAdminNote}
        noteLocked={isPaid || pendingReview}
      />

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
  selectedCompanyKey = null,
  onSelectCompany,
}: {
  row: AdminBarrelOutboundShippingChargeRow;
  bundledKinds: BarrelOutboundShippingChargeKind[];
  publishEnabled: boolean;
  lockMessage?: string;
  selectedCompanyKey?: string | null;
  onSelectCompany?: (
    record: AdminBarrelOutboundShippingChargeRow["partners"][number],
  ) => void;
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
  const [adminNote, setAdminNote] = useState(
    hostCharge?.adminNote ??
      companyCustomerNoteFromPartners(
        row.partners,
        primaryPartnerNameForKind(row.partners, row.barrelId, host),
      ) ??
      "",
  );
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
  const hubTransport = hubTransportQuote(row);
  const billedTransportUsd = hubTransportAmountUsd(
    hubTransport,
    transportAmountUsd,
    anyPaid || pendingReview,
  );
  const hostTotalCents =
    host === "freight"
      ? parseUsdInputToCents(amountUsd) + parseUsdInputToCents(billedTransportUsd)
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
              ...(parseUsdInputToCents(billedTransportUsd) > 0
                ? [
                    {
                      label: FREIGHT_TRANSPORTATION_FEE_LABEL,
                      amountUsd: billedTransportUsd,
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
          isOffPlatformPaymentPendingReview(charge) ||
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
      {hostCharge &&
      !hostCharge.offPlatformSubmittedAt &&
      !hostCharge.offPlatformReceiptUrl ?
        <OutboundChargePaymentStatus
          charges={bundledKinds
            .map((kind) => chargeViewForKind(row.charges, kind))
            .filter((charge): charge is NonNullable<typeof charge> =>
              Boolean(charge),
            )}
          audience="admin"
          customerName={row.customerName}
          customerEmail={row.customerEmail}
        />
      : null}
      {anyPaid && hostCharge && !pendingReview ?
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-foreground">
          Paid{" "}
          {new Date(hostCharge.paidAt!).toLocaleDateString(undefined, {
            dateStyle: "medium",
          })}
          . This combined quote is locked.
        </p>
      : hostCharge && !pendingReview ?
        <p className="text-xs text-muted-foreground">
          Published {formatUsd(hostCharge.totalCents + extraTotalCents)} —
          editing updates the customer cart item.
        </p>
      : null}

      <PartnerRecordsEditor
        row={row}
        chargeKind={host}
        formDisabled={anyPaid}
        selectedCompanyKey={selectedCompanyKey}
        onSelectCompany={onSelectCompany}
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
              <ChargeLabelWithCompanyPricing
                htmlFor={`${row.barrelId}-bundle-transport-amount`}
                label="Pickup fee"
                showRateCardToggle={false}
                dialogVariant="hub-transport"
                companyName={primaryPartnerNameForKind(
                  row.partners,
                  row.barrelId,
                  host,
                )}
                tableKinds={["transport"]}
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
                value={billedTransportUsd}
                disabled={amountsLocked || hubTransport.quotedCents != null}
                placeholder="0.00"
                onChange={(e) => setTransportAmountUsd(e.target.value)}
              />
              {hubTransport.quotedCents != null ?
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {hubTransport.containerCount >= 2
                    ? `${hubTransport.containerCount} linked barrels × extra-container fee`
                    : "1-container pickup fee"}
                </p>
              : null}
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

      <CompanyServiceNoteField
        row={row}
        chargeKind={host}
        adminNote={adminNote}
        setAdminNote={setAdminNote}
        noteLocked={anyPaid || pendingReview}
      />

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
  const [selectedCompanyKey, setSelectedCompanyKey] = useState<string | null>(
    null,
  );
  const selectedKinds = useMemo(() => {
    if (!selectedCompanyKey) return [] as BarrelOutboundShippingChargeKind[];
    const partner = row.partners.find(
      (item) => outboundShippingCompanyKey(item.name) === selectedCompanyKey,
    );
    return partner ? kindsForCompanyName(row.partners, partner.name) : [];
  }, [selectedCompanyKey, row.partners]);
  const groups = useMemo(() => {
    const bundle = selectedKinds.length >= 2 ? selectedKinds : [];
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
  }, [kinds, selectedKinds]);
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

  function selectCompany(
    record: AdminBarrelOutboundShippingChargeRow["partners"][number],
  ) {
    const key = outboundShippingCompanyKey(record.name);
    setSelectedCompanyKey(key);
    const companyKinds = kindsForCompanyName(row.partners, record.name);
    const nextKinds =
      companyKinds.length > 0 ? companyKinds : [record.chargeKind];
    const bundle = nextKinds.length >= 2 ? nextKinds : [];
    setTab(tabIdForCompanyKinds(nextKinds, bundle));
  }

  return (
    <div className="space-y-3">
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
          const groupPaid = group.kinds.some((kind) => {
            const published = chargeViewForKind(row.charges, kind);
            return Boolean(published?.paidAt);
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
              {groupPaid ?
                <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  Paid
                </span>
              : pendingReview ?
                <span className="ml-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                  Submitted
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
            selectedCompanyKey={selectedCompanyKey}
            onSelectCompany={selectCompany}
          />
        : (
          <AdminChargeKindForm
            key={`${row.barrelId}-${activeGroup.kinds[0]}-${chargeViewForKind(row.charges, activeGroup.kinds[0]!)?.chargeId ?? "new"}`}
            row={row}
            chargeKind={activeGroup.kinds[0]!}
            publishEnabled={publishEnabled}
            lockMessage={lockMessage}
            selectedCompanyKey={selectedCompanyKey}
            onSelectCompany={selectCompany}
          />
        )
      : null}
    </div>
  );
}
