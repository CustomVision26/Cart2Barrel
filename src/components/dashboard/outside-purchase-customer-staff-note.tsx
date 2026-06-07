import {
  outsidePurchaseCustomStaffMessages,
  parseOutsidePurchaseStaffNoteDisplay,
  type OutsidePurchaseStaffNoteField,
} from "@/lib/outside-purchase-staff-note-display";
import { cn } from "@/lib/utils";

type OutsidePurchaseCustomerStaffNoteProps = {
  staffNote: string | null | undefined;
  title?: string;
  /** Hide structured rows already shown elsewhere (e.g. service fee breakdown). */
  excludeFieldLabels?: readonly string[];
  /**
   * Service estimate preview: only custom staff messages (no policy, pricing,
   * or intake lines that duplicate "Your charges" and quote data).
   */
  variant?: "default" | "estimate-preview";
  className?: string;
};

export function OutsidePurchaseCustomerStaffNote({
  staffNote,
  title = "Notes from Cart2Barrel",
  excludeFieldLabels = [],
  variant = "default",
  className,
}: OutsidePurchaseCustomerStaffNoteProps) {
  const trimmed = staffNote?.trim();
  if (!trimmed) return null;

  const parsed = parseOutsidePurchaseStaffNoteDisplay(trimmed);
  const exclude = new Set(excludeFieldLabels);
  const fields = parsed.fields.filter((field) => !exclude.has(field.label));
  const dedupedFields = dedupeStaffNoteFieldsByLabel(fields);

  const freeformParagraphs =
    variant === "estimate-preview" ?
      outsidePurchaseCustomStaffMessages(staffNote)
    : parsed.freeformParagraphs;

  const showPolicy = variant !== "estimate-preview" && parsed.policyNotice != null;
  const showFieldGrid = variant !== "estimate-preview" && dedupedFields.length > 0;
  const hasContent =
    showPolicy || showFieldGrid || freeformParagraphs.length > 0;

  if (!hasContent) return null;

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-border/80 bg-muted/30 px-4 py-3.5 ring-1 ring-foreground/5",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {showPolicy ?
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {parsed.policyNotice}
        </p>
      : null}
      {freeformParagraphs.map((paragraph, index) => (
        <p
          key={`freeform-${index}`}
          className="whitespace-pre-wrap text-sm leading-relaxed text-foreground"
        >
          {paragraph}
        </p>
      ))}
      {showFieldGrid ?
        <StaffNoteFieldGrid fields={dedupedFields} />
      : null}
    </div>
  );
}

function dedupeStaffNoteFieldsByLabel(
  fields: OutsidePurchaseStaffNoteField[],
): OutsidePurchaseStaffNoteField[] {
  const byLabel = new Map<string, OutsidePurchaseStaffNoteField>();
  for (const field of fields) {
    byLabel.set(field.label, field);
  }
  return [...byLabel.values()];
}

function StaffNoteFieldGrid({
  fields,
}: {
  fields: OutsidePurchaseStaffNoteField[];
}) {
  return (
    <dl className="grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-2">
      {fields.map(({ label, value }, index) => (
        <div
          key={`${label}-${index}`}
          className={cn(
            label === "Service & handling" || label === "Receipt note" ?
              "sm:col-span-2"
            : label === "Return service & handling" ?
              "sm:col-span-2"
            : undefined,
          )}
        >
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </dt>
          <dd className="mt-0.5 text-sm leading-snug text-foreground">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
