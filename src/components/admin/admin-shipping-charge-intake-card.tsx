"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, useMemo, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { saveBarrelOutboundShippingChargeAction } from "@/actions/admin-barrel-outbound-shipping-charge";
import { AdminShipmentCustomsPanel } from "@/components/admin/admin-shipment-customs-panel";
import { AdminUpdatedByCell } from "@/components/admin/admin-staff-record-label";
import type { AdminStaffProfilesByClerkUserId } from "@/lib/admin-staff-profiles";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AdminBarrelOutboundShippingChargeRow } from "@/lib/barrel-outbound-shipping-charge";
import {
  ADMIN_OUTBOUND_SHIPPING_CHARGE_LABELS,
  DEFAULT_ADMIN_OUTBOUND_SHIPPING_CUSTOMER_NOTE,
} from "@/lib/outbound-shipping-expected-charges";
import { formatUsd } from "@/lib/admin-markup";
import {
  barrelShippingDeliveryMethodLabel,
  containerFullnessLabel,
} from "@/lib/barrel-shipping-intake";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";

type ChargeLineForm = {
  label: string;
  amountUsd: string;
};

function centsToUsdInput(cents: number): string {
  return cents > 0 ? (cents / 100).toFixed(2) : "";
}

function buildInitialLines(row: AdminBarrelOutboundShippingChargeRow): ChargeLineForm[] {
  if (row.lines.length > 0) {
    return row.lines.map((l) => ({
      label: l.label,
      amountUsd: centsToUsdInput(l.amountCents),
    }));
  }
  return ADMIN_OUTBOUND_SHIPPING_CHARGE_LABELS.map((label) => ({
    label,
    amountUsd: "",
  }));
}

type AdminShippingChargeIntakeCardProps = {
  row: AdminBarrelOutboundShippingChargeRow;
  /** When false, form is visible but publish is disabled (preview or awaiting customer). */
  publishEnabled?: boolean;
  lockMessage?: string;
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
};

export function AdminShippingChargeIntakeCard({
  row,
  publishEnabled = true,
  lockMessage,
  staffProfilesByClerkUserId = {},
}: AdminShippingChargeIntakeCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [customsOpen, setCustomsOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<ChargeLineForm[]>(() => buildInitialLines(row));
  const [adminNote, setAdminNote] = useState(
    row.adminNote ?? DEFAULT_ADMIN_OUTBOUND_SHIPPING_CUSTOMER_NOTE,
  );
  const [error, setError] = useState<string | null>(null);

  const previewTotalCents = useMemo(() => {
    return lines.reduce((sum, line) => {
      const t = line.amountUsd.trim().replace(/^\$/, "").replace(/,/g, "");
      const n = Number.parseFloat(t);
      if (!Number.isFinite(n) || n <= 0) return sum;
      return sum + Math.round(n * 100);
    }, 0);
  }, [lines]);

  const isPaid = row.paidAt != null;
  const formDisabled = isPaid || pending || !publishEnabled;
  const displayTotalCents =
    editing && previewTotalCents > 0 ? previewTotalCents : row.totalCents;

  const statusDetail =
    !row.readyForShipping ?
      containerFullnessLabel(row)
    : row.intakeId.startsWith("awaiting-") ?
      "Awaiting customer confirmation"
    : `Confirmed ${new Date(row.submittedAt).toLocaleDateString(undefined, {
        dateStyle: "medium",
      })}`;

  function updateLine(index: number, patch: Partial<ChargeLineForm>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, { label: "", amountUsd: "" }]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveBarrelOutboundShippingChargeAction({
        barrelId: row.barrelId,
        adminNote,
        lines: lines.filter((l) => l.label.trim() || l.amountUsd.trim()),
      });
      if (!res.ok) {
        setError(res.message);
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <Card className="overflow-hidden border-border/80 bg-card shadow-sm">
      <CardContent className="p-3">
        <article className="flex items-center gap-3">
          <ProductRequestThumbnail
            variant="list"
            imageUrl={row.containerImageUrl}
            productLabel={row.containerName}
            className="rounded-md ring-1 ring-border/40"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {row.containerName}
            </h3>
            {isPaid ?
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Paid freight
                {row.paymentReferenceNumber ?
                  <span className="font-mono text-muted-foreground">
                    {" "}
                    · {row.paymentReferenceNumber}
                  </span>
                : null}
              </p>
            : displayTotalCents > 0 ?
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatUsd(displayTotalCents)}
                {row.chargeId ? " · Published" : null}
              </p>
            : (
              <p className="text-xs text-muted-foreground">{statusDetail}</p>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">
              Updated by{" "}
              <AdminUpdatedByCell
                clerkUserId={row.updatedByClerkUserId}
                profilesByClerkUserId={staffProfilesByClerkUserId}
                primaryClassName="inline text-[10px] font-medium"
                secondaryClassName="inline text-[9px] text-muted-foreground"
              />
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
            {isPaid ?
              <Button
                type="button"
                variant={customsOpen ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  setCustomsOpen((open) => !open);
                  setEditing(false);
                }}
              >
                {customsOpen ? "Close" : "Customs clearance"}
              </Button>
            : null}
            <Button
              type="button"
              variant={editing ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setEditing((open) => !open);
                setCustomsOpen(false);
              }}
            >
              <Pencil className="size-3.5" aria-hidden />
              {editing ? "Close" : "Edit"}
            </Button>
          </div>
        </article>

        {customsOpen ?
          <div className="mt-3 border-t border-border/60 pt-3">
            <AdminShipmentCustomsPanel
              row={row}
              onClose={() => setCustomsOpen(false)}
            />
          </div>
        : null}

        {editing ?
          <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Customer</dt>
                <dd className="font-medium text-foreground">
                  {row.customerName ?? "—"}
                  {row.customerEmail ?
                    <span className="mt-0.5 block font-normal text-muted-foreground">
                      {row.customerEmail}
                    </span>
                  : null}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Container</dt>
                <dd className="text-foreground">
                  {row.alias} · {containerOfferingKindLabel(row.kind)}
                  <span className="mt-0.5 block text-muted-foreground">
                    {row.slotLabel}
                  </span>
                </dd>
              </div>
              {!row.intakeId.startsWith("awaiting-") ?
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Shipping preference</dt>
                  <dd className="text-foreground">
                    {barrelShippingDeliveryMethodLabel(row.deliveryMethod)}
                  </dd>
                </div>
              : (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="text-foreground">{statusDetail}</dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Updated by</dt>
                <dd>
                  <AdminUpdatedByCell
                    clerkUserId={row.updatedByClerkUserId}
                    profilesByClerkUserId={staffProfilesByClerkUserId}
                  />
                </dd>
              </div>
            </dl>

            {lockMessage ?
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-foreground">
                {lockMessage}
              </p>
            : null}
            {isPaid ?
              <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-foreground">
                Paid{" "}
                {new Date(row.paidAt!).toLocaleDateString(undefined, {
                  dateStyle: "medium",
                })}
                . Charges are locked.
              </p>
            : null}

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">
                Freight, customs &amp; pickup charges
              </p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Shown on the customer Pricing tab after you publish.
              </p>
              <ul className="space-y-2">
                {lines.map((line, index) => (
                  <li
                    key={`${index}-${line.label}`}
                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]"
                  >
                    <div className="space-y-1">
                      <Label
                        className="sr-only"
                        htmlFor={`label-${row.barrelId}-${index}`}
                      >
                        Cost label
                      </Label>
                      <Input
                        id={`label-${row.barrelId}-${index}`}
                        value={line.label}
                        disabled={formDisabled}
                        placeholder="e.g. Courier freight"
                        onChange={(e) => updateLine(index, { label: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label
                        className="sr-only"
                        htmlFor={`amt-${row.barrelId}-${index}`}
                      >
                        Amount USD
                      </Label>
                      <Input
                        id={`amt-${row.barrelId}-${index}`}
                        inputMode="decimal"
                        placeholder="0.00"
                        value={line.amountUsd}
                        disabled={formDisabled}
                        onChange={(e) =>
                          updateLine(index, { amountUsd: e.target.value })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-end text-muted-foreground"
                      disabled={formDisabled || lines.length <= 1}
                      onClick={() => removeLine(index)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              {!isPaid ?
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={formDisabled}
                  onClick={addLine}
                >
                  Add cost line
                </Button>
              : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`note-${row.barrelId}`}>Note to customer (optional)</Label>
              <textarea
                id={`note-${row.barrelId}`}
                rows={2}
                value={adminNote}
                disabled={formDisabled}
                placeholder="e.g. Based on courier quote #1234 — pay before we release to DHL."
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  setAdminNote(e.target.value)
                }
                className={cn(
                  "flex min-h-[4rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              />
            </div>

            {previewTotalCents > 0 ?
              <p className="text-sm font-medium text-foreground">
                Customer total: {formatUsd(previewTotalCents)}
              </p>
            : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {!isPaid && publishEnabled ?
              <Button type="button" size="sm" disabled={pending} onClick={save}>
                {pending ? "Saving…" : row.chargeId ? "Update charge" : "Publish charge"}
              </Button>
            : null}
          </div>
        : null}
      </CardContent>
    </Card>
  );
}
