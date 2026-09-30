"use client";

import { useEffect, useState } from "react";

import { BarrelContentsPreviewDialog } from "@/components/shipping/barrel-contents-preview-dialog";
import { CustomsClearanceDocumentsPanel } from "@/components/shipping/customs-clearance-documents-panel";
import { OutboundChargePaymentStatus } from "@/components/shipping/outbound-charge-payment-status";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { formatUsd } from "@/lib/admin-markup";
import type {
  ShippingHistoryAudience,
  ShippingHistoryRow,
} from "@/lib/barrel-shipping-history";
import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS,
  outboundPartnerContactLines,
  paidOutboundCharges,
  type BarrelOutboundShippingChargeView,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS,
  hasCustomsClearanceInfo,
} from "@/lib/barrel-shipment-tracking";
import {
  barrelShippingDeliveryMethodLabel,
} from "@/lib/barrel-shipping-intake";
import {
  findDestinationBroker,
  findDestinationCourier,
  OWN_TRANSPORT_COURIER_KEY,
} from "@/lib/destination-clearance-partners";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";
import { cn } from "@/lib/utils";

function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function historyStageLabel(row: ShippingHistoryRow): string {
  if (row.shipmentTracking) {
    return BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS[row.shipmentTracking.trackingStage];
  }
  if (row.status === "delivered") return "Delivered";
  if (row.status === "shipped") return "Shipped";
  return "Recorded";
}

function historyPartnerSummaries(row: ShippingHistoryRow) {
  const paid = paidOutboundCharges(row.outboundCharges);
  const freight = paid.find((charge) => charge.chargeKind === "freight") ?? null;
  const broker = paid.find((charge) => charge.chargeKind === "broker") ?? null;
  const courier = paid.find((charge) => charge.chargeKind === "courier") ?? null;
  const catalogBroker = findDestinationBroker(
    row.selectedBrokerKey,
    row.destinationCountry,
  );
  const catalogCourier = findDestinationCourier(
    row.selectedCourierKey,
    row.destinationCountry,
  );
  const ownTransport = row.selectedCourierKey === OWN_TRANSPORT_COURIER_KEY;
  return {
    freight,
    broker,
    courier,
    catalogBroker,
    catalogCourier,
    ownTransport,
    freightName: freight?.partnerName?.trim() || null,
    brokerName:
      broker?.partnerName?.trim() ||
      catalogBroker?.name ||
      (row.deliveryMethod === "customs_pickup"
        ? "Customer cleared customs"
        : null),
    courierName:
      courier?.partnerName?.trim() ||
      (ownTransport ? "Own transportation" : catalogCourier?.name) ||
      null,
  };
}

function PartnerBlock({
  title,
  charge,
  fallbackName,
  fallbackDetail,
  audience,
}: {
  title: string;
  charge: BarrelOutboundShippingChargeView | null;
  fallbackName?: string | null;
  fallbackDetail?: string | null;
  audience: ShippingHistoryAudience;
}) {
  const lines = charge ? outboundPartnerContactLines(charge) : [];
  const name = charge?.partnerName?.trim() || fallbackName?.trim() || null;
  if (!charge && !name && !fallbackDetail) return null;

  return (
    <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </p>
      {name ?
        <p className="mt-1 text-sm font-medium text-foreground">{name}</p>
      : charge ?
        <p className="mt-1 text-sm font-medium text-foreground">
          {BARREL_OUTBOUND_SHIPPING_CHARGE_KIND_LABELS[charge.chargeKind]}
        </p>
      : null}
      {lines.length > 1 ?
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {lines.slice(1).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      : fallbackDetail ?
        <p className="mt-1 text-xs text-muted-foreground">{fallbackDetail}</p>
      : null}
      {charge ?
        <p className="mt-1.5 text-sm font-semibold tabular-nums text-foreground">
          {formatUsd(charge.totalCents)}
          {charge.paidAt ?
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              paid {formatHistoryDate(charge.paidAt)}
            </span>
          : null}
        </p>
      : null}
      {charge ?
        <div className="mt-2">
          <OutboundChargePaymentStatus
            charges={[charge]}
            audience={audience}
            showCustomer={audience === "admin"}
          />
        </div>
      : null}
    </div>
  );
}

function ShippingHistoryCard({
  row,
  audience,
}: {
  row: ShippingHistoryRow;
  audience: ShippingHistoryAudience;
}) {
  const {
    freight,
    broker,
    courier,
    catalogBroker,
    catalogCourier,
    ownTransport,
  } = historyPartnerSummaries(row);
  const tracking = row.shipmentTracking;
  const customsFormUrl = tracking?.customsDeclarationFormUrl?.trim() || null;
  const packPublished = hasCustomsClearanceInfo({
    customsDeclarationFormUrl: customsFormUrl,
    freightCompanyName: tracking?.freightCompanyName ?? null,
  });
  const customerLabel =
    [row.customerName, row.customerEmail].filter(Boolean).join(" · ") || null;

  return (
    <Card className="overflow-hidden border-border/80 bg-card shadow-sm">
      <CardContent className="space-y-4 p-3">
        <article className="flex gap-3">
          <ProductRequestThumbnail
            variant="list"
            imageUrl={row.containerImageUrl}
            productLabel={row.containerName}
            className="aspect-square self-start rounded-md ring-1 ring-border/40"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {row.containerName}
              </h2>
              <BarrelContentsPreviewDialog
                barrelId={row.barrelId}
                containerLabel={row.containerName}
                containerAlias={row.alias}
                items={row.contents}
                contentsApiPath={
                  audience === "admin"
                    ? "/api/admin/barrel-contents"
                    : "/api/dashboard/barrel-contents"
                }
              />
            </div>
            {audience === "admin" && customerLabel ?
              <p className="truncate text-xs text-muted-foreground">{customerLabel}</p>
            : null}
            <p className="text-xs text-muted-foreground">
              {row.alias} · {containerOfferingKindLabel(row.kind)}
              {row.destinationCountry ? ` · ${row.destinationCountry}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Shipped {formatHistoryDate(row.historyAt)} · Current status:{" "}
              <span className="font-medium text-foreground">
                {historyStageLabel(row)}
              </span>
            </p>
            {row.deliveryMethod ?
              <p className="text-xs text-muted-foreground">
                Clearance: {barrelShippingDeliveryMethodLabel(row.deliveryMethod)}
              </p>
            : null}
          </div>
        </article>

        <div className="grid gap-2 sm:grid-cols-3">
          <PartnerBlock title="Freight" charge={freight} audience={audience} />
          <PartnerBlock
            title="Broker"
            charge={broker}
            audience={audience}
            fallbackName={catalogBroker?.name}
            fallbackDetail={
              catalogBroker
                ? `${catalogBroker.location} — ${catalogBroker.summary}`
                : row.deliveryMethod === "customs_pickup"
                  ? "Customer cleared destination customs."
                  : null
            }
          />
          <PartnerBlock
            title="Local courier"
            charge={courier}
            audience={audience}
            fallbackName={
              ownTransport
                ? "Customer provided own transportation"
                : catalogCourier?.name
            }
            fallbackDetail={
              ownTransport
                ? "Collected in person or with a private driver after customs release."
                : catalogCourier
                  ? `${catalogCourier.location} — ${catalogCourier.summary}`
                  : null
            }
          />
        </div>

        <CustomsClearanceDocumentsPanel
          barrelId={row.barrelId}
          published={packPublished}
          customsFormUrl={customsFormUrl}
          containerName={row.containerName}
          audience={audience}
        />
      </CardContent>
    </Card>
  );
}

function TablePartnerCell({ name }: { name: string | null }) {
  return (
    <td className="max-w-[12rem] px-3 py-2.5 text-muted-foreground">
      <span className="line-clamp-2">{name || "—"}</span>
    </td>
  );
}

export function ShippingHistoryList({
  rows,
  audience = "customer",
  emptyMessage,
}: {
  rows: ShippingHistoryRow[];
  audience?: ShippingHistoryAudience;
  emptyMessage?: string;
}) {
  const [openBarrelId, setOpenBarrelId] = useState<string | null>(null);
  const openRow = rows.find((row) => row.barrelId === openBarrelId) ?? null;
  const showCustomer = audience === "admin";

  useEffect(() => {
    if (openBarrelId && !rows.some((row) => row.barrelId === openBarrelId)) {
      setOpenBarrelId(null);
    }
  }, [openBarrelId, rows]);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border/80 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyMessage ??
          (audience === "admin"
            ? "Containers shipped through Amani Cart2Barrel appear here with freight, broker, courier, and customs documents."
            : "Containers you ship through Amani Cart2Barrel will appear here with freight, broker, courier, and customs documents.")}
      </p>
    );
  }

  return (
    <>
      <FloatingHorizontalScroll className="rounded-lg border border-border">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Container</th>
              {showCustomer ?
                <th className="px-3 py-2.5 font-medium">Customer</th>
              : null}
              <th className="px-3 py-2.5 font-medium">Destination</th>
              <th className="px-3 py-2.5 font-medium">Shipped</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Freight</th>
              <th className="px-3 py-2.5 font-medium">Broker</th>
              <th className="px-3 py-2.5 font-medium">Courier</th>
              <th className="px-3 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const partners = historyPartnerSummaries(row);
              const customerLabel =
                [row.customerName, row.customerEmail].filter(Boolean).join(" · ") ||
                "—";
              const selected = openBarrelId === row.barrelId;
              return (
                <tr
                  key={row.barrelId}
                  className={cn(
                    "cursor-pointer bg-card align-top transition-colors hover:bg-muted/40",
                    selected && "bg-primary/10 ring-1 ring-inset ring-primary/25",
                  )}
                  title="Double-click or Open to view this shipment"
                  tabIndex={0}
                  onDoubleClick={() => setOpenBarrelId(row.barrelId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setOpenBarrelId(row.barrelId);
                    }
                  }}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex min-w-[16rem] items-start gap-2.5">
                      <ProductRequestThumbnail
                        variant="admin"
                        imageUrl={row.containerImageUrl}
                        productLabel={row.containerName}
                      />
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-medium text-foreground">
                          {row.containerName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.alias} · {containerOfferingKindLabel(row.kind)}
                        </p>
                      </div>
                    </div>
                  </td>
                  {showCustomer ?
                    <td className="max-w-[14rem] px-3 py-2.5 text-muted-foreground">
                      <span className="line-clamp-2">{customerLabel}</span>
                    </td>
                  : null}
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {row.destinationCountry || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {formatHistoryDate(row.historyAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                    {historyStageLabel(row)}
                  </td>
                  <TablePartnerCell name={partners.freightName} />
                  <TablePartnerCell name={partners.brokerName} />
                  <TablePartnerCell name={partners.courierName} />
                  <td
                    className="px-3 py-2.5"
                    onClick={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setOpenBarrelId(row.barrelId)}
                    >
                      Open
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </FloatingHorizontalScroll>

      <Dialog
        open={Boolean(openRow)}
        onOpenChange={(open) => {
          if (!open) setOpenBarrelId(null);
        }}
      >
        <DialogContent className="max-h-[min(92vh,52rem)] overflow-y-auto p-3 sm:max-w-3xl">
          {openRow ?
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>{openRow.containerName}</DialogTitle>
                <DialogDescription>
                  Freight, broker, courier, and customs documents for this container.
                </DialogDescription>
              </DialogHeader>
              <ShippingHistoryCard row={openRow} audience={audience} />
            </>
          : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
