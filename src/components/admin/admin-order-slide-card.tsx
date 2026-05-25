"use client";

import { Package } from "lucide-react";

import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import type { AdminPaidOrderLineRow } from "@/data/admin-order-lines";
import {
  laneTitle,
  ORDER_SLIDE_LANE_AUDIENCE,
  type AdminOrderSlideGroup,
  type AdminOrdersSlideLane,
} from "@/lib/admin-orders-slide-filters";
import {
  ORDER_SLIDE_BORDER_INSET,
  orderSlideBorderGlowClass,
} from "@/lib/order-slide-border-glow";
import {
  adminCustomerDisplayLabel,
} from "@/lib/admin-customer-group";
import { formatUsd } from "@/lib/admin-markup";
import { partitionPaidLinesIntoBatchBuckets } from "@/lib/partition-paid-order-batch-groups";
import { cn } from "@/lib/utils";

function previewTiles(group: AdminOrderSlideGroup): {
  imageUrl: string | null;
  label: string;
}[] {
  const buckets = partitionPaidLinesIntoBatchBuckets(group.lines);
  const tiles: { imageUrl: string | null; label: string }[] = [];

  for (const bucket of buckets) {
    if (bucket.kind === "batch") {
      const first = bucket.lines[0];
      if (first) {
        tiles.push({
          imageUrl: first.request.productImageUrl,
          label:
            bucket.batchNumber?.trim() ||
            `Batch · ${bucket.lines.length}`,
        });
      }
    } else {
      for (const row of bucket.lines) {
        tiles.push({
          imageUrl: row.request.productImageUrl,
          label: row.request.productName?.trim() || "Single",
        });
      }
    }
  }

  return tiles.slice(0, 4);
}

function countSummary(group: AdminOrderSlideGroup): string {
  const buckets = partitionPaidLinesIntoBatchBuckets(group.lines);
  let batchProducts = 0;
  let singles = 0;
  for (const b of buckets) {
    if (b.kind === "batch") batchProducts += b.lines.length;
    else singles += b.lines.length;
  }
  const parts: string[] = [];
  if (batchProducts > 0) {
    parts.push(
      `${batchProducts} batch ${batchProducts === 1 ? "item" : "items"}`,
    );
  }
  if (singles > 0) {
    parts.push(`${singles} single ${singles === 1 ? "item" : "items"}`);
  }
  return parts.join(" · ") || `${group.lines.length} items`;
}

const PREVIEW_SLOT_COUNT = 4;

export function AdminOrderSlideCard({
  group,
  lane,
  onOpenDetail,
  className,
}: {
  group: AdminOrderSlideGroup;
  lane: AdminOrdersSlideLane;
  onOpenDetail: () => void;
  className?: string;
}) {
  const first = group.lines[0]!;
  const customer = adminCustomerDisplayLabel({
    fullName: first.customerFullName,
    email: first.customerEmail,
    clerkUserId: group.order.clerkUserId,
  });
  const tiles = previewTiles(group);
  const previewSlots = Array.from({ length: PREVIEW_SLOT_COUNT }, (_, i) => tiles[i] ?? null);
  const extraCount = Math.max(
    0,
    partitionPaidLinesIntoBatchBuckets(group.lines).reduce(
      (n, b) => n + (b.kind === "batch" ? 1 : b.lines.length),
      0,
    ) - tiles.length,
  );

  return (
    <div
      className={cn(
        "relative isolate w-full min-w-0 overflow-hidden rounded-xl",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "order-slide-border-glow pointer-events-none absolute -inset-[120%] origin-center",
          orderSlideBorderGlowClass(lane),
        )}
      />
      <article
        className={cn(
          "relative z-10 flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[10px] bg-card text-left shadow-sm transition-shadow hover:shadow-md",
          ORDER_SLIDE_BORDER_INSET,
        )}
      >
      <button
        type="button"
        className="flex h-full min-h-0 flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onDoubleClick={(e) => {
          e.preventDefault();
          onOpenDetail();
        }}
        title="Double-click to view all products in a table"
      >
      <div className="grid h-[11rem] shrink-0 grid-cols-2 grid-rows-2 gap-px bg-border">
        {previewSlots.map((tile, i) => (
          <div
            key={tile ? `${tile.label}:${i}` : `empty:${i}`}
            className="relative min-h-0 overflow-hidden bg-muted"
          >
            {tile ?
              <ProductRequestThumbnail
                variant="admin"
                imageUrl={tile.imageUrl}
                productLabel={tile.label}
                className="size-full max-w-none rounded-none border-0 sm:w-full"
              />
            : tiles.length === 0 && i === 0 ?
              <div
                className="flex size-full items-center justify-center bg-muted text-muted-foreground"
                aria-hidden
              >
                <Package className="size-10 opacity-40" />
              </div>
            : (
              <div className="size-full bg-muted" aria-hidden />
            )}
            {tile && i === tiles.length - 1 && extraCount > 0 ?
              <span className="absolute inset-0 flex items-center justify-center bg-card text-sm font-semibold text-foreground">
                +{extraCount}
              </span>
            : null}
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {laneTitle(lane, ORDER_SLIDE_LANE_AUDIENCE)}
        </p>
        <p className="line-clamp-1 text-sm font-semibold text-foreground">
          {customer}
        </p>
        <p className="line-clamp-1 font-mono text-[11px] text-primary">
          {group.order.id.slice(0, 8)}…
        </p>
        <p className="text-xs text-muted-foreground">{countSummary(group)}</p>
        <div className="mt-auto flex items-center justify-between gap-2 text-xs">
          <span className="font-medium tabular-nums text-foreground">
            {formatUsd(group.order.totalAmount)}
          </span>
          <time
            className="tabular-nums text-muted-foreground"
            dateTime={group.order.createdAt}
          >
            {new Date(group.order.createdAt).toLocaleDateString()}
          </time>
        </div>
        <p className="text-[11px] font-medium text-primary">
          Double-click for products →
        </p>
      </div>
      </button>
      </article>
    </div>
  );
}
