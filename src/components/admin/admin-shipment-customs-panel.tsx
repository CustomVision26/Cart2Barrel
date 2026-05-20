"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  adminSaveBarrelShipmentCustomsAction,
  adminUpdateBarrelShipmentStageAction,
} from "@/actions/admin-barrel-shipment-tracking";
import { adminUploadCustomsDeclarationFormAction } from "@/actions/admin-upload-customs-declaration-form";
import { BarrelShipmentTrackingTimeline } from "@/components/shipping/barrel-shipment-tracking-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BARREL_OUTBOUND_SHIPMENT_STAGES,
  BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS,
  type BarrelOutboundShipmentStage,
} from "@/lib/barrel-shipment-tracking";
import type { AdminBarrelOutboundShippingChargeRow } from "@/lib/barrel-outbound-shipping-charge";

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

type AdminShipmentCustomsPanelProps = {
  row: AdminBarrelOutboundShippingChargeRow;
  onClose: () => void;
};

export function AdminShipmentCustomsPanel({
  row,
  onClose,
}: AdminShipmentCustomsPanelProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const tracking = row.shipmentTracking;

  const [freightCompanyName, setFreightCompanyName] = useState(
    tracking?.freightCompanyName ?? "",
  );
  const [freightDropOffAt, setFreightDropOffAt] = useState(
    toDateInputValue(tracking?.freightDropOffAt ?? null),
  );
  const [estimatedArrivalAt, setEstimatedArrivalAt] = useState(
    toDateInputValue(tracking?.estimatedArrivalAt ?? null),
  );
  const [formImageUrl, setFormImageUrl] = useState(
    tracking?.customsDeclarationFormUrl ?? "",
  );
  const [stage, setStage] = useState<BarrelOutboundShipmentStage>(
    tracking?.trackingStage ?? "awaiting_customs_clearance",
  );

  function saveCustoms() {
    if (!freightCompanyName.trim() || !freightDropOffAt || !estimatedArrivalAt) {
      toast.error("Freight name and both dates are required.");
      return;
    }
    startTransition(async () => {
      const res = await adminSaveBarrelShipmentCustomsAction({
        barrelId: row.barrelId,
        freightCompanyName,
        freightDropOffAt,
        estimatedArrivalAt,
        customsDeclarationFormUrl: formImageUrl.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function publishStage() {
    startTransition(async () => {
      const res = await adminUpdateBarrelShipmentStageAction({
        barrelId: row.barrelId,
        trackingStage: stage,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function uploadForm() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a customs form image first.");
      return;
    }
    const fd = new FormData();
    fd.set("barrelId", row.barrelId);
    fd.set("file", file);
    startTransition(async () => {
      const res = await adminUploadCustomsDeclarationFormAction(fd);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setFormImageUrl(res.imageUrl);
      toast.success("Customs form uploaded.");
      router.refresh();
    });
  }

  if (!row.paidAt) {
    return (
      <p className="text-xs text-muted-foreground">
        Freight must be paid before customs clearance and tracking apply.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Customs &amp; tracking</p>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-foreground">
        Paid freight
        {row.paymentReferenceNumber ?
          <> · ref <span className="font-mono">{row.paymentReferenceNumber}</span></>
        : null}
      </p>

      <BarrelShipmentTrackingTimeline
        tracking={tracking}
        paidAt={row.paidAt}
        paymentReferenceNumber={row.paymentReferenceNumber}
        compact
      />

      <div className="space-y-3 rounded-md border border-border/60 p-3">
        <p className="text-xs font-medium text-foreground">Customs clearance info</p>

        <div className="space-y-1.5">
          <Label htmlFor={`customs-form-${row.barrelId}`}>Clearance form image</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              ref={fileRef}
              id={`customs-form-${row.barrelId}`}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={pending}
              className="max-w-xs text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={uploadForm}
            >
              Upload
            </Button>
          </div>
          {formImageUrl ?
            <a
              href={formImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              View uploaded form
            </a>
          : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`freight-name-${row.barrelId}`}>Freight name</Label>
          <Input
            id={`freight-name-${row.barrelId}`}
            value={freightCompanyName}
            disabled={pending}
            onChange={(e) => setFreightCompanyName(e.target.value)}
            placeholder="e.g. DHL Freight"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`dropoff-${row.barrelId}`}>Drop-off to freight</Label>
            <Input
              id={`dropoff-${row.barrelId}`}
              type="date"
              value={freightDropOffAt}
              disabled={pending}
              onChange={(e) => setFreightDropOffAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`eta-${row.barrelId}`}>Estimated arrival</Label>
            <Input
              id={`eta-${row.barrelId}`}
              type="date"
              value={estimatedArrivalAt}
              disabled={pending}
              onChange={(e) => setEstimatedArrivalAt(e.target.value)}
            />
          </div>
        </div>

        <Button type="button" size="sm" disabled={pending} onClick={saveCustoms}>
          Save customs info
        </Button>
      </div>

      <div className="space-y-2 rounded-md border border-border/60 p-3">
        <p className="text-xs font-medium text-foreground">Publish tracking stage</p>
        <select
          value={stage}
          disabled={pending}
          onChange={(e) => setStage(e.target.value as BarrelOutboundShipmentStage)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {BARREL_OUTBOUND_SHIPMENT_STAGES.map((s) => (
            <option key={s} value={s}>
              {BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={publishStage}>
          Update stage
        </Button>
      </div>
    </div>
  );
}
