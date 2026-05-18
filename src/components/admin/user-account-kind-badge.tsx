import type { AdminProfileAccountKind } from "@/data/customer-pricing-packages";
import { cn } from "@/lib/utils";

const labelByKind: Record<AdminProfileAccountKind, string> = {
  admin: "Admin",
  customer: "Customer",
};

export function UserAccountKindBadge({
  kind,
  className,
}: {
  kind: AdminProfileAccountKind;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        kind === "admin" ?
          "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {labelByKind[kind]}
    </span>
  );
}
