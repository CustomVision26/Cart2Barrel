import type { ReactNode } from "react";
import { useCallback, useState } from "react";

import { BarrelPipelineProductCard } from "@/components/barrels/barrel-pipeline-product-card";
import { BarrelPipelineProductDetailDialog } from "@/components/barrels/barrel-pipeline-product-detail-dialog";
import type { BarrelPipelineProductDisplayRow } from "@/lib/barrel-pipeline-product-display";
import { barrelPipelineProductGridClassName } from "@/lib/barrel-pipeline-product-display";
import type { BarrelPipelineProductDetail } from "@/lib/barrel-pipeline-product-detail";

type BarrelPipelineProductSectionsProps = {
  lines: BarrelPipelineProductDisplayRow[];
  isAssigned: (row: BarrelPipelineProductDisplayRow) => boolean;
  orderIdHint?: boolean;
  emptyMessage: string;
  renderCardFooter?: (row: BarrelPipelineProductDisplayRow) => ReactNode;
  detailsByOrderItemId?: Record<string, BarrelPipelineProductDetail>;
};

export function BarrelPipelineProductSections({
  lines,
  isAssigned,
  orderIdHint = false,
  emptyMessage,
  renderCardFooter,
  detailsByOrderItemId,
}: BarrelPipelineProductSectionsProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeDetail, setActiveDetail] = useState<BarrelPipelineProductDetail | null>(
    null,
  );

  const openDetail = useCallback(
    (orderItemId: string) => {
      const detail = detailsByOrderItemId?.[orderItemId] ?? null;
      if (!detail) return;
      setActiveDetail(detail);
      setDetailOpen(true);
    },
    [detailsByOrderItemId],
  );
  const awaiting = lines.filter((row) => !isAssigned(row));
  const assigned = lines.filter((row) => isAssigned(row));

  if (lines.length === 0) {
    return (
      <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const showDetailDialog = Boolean(detailsByOrderItemId);

  return (
    <>
      <div className="space-y-6">
        {awaiting.length > 0 ?
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Awaiting assignment ({awaiting.length})
            </h3>
            <div className={barrelPipelineProductGridClassName}>
              {awaiting.map((row) => (
                <BarrelPipelineProductCard
                  key={row.packageId}
                  row={row}
                  isAssigned={false}
                  orderIdHint={orderIdHint}
                  footer={renderCardFooter?.(row)}
                  onDoubleClick={
                    showDetailDialog ?
                      () => openDetail(row.orderItemId)
                    : undefined
                  }
                />
              ))}
            </div>
          </div>
        : null}

        {assigned.length > 0 ?
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Assigned to container ({assigned.length})
            </h3>
            <div className={barrelPipelineProductGridClassName}>
              {assigned.map((row) => (
                <BarrelPipelineProductCard
                  key={row.packageId}
                  row={row}
                  isAssigned
                  orderIdHint={orderIdHint}
                  footer={renderCardFooter?.(row)}
                  onDoubleClick={
                    showDetailDialog ?
                      () => openDetail(row.orderItemId)
                    : undefined
                  }
                />
              ))}
            </div>
          </div>
        : null}
      </div>

      {showDetailDialog ?
        <BarrelPipelineProductDetailDialog
          detail={activeDetail}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      : null}
    </>
  );
}
