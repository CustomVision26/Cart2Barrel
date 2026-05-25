import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

export type CartLinePriceRow = {
  label: string;
  detail?: string;
  amountCents: number;
  emphasis?: boolean;
};

type CartLinePriceBreakdownProps = {
  rows: CartLinePriceRow[];
  className?: string;
};

/** E-commerce-style price sub-rows (container, packaging, fees). */
export function CartLinePriceBreakdown({
  rows,
  className,
}: CartLinePriceBreakdownProps) {
  if (rows.length === 0) return null;

  return (
    <ul
      className={cn(
        "divide-y divide-border/60 rounded-lg border border-border/70 bg-secondary",
        className,
      )}
      role="list"
    >
      {rows.map((row) => (
        <li
          key={row.label}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-0.5 px-4 py-2.5 text-sm"
        >
          <span className="min-w-0 text-muted-foreground">
            <span className={cn(row.emphasis && "font-medium text-foreground")}>
              {row.label}
            </span>
            {row.detail ?
              <span className="mt-0.5 block text-xs text-muted-foreground/90">
                {row.detail}
              </span>
            : null}
          </span>
          <span
            className={cn(
              "text-right tabular-nums",
              row.emphasis ?
                "text-base font-semibold text-foreground"
              : "font-medium text-foreground",
            )}
          >
            {formatUsd(row.amountCents)}
          </span>
        </li>
      ))}
    </ul>
  );
}
