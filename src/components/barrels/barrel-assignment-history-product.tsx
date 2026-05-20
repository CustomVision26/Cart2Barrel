import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";

export type BarrelAssignmentHistoryProductProps = {
  productName: string | null;
  productImageUrl?: string | null;
  quantity?: number;
};

export function BarrelAssignmentHistoryProduct({
  productName,
  productImageUrl = null,
  quantity = 1,
}: BarrelAssignmentHistoryProductProps) {
  const label = productName?.trim() || "Unnamed product";

  return (
    <div className="flex min-w-[12rem] items-center gap-2.5 py-0.5">
      <div className="relative shrink-0">
        <ProductRequestThumbnail
          variant="list"
          imageUrl={productImageUrl}
          productLabel={label}
          className="size-12"
        />
        {quantity > 1 ?
          <span
            className="absolute -bottom-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 py-px text-[9px] font-semibold leading-none text-primary-foreground shadow-sm"
            title={`Quantity ${quantity}`}
          >
            {quantity}
          </span>
        : null}
      </div>
      <span className="min-w-0 font-medium leading-snug text-foreground">{label}</span>
    </div>
  );
}
