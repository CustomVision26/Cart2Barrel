"use client";

import { ExternalLink, Eye, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveWarehouseReceiptSnapshotsAction } from "@/actions/save-warehouse-receipt-snapshots";
import { AdminRefundRequestControls } from "@/components/admin/admin-refund-request-controls";
import {
  CONDITION_OPTIONS,
  type WarehouseReceiveCondition,
  receivingConditionSelectClassName,
  ReceivingRowActions,
} from "@/components/admin/receiving-row-actions";
import type { WarehouseReceivingLine } from "@/lib/admin-warehouse-receiving-types";
import { WarehouseBarcodeImageField } from "@/components/orders/warehouse-barcode-image-field";
import { WarehouseProofPhotosField } from "@/components/orders/warehouse-proof-photos-field";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { AdminUpdatedByCell } from "@/components/admin/admin-staff-record-label";
import type { AdminStaffProfilesByClerkUserId } from "@/lib/admin-staff-profiles";
import { resolveOrderLineUpdatedByClerkUserId } from "@/lib/admin-staff-profiles";
import { formatUsd } from "@/lib/admin-markup";
import { adminOrderLineStatusLabel } from "@/lib/order-fulfillment-labels";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { orderItemFulfillmentBadgeKind } from "@/lib/status-badge-map";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";

export type PackageIntakeRowState = {
  receivedQty: number;
  condition: WarehouseReceiveCondition;
  shelfLocation: string;
  proofFileCount: number;
  proofPhotoUrls: string[];
  barcodeValue: string;
};

function isReceiveCondition(
  v: string | null | undefined,
): v is WarehouseReceiveCondition {
  return (
    v === "good" ||
    v === "damaged" ||
    v === "missing" ||
    v === "wrong_item"
  );
}

export function packageIntakeRowStateFromLine(
  line: WarehouseReceivingLine,
): PackageIntakeRowState {
  const oi = line.orderItem;
  if (oi.warehouseReceivedAt) {
    const cond = isReceiveCondition(oi.warehouseReceivedCondition) ?
      oi.warehouseReceivedCondition
    : "good";
    const proofPhotoUrls = [...(oi.warehouseReceivedProofPhotoUrls ?? [])];
    return {
      receivedQty: oi.warehouseReceivedQty ?? line.orderedQty,
      condition: cond,
      shelfLocation: oi.warehouseShelfLocation ?? "",
      proofPhotoUrls,
      proofFileCount:
        proofPhotoUrls.length > 0 ?
          proofPhotoUrls.length
        : (oi.warehouseReceivedProofPhotoCount ?? 0),
      barcodeValue: oi.warehouseReceivedBarcode ?? "",
    };
  }
  return {
    receivedQty: line.orderedQty,
    condition: "good",
    shelfLocation: "",
    proofPhotoUrls: [],
    proofFileCount: 0,
    barcodeValue: "",
  };
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function batchLabel(line: WarehouseReceivingLine): string {
  const bn = line.batchNumber?.trim();
  if (bn) return bn;
  const sid = line.batchSessionId?.trim();
  if (sid) return `Session ${shortId(sid)}`;
  return "Single";
}

type IntakePreviewImage = { url: string; label: string };

function collectIntakePreviewImages(
  line: WarehouseReceivingLine,
): IntakePreviewImage[] {
  const out: IntakePreviewImage[] = [];
  const seen = new Set<string>();
  const add = (url: string | null | undefined, label: string) => {
    const u = url?.trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ url: u, label });
  };
  add(line.productImageUrl, "Product");
  add(line.intakeSnapshotProductImageUrl, "Product at intake");
  add(line.warehouseBarcodeImageUrl, "Barcode scan");
  for (const url of line.companyPurchaseReceiptImageUrls ?? []) {
    add(url, "Purchase receipt");
  }
  for (const url of line.orderItem.warehouseReceivedProofPhotoUrls ?? []) {
    add(url, "Proof photo");
  }
  return out;
}

function collectIntakePreviewImagesFromRow(
  line: WarehouseReceivingLine,
  row: PackageIntakeRowState,
): IntakePreviewImage[] {
  const base = collectIntakePreviewImages(line);
  const seen = new Set(base.map((i) => i.url));
  for (const url of row.proofPhotoUrls) {
    const u = url.trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    base.push({ url: u, label: "Proof photo" });
  }
  return base;
}

function PreviewField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-lg border border-border/80 bg-muted/40 p-3 ${className ?? ""}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 text-sm font-medium leading-snug text-foreground">
        {children}
      </div>
    </div>
  );
}

function PreviewProductUrl({
  url,
  label = "Open product page",
}: {
  url: string | null;
  label?: string;
}) {
  const href = url?.trim();
  if (!href) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
    >
      {label}
      <ExternalLink aria-hidden />
    </a>
  );
}

function IntakePreviewBody({
  line,
  row,
  staffProfilesByClerkUserId = {},
}: {
  line: WarehouseReceivingLine;
  row: PackageIntakeRowState;
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
}) {
  const images = collectIntakePreviewImagesFromRow(line, row);
  const intakeQty =
    line.intakeSnapshotQuantity != null ?
      line.intakeSnapshotQuantity
    : row.receivedQty;
  const intakeSize = line.intakeSnapshotSize?.trim() || null;
  const intakeColor = line.intakeSnapshotColor?.trim() || null;
  const intakeUrl = line.intakeSnapshotProductUrl?.trim() || null;
  const productUrl = line.productUrl?.trim() || null;

  return (
    <div className="space-y-5 text-sm">
      <section className="space-y-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
          Product
        </h3>
        <dl className="grid grid-cols-2 gap-2">
          <PreviewField label="Quantity">{line.orderedQty}</PreviewField>
          {line.productSize ?
            <PreviewField label="Size">{line.productSize}</PreviewField>
          : null}
          {line.productColor ?
            <PreviewField label="Color">{line.productColor}</PreviewField>
          : null}
          <PreviewField label="Product link" className="col-span-2">
            <PreviewProductUrl url={productUrl} />
          </PreviewField>
        </dl>
      </section>

      <section className="space-y-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
          Intake recorded
        </h3>
        <dl className="grid grid-cols-2 gap-2">
          <PreviewField label="Received qty">
            <span className="tabular-nums">
              {row.receivedQty} / {line.orderedQty}
            </span>
          </PreviewField>
          <PreviewField label="Condition">
            {warehouseReceiveConditionLabel(row.condition)}
          </PreviewField>
          {intakeQty !== row.receivedQty ?
            <PreviewField label="Snapshot qty">{intakeQty}</PreviewField>
          : null}
          {intakeSize ?
            <PreviewField label="Size (at intake)">{intakeSize}</PreviewField>
          : null}
          {intakeColor ?
            <PreviewField label="Color (at intake)">{intakeColor}</PreviewField>
          : null}
          {intakeUrl && intakeUrl !== productUrl ?
            <PreviewField label="Product link (at intake)" className="col-span-2">
              <PreviewProductUrl url={intakeUrl} label="Open intake product page" />
            </PreviewField>
          : null}
          <PreviewField label="Shelf / bin" className="col-span-2">
            {row.shelfLocation.trim() || "Not assigned"}
          </PreviewField>
          <PreviewField label="Barcode" className="col-span-2">
            <span className="break-all font-mono text-xs">
              {row.barcodeValue.trim() || "—"}
            </span>
          </PreviewField>
          <PreviewField label="Updated by" className="col-span-2">
            <AdminUpdatedByCell
              clerkUserId={resolveOrderLineUpdatedByClerkUserId(line.orderItem)}
              profilesByClerkUserId={staffProfilesByClerkUserId}
            />
          </PreviewField>
        </dl>
      </section>

      <section className="space-y-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
          Intake images
        </h3>
        {images.length > 0 ?
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {images.map((img) => (
              <li key={img.url} className="space-y-1.5">
                <a
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[8rem] items-center justify-center overflow-hidden rounded-lg border border-border/80 bg-muted/50 p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- external retailer CDN URLs */}
                  <img
                    src={img.url}
                    alt={img.label}
                    className="max-h-44 w-full object-contain"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </a>
                <p className="text-center text-xs text-muted-foreground">{img.label}</p>
              </li>
            ))}
          </ul>
        : <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            No images on file for this intake.
          </p>
        }
      </section>

      {line.orderItem.warehouseReceivedAt ?
        <p className="text-xs text-muted-foreground">
          Last saved receipt:{" "}
          {new Date(line.orderItem.warehouseReceivedAt).toLocaleString()}
        </p>
      : null}
    </div>
  );
}

function IntakeEditForm({
  line,
  row,
  pending,
  onChange,
}: {
  line: WarehouseReceivingLine;
  row: PackageIntakeRowState;
  pending: boolean;
  onChange: (patch: Partial<PackageIntakeRowState>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <Label htmlFor={`pkg-qty-${line.id}`}>Received qty</Label>
          <Input
            id={`pkg-qty-${line.id}`}
            type="number"
            min={0}
            value={row.receivedQty}
            disabled={pending}
            onChange={(e) =>
              onChange({
                receivedQty: Math.max(0, Number.parseInt(e.target.value, 10) || 0),
              })
            }
            className="tabular-nums"
          />
        </label>
        <label className="space-y-1.5">
          <Label htmlFor={`pkg-cond-${line.id}`}>Package condition</Label>
          <select
            id={`pkg-cond-${line.id}`}
            className={receivingConditionSelectClassName}
            value={row.condition}
            disabled={pending}
            onChange={(e) =>
              onChange({ condition: e.target.value as WarehouseReceiveCondition })
            }
          >
            {CONDITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1.5">
        <Label htmlFor={`pkg-shelf-${line.id}`}>Shelf location</Label>
        <Input
          id={`pkg-shelf-${line.id}`}
          value={row.shelfLocation}
          disabled={pending}
          placeholder="e.g. A-12-03 / BIN-4421"
          onChange={(e) => onChange({ shelfLocation: e.target.value })}
        />
      </label>
      <ReceivingRowActions
        lineLabel={line.itemLabel}
        shelfLocation={row.shelfLocation}
        proofFileCount={row.proofFileCount}
        showProofPhotos={false}
        onShelfAssigned={(shelf) => onChange({ shelfLocation: shelf })}
        onProofFilesAdded={() => {}}
        onBarcodeApplied={(value) => onChange({ barcodeValue: value })}
      />
      <WarehouseProofPhotosField
        orderItemId={line.id}
        imageUrls={row.proofPhotoUrls}
        disabled={pending}
        onUrlsChange={(urls) =>
          onChange({ proofPhotoUrls: urls, proofFileCount: urls.length })
        }
      />
      <WarehouseBarcodeImageField
        orderItemId={line.id}
        imageUrl={line.orderItem.warehouseReceivedBarcodeImageUrl}
        disabled={pending}
      />
      {line.pendingRefundRequest ?
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <AdminRefundRequestControls
            refundRequest={line.pendingRefundRequest}
            linePriceCents={line.orderItem.price}
            refundedCents={line.refundedCents}
            productLabel={line.productName}
            productNumber={line.id}
            orderNumber={line.orderNumber}
            batchNumber={line.batchNumber}
            batchSessionId={line.batchSessionId}
          />
        </div>
      : null}
    </div>
  );
}

export function AdminPackageFileCard({
  line,
  row,
  onUpdate,
  staffProfilesByClerkUserId = {},
}: {
  line: WarehouseReceivingLine;
  row: PackageIntakeRowState;
  onUpdate: (patch: Partial<PackageIntakeRowState>) => void;
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
}) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState(row);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savePending, startSave] = useTransition();

  const orderSlice = { status: line.orderStatus };
  const fulfillment = effectiveOrderItemFulfillmentStatus(line.orderItem, orderSlice);
  const pendingRefund = line.pendingRefundRequest != null;
  const statusLabel = adminOrderLineStatusLabel(fulfillment, {
    pendingRefundRequest: pendingRefund,
    warehouseReceivedCondition: line.orderItem.warehouseReceivedCondition,
  });

  const openEdit = () => {
    setEditDraft(row);
    setSaveError(null);
    setEditOpen(true);
  };

  return (
    <article className="group flex gap-2.5 overflow-hidden rounded-lg border border-border/80 bg-card/90 p-2 shadow-sm transition-[border-color,box-shadow,background-color] hover:border-border hover:bg-card hover:shadow-md">
      <div className="relative shrink-0 self-start">
        <ProductRequestThumbnail
          variant="list"
          imageUrl={line.productImageUrl}
          productLabel={line.productName}
        />
        {line.orderedQty > 1 ?
          <span
            className="absolute -bottom-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 py-px text-[9px] font-semibold leading-none text-primary-foreground shadow-sm"
            title={`Ordered quantity ${line.orderedQty}`}
          >
            {line.orderedQty}
          </span>
        : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge
            kind={orderItemFulfillmentBadgeKind(line.orderItem, orderSlice, {
              pendingRefundRequest: pendingRefund,
            })}
            title={statusLabel}
            className="whitespace-normal text-[10px] leading-snug"
          >
            {statusLabel}
          </StatusBadge>
        </div>
        <h3
          className="line-clamp-2 text-xs font-semibold leading-snug text-foreground"
          title={line.productName}
        >
          {line.productName}
        </h3>
        <p className="text-[10px] text-muted-foreground">
          {batchLabel(line)} · {formatUsd(line.orderItem.price)}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
          Order {shortId(line.orderNumber)}
        </p>
        <div className="text-[10px]">
          <span className="text-muted-foreground">Updated by </span>
          <AdminUpdatedByCell
            clerkUserId={resolveOrderLineUpdatedByClerkUserId(line.orderItem)}
            profilesByClerkUserId={staffProfilesByClerkUserId}
            primaryClassName="inline text-[10px] font-medium"
            secondaryClassName="text-[9px] text-muted-foreground"
          />
        </div>

        <div className="mt-0.5 flex flex-wrap gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 flex-1 gap-1 text-xs"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="size-3 shrink-0" aria-hidden />
            Preview intake
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 flex-1 gap-1 text-xs"
            onClick={openEdit}
          >
            <Pencil className="size-3 shrink-0" aria-hidden />
            Edit intake
          </Button>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[min(92vh,800px)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Preview intake</DialogTitle>
            <DialogDescription>{line.productName}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 rounded-lg border border-border/80 bg-muted/30 p-3">
            <ProductRequestThumbnail
              variant="dialog"
              imageUrl={line.productImageUrl}
              productLabel={line.productName}
            />
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="font-medium text-foreground">{line.customerDisplayLabel}</p>
              <p className="font-mono text-xs text-muted-foreground">
                Line {shortId(line.id)}
              </p>
              {line.productColor ?
                <p className="text-xs text-muted-foreground">
                  Color: <span className="text-foreground">{line.productColor}</span>
                </p>
              : null}
            </div>
          </div>
          <IntakePreviewBody
            line={line}
            row={row}
            staffProfilesByClerkUserId={staffProfilesByClerkUserId}
          />
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit intake</DialogTitle>
            <DialogDescription className="line-clamp-2">{line.productName}</DialogDescription>
          </DialogHeader>
          <IntakeEditForm
            line={line}
            row={editDraft}
            pending={savePending}
            onChange={(patch) => setEditDraft((prev) => ({ ...prev, ...patch }))}
          />
          {saveError ?
            <p className="text-sm text-destructive" role="alert">
              {saveError}
            </p>
          : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={savePending}
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={savePending}
              onClick={() => {
                setSaveError(null);
                startSave(async () => {
                  const res = await saveWarehouseReceiptSnapshotsAction({
                    lines: [
                      {
                        orderItemId: line.id,
                        receivedQty: editDraft.receivedQty,
                        condition: editDraft.condition,
                        shelfLocation: editDraft.shelfLocation,
                        proofPhotoCount: editDraft.proofPhotoUrls.length,
                        proofPhotoUrls: editDraft.proofPhotoUrls,
                        barcodeValue:
                          editDraft.barcodeValue.trim() === "" ?
                            undefined
                          : editDraft.barcodeValue.trim(),
                      },
                    ],
                  });
                  if (!res.ok) {
                    setSaveError(res.message);
                    toast.error(res.message);
                    return;
                  }
                  onUpdate(editDraft);
                  toast.success(res.message);
                  setEditOpen(false);
                  router.refresh();
                });
              }}
            >
              {savePending ? "Saving…" : "Save intake"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
