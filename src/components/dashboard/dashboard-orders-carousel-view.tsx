"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  DashboardOrderLaneDisplayToggle,
  type OrderLaneDisplay,
} from "@/components/dashboard/dashboard-order-lane-display-toggle";
import { DashboardOrderLaneTable } from "@/components/dashboard/dashboard-order-lane-table";
import { DashboardOrderLinesDetailDialog } from "@/components/dashboard/dashboard-order-lines-detail-dialog";
import { DashboardOrderSlideCard } from "@/components/dashboard/dashboard-order-slide-card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import type { ContainerLineRefundState } from "@/data/container-line-refund-state";
import type { OrderContainerLineAdmin } from "@/data/order-container-admin";
import type { ItemRequestLineSnapshot } from "@/db/schema";
import {
  groupOrdersForSlideLane,
  laneDescription,
  laneTitle,
  ORDER_SLIDE_LANE_AUDIENCE,
  type OrderSlideGroup,
  type OrdersSlideLane,
} from "@/lib/admin-orders-slide-filters";
import {
  ORDER_CAROUSEL_NAV_NEXT_CLASS,
  ORDER_CAROUSEL_NAV_PREV_CLASS,
} from "@/lib/order-carousel-nav";
import {
  orderLinesForOrderId,
  resolveOrderIdFromHighlight,
} from "@/lib/order-notification-highlight";

const LANES: OrdersSlideLane[] = [
  "awaiting_purchase",
  "funded",
  "need_corrections",
];

const LANE_DISPLAY_STORAGE_KEY = "c2b-dashboard-orders-lane-display";

const DEFAULT_LANE_DISPLAY: Record<OrdersSlideLane, OrderLaneDisplay> = {
  awaiting_purchase: "thumbnail",
  funded: "thumbnail",
  need_corrections: "thumbnail",
};

function readStoredLaneDisplay(): Record<OrdersSlideLane, OrderLaneDisplay> {
  if (typeof window === "undefined") return DEFAULT_LANE_DISPLAY;
  try {
    const raw = window.localStorage.getItem(LANE_DISPLAY_STORAGE_KEY);
    if (!raw) return DEFAULT_LANE_DISPLAY;
    const parsed = JSON.parse(raw) as Partial<Record<OrdersSlideLane, OrderLaneDisplay>>;
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

type DashboardOrderSlideGroup = OrderSlideGroup & {
  lines: DashboardPaidOrderLineRow[];
};

export function DashboardOrdersCarouselView({
  rows,
  snapshotsByRequestId = {},
  orderContainerLinesByOrderId = {},
  containerRefundStateByLineId = {},
  highlightOrderId = null,
}: {
  rows: DashboardPaidOrderLineRow[];
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
  orderContainerLinesByOrderId?: Record<string, OrderContainerLineAdmin[]>;
  containerRefundStateByLineId?: Record<string, ContainerLineRefundState>;
  highlightOrderId?: string | null;
}) {
  const [detailGroup, setDetailGroup] = useState<DashboardOrderSlideGroup | null>(
    null,
  );
  const [laneDisplay, setLaneDisplay] = useState<
    Record<OrdersSlideLane, OrderLaneDisplay>
  >(DEFAULT_LANE_DISPLAY);
  const highlightConsumedRef = useRef(false);
  const skipLaneDisplayPersist = useRef(true);

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

  useEffect(() => {
    if (!detailGroup) return;

    const orderId = detailGroup.order.id;
    const freshLines = rows.filter((row) => row.order.id === orderId);
    if (freshLines.length === 0) {
      setDetailGroup(null);
      return;
    }

    setDetailGroup({
      order: freshLines[0]?.order ?? detailGroup.order,
      lines: freshLines,
    });
  }, [rows, detailGroup?.order.id]);

  const lanes = useMemo(
    () =>
      LANES.map((lane) => ({
        lane,
        groups: groupOrdersForSlideLane(
          rows,
          lane,
          ORDER_SLIDE_LANE_AUDIENCE,
        ) as DashboardOrderSlideGroup[],
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
                  {laneTitle(lane, ORDER_SLIDE_LANE_AUDIENCE)}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {laneDescription(lane, ORDER_SLIDE_LANE_AUDIENCE)}
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
              {groups.length > 0 ?
                <DashboardOrderLaneDisplayToggle
                  value={laneDisplay[lane]}
                  onChange={(next) =>
                    setLaneDisplay((current) => ({ ...current, [lane]: next }))
                  }
                />
              : null}
            </div>

            {groups.length === 0 ?
              <p className="rounded-lg border border-dashed border-border bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
                No orders in this lane right now.
              </p>
            : laneDisplay[lane] === "table" ?
              <DashboardOrderLaneTable
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
                          <DashboardOrderSlideCard
                            group={group}
                            lane={lane}
                            containerCount={
                              orderContainerLinesByOrderId[group.order.id]?.length ?? 0
                            }
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

      <DashboardOrderLinesDetailDialog
        open={detailGroup != null}
        onOpenChange={(open) => {
          if (!open) setDetailGroup(null);
        }}
        group={detailGroup}
        snapshotsByRequestId={snapshotsByRequestId}
        orderContainerLinesByOrderId={orderContainerLinesByOrderId}
        containerRefundStateByLineId={containerRefundStateByLineId}
      />
    </>
  );
}
