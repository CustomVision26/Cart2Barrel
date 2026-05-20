import type { ReactNode } from "react";

import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import type { BarrelPipelineProductDisplayRow } from "@/lib/barrel-pipeline-product-display";
import { formatBarrelAssignmentWhenShort } from "@/lib/barrel-pipeline-product-display";
import { cn } from "@/lib/utils";

type BarrelPipelineProductCardProps = {
  row: BarrelPipelineProductDisplayRow;
  isAssigned: boolean;
  className?: string;
  footer?: ReactNode;
  orderIdHint?: boolean;
};

export function BarrelPipelineProductCard({
  row,
  isAssigned,
  className,
  footer,
  orderIdHint = false,
}: BarrelPipelineProductCardProps) {
  const assignedShort = formatBarrelAssignmentWhenShort(row.assignedAt);

  return (
    <article
      className={cn(
        "group flex gap-2.5 overflow-hidden rounded-lg border border-border/80 bg-card/90 p-2 shadow-sm transition-[border-color,box-shadow,background-color] hover:border-border hover:bg-card hover:shadow-md",
        className,
      )}
    >
      <div className="relative shrink-0 self-start">
        <ProductRequestThumbnail
          variant="list"
          imageUrl={row.productImageUrl}
          productLabel={row.productName}
        />
        {row.quantity > 1 ?
          <span
            className="absolute -bottom-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 py-px text-[9px] font-semibold leading-none text-primary-foreground shadow-sm"
            title={`Quantity ${row.quantity}`}
          >
            {row.quantity}
          </span>
        : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="space-y-0.5">
          <h3
            className="line-clamp-2 text-xs font-semibold leading-snug text-foreground"
            title={row.productName}
          >
            {row.productName}
          </h3>
          <p
            className="line-clamp-1 text-[10px] leading-tight text-muted-foreground"
            title={row.fulfillmentLabel}
          >
            {row.fulfillmentLabel}
          </p>
          {orderIdHint ?
            <p className="font-mono text-[10px] text-muted-foreground">
              Order {row.orderId.slice(0, 8)}…
            </p>
          : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
          {isAssigned ?
            <span className="inline-flex min-w-0 items-center gap-1 text-foreground">
              <span
                className="size-1.5 shrink-0 rounded-full bg-emerald-500"
                aria-hidden
              />
              <span className="truncate font-medium">{row.assignedContainerAlias}</span>
              {assignedShort ?
                <span className="shrink-0 text-muted-foreground">· {assignedShort}</span>
              : null}
            </span>
          : <span className="text-muted-foreground">Awaiting assignment</span>}
        </div>

        {footer ? <div className="mt-0.5">{footer}</div> : null}
      </div>
    </article>
  );
}
