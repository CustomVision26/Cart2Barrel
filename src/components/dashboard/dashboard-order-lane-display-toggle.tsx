"use client";

import { LayoutGrid, Table2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OrderLaneDisplay = "thumbnail" | "table";

export function DashboardOrderLaneDisplayToggle({
  value,
  onChange,
}: {
  value: OrderLaneDisplay;
  onChange: (next: OrderLaneDisplay) => void;
}) {
  return (
    <div
      className="inline-flex shrink-0 rounded-lg border border-border bg-background p-0.5"
      role="group"
      aria-label="Lane view format"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-pressed={value === "thumbnail"}
        onClick={() => onChange("thumbnail")}
        className={cn(
          "gap-1.5",
          value === "thumbnail" &&
            "bg-muted text-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <LayoutGrid />
        Thumbnail
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-pressed={value === "table"}
        onClick={() => onChange("table")}
        className={cn(
          "gap-1.5",
          value === "table" &&
            "bg-muted text-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Table2 />
        Table
      </Button>
    </div>
  );
}
