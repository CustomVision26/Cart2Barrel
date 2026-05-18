import { formatStaffNoteParagraphsForDisplay } from "@/lib/staff-note-display";
import { cn } from "@/lib/utils";

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
  const paragraphs = formatStaffNoteParagraphsForDisplay(staffNote);
  if (paragraphs.length === 0) return null;

  const compact = variant === "compact";

  return (
    <div
      className={cn(
        compact ?
          "space-y-1"
        : "space-y-2 rounded-md border border-border bg-muted/15 px-3 py-2.5 text-sm",
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
      <div className={cn("space-y-2 text-foreground", compact && "space-y-1")}>
        {paragraphs.map((paragraph, i) => (
          <p
            key={i}
            className={cn(
              "whitespace-pre-wrap leading-relaxed",
              compact ? "text-[11px] text-muted-foreground" : "text-sm",
            )}
          >
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}
