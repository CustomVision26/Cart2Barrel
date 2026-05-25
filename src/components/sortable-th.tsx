"use client";

import { ArrowDownAZIcon, ArrowDownZAIcon, ArrowUpDownIcon } from "lucide-react";

import type { SortDir } from "@/lib/table-sort";
import { cn } from "@/lib/utils";

type SortableThProps = {
  label: string;
  /** Stable id for this column (for aria-sort). */
  columnId: string;
  active: boolean;
  dir: SortDir;
  onSort: () => void;
  className?: string;
  numeric?: boolean;
};

export function SortableTh({
  label,
  columnId,
  active,
  dir,
  onSort,
  className,
  numeric = false,
}: SortableThProps) {
  const Icon = !active
    ? ArrowUpDownIcon
    : dir === "asc"
      ? ArrowDownAZIcon
      : ArrowDownZAIcon;

  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2.5 font-medium text-foreground",
        numeric && "tabular-nums",
        className
      )}
      aria-sort={
        active ? (dir === "asc" ? "ascending" : "descending") : undefined
      }
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md px-0.5 py-0.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(e) => {
          e.stopPropagation();
          onSort();
        }}
        aria-label={`Sort by ${label}`}
        id={`sort-${columnId}`}
      >
        <span>{label}</span>
        <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </th>
  );
}

/** Compact variant for nested admin tables (text-xs). */
export function SortableThCompact({
  label,
  columnId,
  active,
  dir,
  onSort,
  className,
  numeric = false,
}: SortableThProps) {
  const Icon = !active
    ? ArrowUpDownIcon
    : dir === "asc"
      ? ArrowDownAZIcon
      : ArrowDownZAIcon;

  return (
    <th
      scope="col"
      className={cn(
        "px-2 py-2 font-medium text-foreground",
        numeric && "tabular-nums",
        className
      )}
      aria-sort={
        active ? (dir === "asc" ? "ascending" : "descending") : undefined
      }
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md px-0.5 py-0.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(e) => {
          e.stopPropagation();
          onSort();
        }}
        aria-label={`Sort by ${label}`}
        id={`sort-${columnId}`}
      >
        <span>{label}</span>
        <Icon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </th>
  );
}
