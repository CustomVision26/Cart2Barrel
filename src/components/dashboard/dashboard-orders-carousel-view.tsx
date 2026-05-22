"use client";

import { useMemo, useState } from "react";

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

const LANES: OrdersSlideLane[] = [
  "awaiting_purchase",
  "funded",
  "need_corrections",
];

type DashboardOrderSlideGroup = OrderSlideGroup & {
  lines: DashboardPaidOrderLineRow[];
};

export function DashboardOrdersCarouselView({
  rows,
  snapshotsByRequestId = {},
}: {
  rows: DashboardPaidOrderLineRow[];
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
}) {
  const [detailGroup, setDetailGroup] = useState<DashboardOrderSlideGroup | null>(
    null,
  );

  const lanes = useMemo(
    () =>
      LANES.map((lane) => ({
        lane,
        groups: groupOrdersForSlideLane(
          rows,
          lane,
        ) as DashboardOrderSlideGroup[],
      })),
    [rows],
  );

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
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
            className="space-y-4 rounded-xl border border-border/80 bg-muted/15 p-4 sm:p-5"
          >
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

            {groups.length === 0 ?
              <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                No orders in this lane right now.
              </p>
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
      />
    </>
  );
}
