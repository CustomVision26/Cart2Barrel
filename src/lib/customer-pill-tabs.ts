import { cn } from "@/lib/utils";

/** Pill tabs used on customer dashboard screens (Orders, Barrels, Shipping, Add item). */
export function customerPillTabClass(selected: boolean): string {
  return cn(
    "inline-flex min-h-10 items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    selected
      ? "border-primary bg-primary text-primary-foreground shadow-sm"
      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
  );
}

export const customerPillTablistClass =
  "flex flex-wrap gap-2 border-0 pb-1";
