import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { cn } from "@/lib/utils";

export type BarrelAssignmentHistoryProductProps = {
  productName: string | null;
  productImageUrl?: string | null;
  quantity?: number;
  compact?: boolean;
};

export function BarrelAssignmentHistoryProduct({
  productName,
  productImageUrl = null,
  quantity = 1,
  compact = false,
}: BarrelAssignmentHistoryProductProps) {
  const label = productName?.trim() || "Unnamed product";

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-0.5",
        compact ? "min-w-0" : "min-w-[12rem] gap-2.5",
      )}
    >
      <div className="relative shrink-0">
        <ProductRequestThumbnail
          variant="list"
          imageUrl={productImageUrl}
          productLabel={label}
          className={compact ? "size-9" : "size-12"}
        />
        {quantity > 1 ?
          <span
            className={cn(
              "absolute -bottom-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 py-px font-semibold leading-none text-primary-foreground shadow-sm",
              compact ? "text-[8px]" : "text-[9px]",
            )}
            title={`Quantity ${quantity}`}
          >
            {quantity}
          </span>
        : null}
      </div>
      <span
        className={cn(
          "min-w-0 font-medium leading-snug text-foreground",
          compact ? "line-clamp-2 text-xs" : "",
        )}
        title={label}
      >
        {label}
      </span>
    </div>
  );
}
