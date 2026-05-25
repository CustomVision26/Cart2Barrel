import {
  formatStaffNoteItemsForDisplay,
  type StaffNoteDisplayItem,
} from "@/lib/staff-note-display";
import { cn } from "@/lib/utils";

type StaffNotesListProps = {
  items: StaffNoteDisplayItem[];
  compact?: boolean;
  className?: string;
};

export function StaffNotesList({
  items,
  compact = false,
  className,
}: StaffNotesListProps) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "divide-y divide-border/60",
        compact ? "text-[11px]" : "text-sm",
        className,
      )}
    >
      {items.map((item, index) =>
        item.kind === "message" ?
          <div key={index} className="py-2.5 first:pt-0 last:pb-0">
            <p
              className={cn(
                "leading-relaxed text-foreground",
                compact ? "text-[11px] text-muted-foreground" : "text-sm",
              )}
            >
              {item.text}
            </p>
          </div>
        : <div
            key={index}
            className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,11rem)_1fr] sm:items-start sm:gap-4"
          >
            <p
              className={cn(
                "font-medium text-muted-foreground",
                compact ? "text-[10px] uppercase tracking-wide" : "text-xs",
              )}
            >
              {item.label}
            </p>
            <p
              className={cn(
                "text-foreground",
                compact ? "text-[11px] sm:text-right" : "text-sm sm:text-right",
              )}
            >
              {item.value}
            </p>
          </div>,
      )}
    </div>
  );
}

type AdminStaffNotesBlockProps = {
  staffNote: string | null | undefined;
  /** Defaults to "Notes from Cart2Barrel". */
  title?: string;
  className?: string;
  variant?: "default" | "compact";
};

export function AdminStaffNotesBlock({
  staffNote,
  title = "Notes from Cart2Barrel",
  className,
  variant = "default",
}: AdminStaffNotesBlockProps) {
  const items = formatStaffNoteItemsForDisplay(staffNote);
  if (items.length === 0) return null;

  const compact = variant === "compact";

  return (
    <div
      className={cn(
        compact ?
          "space-y-1"
        : "space-y-2 rounded-md border border-border bg-secondary px-3 py-2.5",
        className,
      )}
    >
      <p
        className={cn(
          "font-medium uppercase tracking-wide text-muted-foreground",
          compact ? "text-[10px]" : "text-xs",
        )}
      >
        {title}
      </p>
      <StaffNotesList items={items} compact={compact} />
    </div>
  );
}
