"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AdminOrderLaneTable } from "@/components/admin/admin-order-lane-table";
import { AdminOrderLinesDetailDialog } from "@/components/admin/admin-order-lines-detail-dialog";
import { useAdminNestedPanelFocus } from "@/components/admin/admin-nested-panel-focus-context";
import { AdminOrderSlideCard } from "@/components/admin/admin-order-slide-card";
import {
  DashboardOrderLaneDisplayToggle,
  type OrderLaneDisplay,
} from "@/components/dashboard/dashboard-order-lane-display-toggle";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import type { AdminPaidOrderLineRow } from "@/data/admin-order-lines";
import type { OrderContainerLineAdmin } from "@/data/order-container-admin";
import type { ContainerLineRefundState } from "@/data/container-line-refund-state";
import type { HubStockOrderPackingPackage } from "@/lib/hub-stock-box";
import type {
  BatchQuoteEstimate,
  ItemQuote,
  ItemRequestLineSnapshot,
} from "@/db/schema";
import type { AdminStaffProfilesByClerkUserId } from "@/lib/admin-staff-profiles";
import {
  ADMIN_ORDER_SLIDE_LANE_AUDIENCE,
  groupOrdersForSlideLane,
  laneDescription,
  laneTitle,
  type AdminOrderSlideGroup,
  type AdminOrdersSlideLane,
} from "@/lib/admin-orders-slide-filters";
import {
  ORDER_CAROUSEL_NAV_NEXT_CLASS,
  ORDER_CAROUSEL_NAV_PREV_CLASS,
} from "@/lib/order-carousel-nav";
import {
  orderLinesForOrderId,
  resolveOrderIdFromHighlight,
} from "@/lib/order-notification-highlight";

const LANES: AdminOrdersSlideLane[] = [
  "awaiting_purchase",
  "funded",
  "need_corrections",
];

const LANE_DISPLAY_STORAGE_KEY = "c2b-admin-orders-lane-display";

const DEFAULT_LANE_DISPLAY: Record<AdminOrdersSlideLane, OrderLaneDisplay> = {
  awaiting_purchase: "thumbnail",
  funded: "thumbnail",
  need_corrections: "thumbnail",
};

function readStoredLaneDisplay(): Record<AdminOrdersSlideLane, OrderLaneDisplay> {
  if (typeof window === "undefined") return DEFAULT_LANE_DISPLAY;
  try {
    const raw = window.localStorage.getItem(LANE_DISPLAY_STORAGE_KEY);
    if (!raw) return DEFAULT_LANE_DISPLAY;
    const parsed = JSON.parse(raw) as Partial<
      Record<AdminOrdersSlideLane, OrderLaneDisplay>
    >;
    return {
      awaiting_purchase:
        parsed.awaiting_purchase === "table" ? "table" : "thumbnail",
      funded: parsed.funded === "table" ? "table" : "thumbnail",
      need_corrections:
        parsed.need_corrections === "table" ? "table" : "thumbnail",
    };
  } catch {
    return DEFAULT_LANE_DISPLAY;
  }
}

export function AdminOrdersCarouselView({
  rows,
  snapshotsByRequestId = {},
  latestQuotesByRequestId = {},
  batchEstimatesBySessionId = {},
  orderContainerLinesByOrderId = {},
  containerRefundStateByLineId = {},
  hubStockPackingByOrderId = {},
  staffProfilesByClerkUserId = {},
  highlightOrderId = null,
}: {
  rows: AdminPaidOrderLineRow[];
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
  latestQuotesByRequestId?: Record<string, ItemQuote>;
  batchEstimatesBySessionId?: Record<string, BatchQuoteEstimate>;
  orderContainerLinesByOrderId?: Record<string, OrderContainerLineAdmin[]>;
  containerRefundStateByLineId?: Record<string, ContainerLineRefundState>;
  hubStockPackingByOrderId?: Record<string, HubStockOrderPackingPackage[]>;
  staffProfilesByClerkUserId?: AdminStaffProfilesByClerkUserId;
  highlightOrderId?: string | null;
}) {
  const [detailGroup, setDetailGroup] = useState<AdminOrderSlideGroup | null>(
    null,
  );
  const [laneDisplay, setLaneDisplay] = useState<
    Record<AdminOrdersSlideLane, OrderLaneDisplay>
  >(DEFAULT_LANE_DISPLAY);
  const highlightConsumedRef = useRef(false);
  const skipLaneDisplayPersist = useRef(true);
  const { setNestedPanelActive } = useAdminNestedPanelFocus();

  useEffect(() => {
    setLaneDisplay(readStoredLaneDisplay());
  }, []);

  useEffect(() => {
    if (skipLaneDisplayPersist.current) {
      skipLaneDisplayPersist.current = false;
      return;
    }
    try {
      window.localStorage.setItem(
        LANE_DISPLAY_STORAGE_KEY,
        JSON.stringify(laneDisplay),
      );
    } catch {
      /* ignore quota / private mode */
    }
  }, [laneDisplay]);

  useEffect(() => {
    setNestedPanelActive(detailGroup != null);
  }, [detailGroup, setNestedPanelActive]);

  useEffect(() => {
    if (!highlightOrderId || highlightConsumedRef.current || rows.length === 0) {
      return;
    }
    const orderId = resolveOrderIdFromHighlight(rows, highlightOrderId);
    if (!orderId) return;
    const lines = orderLinesForOrderId(rows, orderId);
    if (lines.length === 0) return;
    highlightConsumedRef.current = true;
    setDetailGroup({
      order: lines[0]!.order,
      lines,
    });
  }, [highlightOrderId, rows]);

  const lanes = useMemo(
    () =>
      LANES.map((lane) => ({
        lane,
        groups: groupOrdersForSlideLane(rows, lane, ADMIN_ORDER_SLIDE_LANE_AUDIENCE),
      })),
    [rows],
  );

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No orders on this page.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {lanes.map(({ lane, groups }) => (
          <section
            key={lane}
            className="space-y-4 rounded-xl border border-border/80 bg-secondary p-4 sm:p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  {laneTitle(lane, ADMIN_ORDER_SLIDE_LANE_AUDIENCE)}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {laneDescription(lane, ADMIN_ORDER_SLIDE_LANE_AUDIENCE)}
                  {groups.length > 0 ?
                    <>
                      {" "}
                      ·{" "}
                      <span className="font-medium text-foreground">
                        {groups.length}{" "}
                        {groups.length === 1 ? "order" : "orders"}
                      </span>{" "}
                      (newest first)
                    </>
                  : null}
                </p>
              </div>
              <DashboardOrderLaneDisplayToggle
                value={laneDisplay[lane]}
                onChange={(next) =>
                  setLaneDisplay((current) => ({ ...current, [lane]: next }))
                }
              />
            </div>

            {groups.length === 0 ?
              <p className="rounded-lg border border-dashed border-border bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
                No orders in this lane right now.
              </p>
            : laneDisplay[lane] === "table" ?
              <AdminOrderLaneTable
                lane={lane}
                groups={groups}
                containerCountByOrderId={Object.fromEntries(
                  groups.map((group) => [
                    group.order.id,
                    orderContainerLinesByOrderId[group.order.id]?.length ?? 0,
                  ]),
                )}
                onOpenDetail={setDetailGroup}
              />
            : <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
                <div className="relative -mx-1 px-1 pb-2">
                  <CarouselContent className="-ml-4">
                    {groups.map((group) => (
                      <CarouselItem
                        key={`${lane}:${group.order.id}`}
                        className="shrink-0 grow-0 basis-[17rem] pl-4"
                      >
                        <div className="h-[22rem] w-full">
                          <AdminOrderSlideCard
                            group={group}
                            lane={lane}
                            onOpenDetail={() => setDetailGroup(group)}
                            className="h-full"
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious
                    variant="outline"
                    size="icon-lg"
                    className={ORDER_CAROUSEL_NAV_PREV_CLASS}
                  />
                  <CarouselNext
                    variant="outline"
                    size="icon-lg"
                    className={ORDER_CAROUSEL_NAV_NEXT_CLASS}
                  />
                </div>
              </Carousel>
            }
          </section>
        ))}
      </div>

      <AdminOrderLinesDetailDialog
        open={detailGroup != null}
        onOpenChange={(open) => {
          if (!open) setDetailGroup(null);
        }}
        group={detailGroup}
        snapshotsByRequestId={snapshotsByRequestId}
        latestQuotesByRequestId={latestQuotesByRequestId}
        batchEstimatesBySessionId={batchEstimatesBySessionId}
        orderContainerLinesByOrderId={orderContainerLinesByOrderId}
        containerRefundStateByLineId={containerRefundStateByLineId}
        hubStockPackingByOrderId={hubStockPackingByOrderId}
        staffProfilesByClerkUserId={staffProfilesByClerkUserId}
      />
    </>
  );
}
