"use client";

import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import { formatUsd } from "@/lib/admin-markup";
import {
  orderSlideStatusLabel,
  ORDER_SLIDE_LANE_AUDIENCE,
  type OrderSlideGroup,
  type OrdersSlideLane,
} from "@/lib/admin-orders-slide-filters";
import {
  orderSlideCountSummary,
  orderSlidePreviewExtraCount,
  orderSlidePreviewTiles,
} from "@/lib/dashboard-order-slide-preview";

type DashboardOrderSlideGroup = OrderSlideGroup & {
  lines: DashboardPaidOrderLineRow[];
};

export function DashboardOrderLaneTable({
  lane,
  groups,
  containerCountByOrderId,
  onOpenDetail,
}: {
  lane: OrdersSlideLane;
  groups: DashboardOrderSlideGroup[];
  containerCountByOrderId: Record<string, number>;
  onOpenDetail: (group: DashboardOrderSlideGroup) => void;
}) {
  return (
    <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border/80 bg-card ring-1 ring-foreground/5">
      <table className="w-full min-w-[42rem] text-left text-sm">
        <thead className="border-b border-border bg-muted">
          <tr>
            <th className="px-3 py-2.5 font-medium text-foreground">Photo</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Status</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Order</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Items</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Total</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Date</th>
            <th className="px-3 py-2.5 font-medium text-foreground">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const tiles = orderSlidePreviewTiles(group);
            const extraCount = orderSlidePreviewExtraCount(group);
            const containerCount = containerCountByOrderId[group.order.id] ?? 0;
            return (
              <tr
                key={group.order.id}
                className="cursor-pointer border-b border-border/70 last:border-b-0 hover:bg-muted/60"
                onClick={() => onOpenDetail(group)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenDetail(group);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View products for order ${group.order.id.slice(0, 8)}`}
                title="Open products"
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    {tiles.length === 0 ?
                      <ProductRequestThumbnail
                        variant="admin"
                        imageUrl={null}
                        productLabel="Order"
                      />
                    : tiles.map((tile, index) => (
                        <div key={`${tile.label}:${index}`} className="relative">
                          <ProductRequestThumbnail
                            variant="admin"
                            imageUrl={tile.imageUrl}
                            productLabel={tile.label}
                          />
                          {index === tiles.length - 1 && extraCount > 0 ?
                            <span className="absolute inset-0 flex items-center justify-center rounded-md bg-card/80 text-[10px] font-semibold text-foreground">
                              +{extraCount}
                            </span>
                          : null}
                        </div>
                      ))}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {orderSlideStatusLabel(group, lane, ORDER_SLIDE_LANE_AUDIENCE)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs font-semibold text-primary">
                  {group.order.id.slice(0, 8)}…
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {orderSlideCountSummary(group, containerCount)}
                </td>
                <td className="px-3 py-2.5 font-medium tabular-nums text-foreground">
                  {formatUsd(group.order.totalAmount)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                  <time dateTime={group.order.createdAt}>
                    {new Date(group.order.createdAt).toLocaleDateString()}
                  </time>
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs font-medium text-primary">View products</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </FloatingHorizontalScroll>
  );
}
