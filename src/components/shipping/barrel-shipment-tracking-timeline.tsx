"use client";

import { CustomsClearanceForm } from "@/components/shipping/customs-clearance-form";
import { cn } from "@/lib/utils";
import {
  BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS,
  BARREL_SHIPMENT_TIMELINE_STAGES,
  barrelShipmentStageIndex,
  type BarrelOutboundShipmentStage,
  type BarrelOutboundShipmentTrackingView,
} from "@/lib/barrel-shipment-tracking";

type BarrelShipmentTrackingTimelineProps = {
  tracking: BarrelOutboundShipmentTrackingView | null;
  paidAt: string | null;
  paymentReferenceNumber?: string | null;
  compact?: boolean;
  /** Render the view/download customs clearance form (default true). */
  showCustomsForm?: boolean;
};

export function customerFreightPaidStatusMessage(
  paidAt: string | null,
  tracking: BarrelOutboundShipmentTrackingView | null,
): string | null {
  if (!paidAt) {
    return null;
  }
  if (
    tracking?.trackingStage === "awaiting_customs_clearance" &&
    !tracking.customsDeclarationFormUrl?.trim() &&
    !tracking.freightCompanyName?.trim()
  ) {
    return "Freight fee paid — awaiting customs clearance information.";
  }
  return null;
}

export function BarrelShipmentTrackingTimeline({
  tracking,
  paidAt,
  paymentReferenceNumber,
  compact = false,
  showCustomsForm = true,
}: BarrelShipmentTrackingTimelineProps) {
  if (!paidAt) {
    return null;
  }

  const awaitingMessage = customerFreightPaidStatusMessage(paidAt, tracking);
  const currentStage = tracking?.trackingStage ?? "awaiting_customs_clearance";
  const currentIndex =
    currentStage === "awaiting_customs_clearance" ?
      -1
    : barrelShipmentStageIndex(currentStage);

  return (
    <div className={cn("space-y-3", compact ? "text-xs" : "text-sm")}>
      {paymentReferenceNumber ?
        <p className="text-muted-foreground">
          Freight payment ref{" "}
          <span className="font-mono font-medium text-foreground">
            {paymentReferenceNumber}
          </span>
        </p>
      : null}

      {awaitingMessage ?
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-foreground">
          {awaitingMessage}
        </p>
      : null}

      <ol className="relative space-y-0 border-l border-border/70 pl-4">
        {BARREL_SHIPMENT_TIMELINE_STAGES.map((stage) => {
          const stageIndex = barrelShipmentStageIndex(stage);
          const isComplete = currentIndex >= stageIndex;
          const isCurrent =
            currentStage !== "awaiting_customs_clearance" &&
            currentStage === stage;

          return (
            <li key={stage} className="relative pb-3 last:pb-0">
              <span
                className={cn(
                  "absolute -left-[1.3rem] top-1 size-2.5 rounded-full border-2 border-background",
                  isComplete ?
                    "bg-primary"
                  : "bg-muted",
                  isCurrent && "ring-2 ring-primary/40",
                )}
                aria-hidden
              />
              <p
                className={cn(
                  "font-medium leading-snug",
                  isComplete ? "text-foreground" : "text-muted-foreground",
                  isCurrent && "text-primary",
                )}
              >
                {BARREL_OUTBOUND_SHIPMENT_STAGE_LABELS[stage]}
              </p>
              {isCurrent && tracking?.stageUpdatedAt ?
                <p className="text-[11px] text-muted-foreground">
                  Updated{" "}
                  {new Date(tracking.stageUpdatedAt).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </p>
              : null}
            </li>
          );
        })}
      </ol>

      {tracking?.freightCompanyName ?
        <dl className="grid gap-1.5 rounded-md border border-border/60 bg-muted px-2.5 py-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Freight company</dt>
            <dd className="text-foreground">{tracking.freightCompanyName}</dd>
          </div>
          {tracking.freightDropOffAt ?
            <div>
              <dt className="text-muted-foreground">Dropped off to freight</dt>
              <dd className="text-foreground">
                {new Date(tracking.freightDropOffAt).toLocaleDateString(undefined, {
                  dateStyle: "medium",
                })}
              </dd>
            </div>
          : null}
          {tracking.estimatedArrivalAt ?
            <div>
              <dt className="text-muted-foreground">Estimated arrival</dt>
              <dd className="text-foreground">
                {new Date(tracking.estimatedArrivalAt).toLocaleDateString(undefined, {
                  dateStyle: "medium",
                })}
              </dd>
            </div>
          : null}
        </dl>
      : null}

      {showCustomsForm && tracking?.customsDeclarationFormUrl?.trim() ?
        <div className="space-y-1.5 rounded-md border border-border/60 bg-muted px-2.5 py-2">
          <p
            className={cn(
              "font-medium text-foreground",
              compact ? "text-[11px]" : "text-xs",
            )}
          >
            Customs clearance form
          </p>
          <CustomsClearanceForm url={tracking.customsDeclarationFormUrl} />
        </div>
      : null}
    </div>
  );
}
