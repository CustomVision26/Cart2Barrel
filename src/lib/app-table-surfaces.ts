/**
 * Solid tinted surfaces for app tables and table-like UI.
 * Uses theme tokens (--card, --muted, --accent) so interface color tint applies.
 */

export const appTableShell =
  "rounded-xl border border-border/80 bg-card shadow-sm ring-1 ring-foreground/5";

export const appTableScroll =
  "rounded-lg border border-border/80 bg-card ring-1 ring-foreground/5";

export const appTableHead =
  "border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground";

export const appTableHeadPlain = "border-b border-border bg-muted";

export const appTableHeadSticky =
  "sticky top-0 z-10 border-b border-border bg-muted";

export const appTableToolbar =
  "rounded-lg border border-border/80 bg-muted px-3 py-2";

export const appTableFilterPanel =
  "space-y-3 rounded-lg border border-border/80 bg-card p-4 ring-1 ring-foreground/5";

export const appTableEmpty =
  "rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground";

export const appTableSectionBar = "border-b border-border bg-muted p-4";

export const appTableCardHeader =
  "space-y-1 border-b border-border bg-muted px-6 py-5";

export const appTableStatusPanel =
  "rounded-md border border-border/80 bg-muted p-3";

export const appTableRowHover = "hover:bg-muted";

export const appTableRowExpanded = "border-b border-border bg-muted";

export const appTableRowSelected = "bg-muted";

export const appTableRowAccent = "bg-accent";

export const appTableRowSecondary = "bg-secondary";

export const appTableRowOdd = "odd:bg-secondary";

export const appTableRowInBatch =
  "bg-secondary text-muted-foreground opacity-[0.88]";

export const appTableRowBatchSelected =
  "bg-accent text-foreground shadow-[inset_3px_0_0_var(--primary)]";

export const appTableCellNote =
  "rounded-md border border-border bg-muted px-2 py-1.5 text-center text-[11px] leading-snug text-muted-foreground";

export const appTableCellNoteDashed =
  "rounded-md border border-dashed border-border bg-secondary px-2 py-1.5 text-center text-[11px] leading-snug text-muted-foreground";

export const appTableCollapsibleSection =
  "overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm ring-1 ring-foreground/5";

export const appTableCollapsibleTrigger =
  "flex w-full items-center gap-3 bg-muted px-3 py-3 text-left transition-colors hover:bg-accent";

export const appTableChargesCell = "rounded-md border border-border bg-muted p-2";

export const appTableTimelineCard = "rounded-lg border border-border bg-muted p-3";

export const appTableVariantRowCurrent = "bg-primary/10";

export const appTableChartHead =
  "border-b border-border/70 bg-muted px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export const appTableChartRowEven = "bg-card";

export const appTableChartRowOdd = "bg-muted";

/** @deprecated Use appTable* exports; kept for existing imports. */
export const dashItemsTableShell = appTableShell;
export const dashItemsTableScroll = appTableScroll;
export const dashItemsTableHead = appTableHead;
export const dashItemsTableHeadPlain = appTableHeadPlain;
export const dashItemsTableToolbar = appTableToolbar;
export const dashItemsTableFilterPanel = appTableFilterPanel;
export const dashItemsTableEmpty = appTableEmpty;
export const dashItemsTableSectionBar = appTableSectionBar;
export const dashItemsTableCardHeader = appTableCardHeader;
export const dashItemsTableStatusPanel = appTableStatusPanel;
export const dashItemsTableRowHover = appTableRowHover;
export const dashItemsTableRowExpanded = appTableRowExpanded;
export const dashItemsTableRowInBatch = appTableRowInBatch;
export const dashItemsTableRowBatchSelected = appTableRowBatchSelected;
export const dashItemsTableCellNote = appTableCellNote;
export const dashItemsTableCellNoteDashed = appTableCellNoteDashed;
export const dashItemsCollapsibleSection = appTableCollapsibleSection;
export const dashItemsCollapsibleTrigger = appTableCollapsibleTrigger;
export const dashItemsChargesCell = appTableChargesCell;
export const dashItemsTimelineCard = appTableTimelineCard;
export const dashItemsVariantRowCurrent = appTableVariantRowCurrent;
