import {
  CartLinePriceBreakdown,
  type CartLinePriceRow,
} from "@/components/dashboard/cart-line-price-breakdown";

export function AdminOrderEstimateSummary({
  rows,
  className,
}: {
  rows: CartLinePriceRow[];
  className?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <CartLinePriceBreakdown
      rows={rows}
      className={
        className ??
        "mt-2 max-w-md text-xs [&_li]:gap-x-4 [&_li]:px-3 [&_li]:py-1.5 [&_li]:text-xs [&_span]:text-xs"
      }
    />
  );
}
