"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { formatUsd } from "@/lib/admin-markup";
import {
  reconciliationChargeTotalCents,
  reconciliationComponentDeltaRows,
  type ReconciliationChargeBreakdown,
} from "@/lib/merchandise-reconciliation";
import { cn } from "@/lib/utils";

type MerchandiseTopupAmountBreakdownToggleProps = {
  /** Row label shown on the left (e.g. "Top-up add-on", "Still due"). */
  label: ReactNode;
  /** Signed or absolute amount shown on the right. */
  amountCents: number;
  /** When true, render amount as +/− relative figure. */
  signed?: boolean;
  amountClassName?: string;
  labelClassName?: string;
  checkout: ReconciliationChargeBreakdown;
  actual: ReconciliationChargeBreakdown;
  /**
   * Prior paid top-up cents. With mode="due", panel shows
   * gross difference − paid = this figure.
   */
  paidTopupCents?: number;
  /**
   * Earlier top-up payment(s) inside a paid total (mode="paid").
   * When set, expands Previous / This top-up lines like the paid thank-you note.
   */
  priorPaidInstallmentCents?: number;
  /**
   * Nested breakdown under the 1st / previous top-up line:
   * - paid: Gross + Top-up add-on paid (admin paid card)
   * - due: Gross + Already paid + Still due (customer amount-due style)
   */
  firstInstallmentBreakdownMode?: "paid" | "due";
  /** Original merchandise checkout subtotal (mode="paid" totals block). */
  checkoutSubtotalCents?: number;
  /** Checkout + all paid top-ups (mode="paid" totals block). */
  newTotalCents?: number;
  /**
   * Remaining vs new total (mode="paid"). Nested under Top-up payments
   * as Balance / Still due / Over paid.
   */
  balanceCents?: number;
  /** Show the nested balance breakdown under Top-up payments. */
  showBalanceBreakdown?: boolean;
  /**
   * - due: remaining after prior paid top-up(s)
   * - paid: a collected top-up add-on amount
   */
  mode?: "due" | "paid";
  /** Optional footnote under the expanded panel. */
  footnote?: string;
  className?: string;
  defaultOpen?: boolean;
};

function NestedChevronPanel({
  label,
  amountText,
  amountClassName,
  defaultOpen = false,
  children,
}: {
  label: string;
  amountText: string;
  amountClassName?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="min-w-0 text-muted-foreground">{label}</span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background/60 text-muted-foreground transition-colors",
              "hover:border-border hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              open && "border-primary/40 bg-primary/10 text-foreground",
            )}
            title={open ? "Hide charge breakdown" : "Show charge breakdown"}
          >
            <ChevronDownIcon
              className={cn(
                "size-3.5 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden
            />
            <span className="sr-only">
              {open ? "Hide" : "Show"} {label} breakdown
            </span>
          </button>
        </div>
        <span
          className={cn(
            "shrink-0 font-medium tabular-nums text-foreground",
            amountClassName,
          )}
        >
          {amountText}
        </span>
      </div>
      {open ?
        <div
          id={panelId}
          className="space-y-1 rounded-md border border-border/50 bg-background/40 px-2.5 py-2"
        >
          {children}
        </div>
      : null}
    </div>
  );
}

function ComponentDeltaList({
  rows,
}: {
  rows: ReturnType<typeof reconciliationComponentDeltaRows>;
}) {
  return (
    <ul className="space-y-1">
      {rows.map((row) => (
        <li
          key={row.key}
          className="flex justify-between gap-3 text-muted-foreground"
        >
          <span>
            {row.label}
            <span className="ml-1 tabular-nums opacity-70">
              ({formatUsd(row.checkoutCents)} → {formatUsd(row.actualCents)})
            </span>
          </span>
          <span
            className={cn(
              "tabular-nums font-medium",
              row.deltaCents > 0 && "text-rose-300",
              row.deltaCents < 0 && "text-sky-300",
              row.deltaCents === 0 && "text-foreground",
            )}
          >
            {row.deltaCents >= 0 ? "+" : "−"}
            {formatUsd(Math.abs(row.deltaCents))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Toggle row: amount on the right; expands to S&H / shipping / tax / merch deltas.
 */
export function MerchandiseTopupAmountBreakdownToggle({
  label,
  amountCents,
  signed = false,
  amountClassName,
  labelClassName,
  checkout,
  actual,
  paidTopupCents = 0,
  priorPaidInstallmentCents = 0,
  firstInstallmentBreakdownMode = "paid",
  checkoutSubtotalCents,
  newTotalCents,
  balanceCents,
  showBalanceBreakdown = false,
  mode = "due",
  footnote,
  className,
  defaultOpen = false,
}: MerchandiseTopupAmountBreakdownToggleProps) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const rows = reconciliationComponentDeltaRows(checkout, actual);
  const grossDelta =
    reconciliationChargeTotalCents(actual) -
    reconciliationChargeTotalCents(checkout);
  const paid = Math.max(0, paidTopupCents);
  const absAmount = Math.abs(amountCents);
  const priorInstallment = Math.max(0, priorPaidInstallmentCents);
  const latestInstallment = Math.max(0, absAmount - priorInstallment);
  const showPaidInstallments =
    mode === "paid" &&
    priorInstallment > 0 &&
    latestInstallment > 0 &&
    priorInstallment < absAmount;
  const stillDueAfterFirst = Math.max(0, grossDelta - priorInstallment);
  const showPaidTotalsBlock =
    mode === "paid" &&
    checkoutSubtotalCents != null &&
    newTotalCents != null;
  const balance = balanceCents ?? 0;
  const balanceAbs = Math.abs(balance);
  const balanceLabel =
    balance > 0 ? "Still due" : balance < 0 ? "Over paid" : "Balance";
  const balanceText = `${balance >= 0 ? "+" : "−"}${formatUsd(balanceAbs)}`;
  const amountText =
    signed ?
      `${amountCents >= 0 ? "+" : "−"}${formatUsd(absAmount)}`
    : formatUsd(absAmount);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className={cn("min-w-0", labelClassName)}>{label}</span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background/60 text-muted-foreground transition-colors",
              "hover:border-border hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              open && "border-primary/40 bg-primary/10 text-foreground",
            )}
            title={open ? "Hide charge breakdown" : "Show charge breakdown"}
          >
            <ChevronDownIcon
              className={cn(
                "size-3.5 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden
            />
            <span className="sr-only">
              {open ? "Hide" : "Show"} charge breakdown
            </span>
          </button>
        </div>
        <span
          className={cn(
            "shrink-0 font-medium tabular-nums text-foreground",
            amountClassName,
          )}
        >
          {amountText}
        </span>
      </div>

      {open ?
        <div
          id={panelId}
          className="space-y-2 rounded-md border border-border/50 bg-background/50 px-2.5 py-2 text-xs"
        >
          {showPaidTotalsBlock ?
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                Top-up payments
              </p>
              <ul className="space-y-1">
                <li className="flex justify-between gap-3 text-muted-foreground">
                  <span>Original checkout subtotal</span>
                  <span className="tabular-nums text-foreground">
                    {formatUsd(checkoutSubtotalCents)}
                  </span>
                </li>
              </ul>

              {/* 1st / previous top-up — expandable like image 3 (paid) or image 2 (due) */}
              {showPaidInstallments ?
                <NestedChevronPanel
                  label="Previous top-up add-on"
                  amountText={formatUsd(priorInstallment)}
                >
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    What makes up this figure
                  </p>
                  <ComponentDeltaList rows={rows} />
                  <div className="mt-1.5 space-y-1 border-t border-border/50 pt-1.5">
                    <div className="flex justify-between gap-3 font-medium text-foreground">
                      <span>Gross difference</span>
                      <span className="tabular-nums">
                        {grossDelta >= 0 ? "+" : "−"}
                        {formatUsd(Math.abs(grossDelta))}
                      </span>
                    </div>
                    {firstInstallmentBreakdownMode === "due" ?
                      <>
                        <div className="flex justify-between gap-3 text-muted-foreground">
                          <span>Already paid (top-up)</span>
                          <span className="tabular-nums">
                            −{formatUsd(priorInstallment)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3 font-semibold text-foreground">
                          <span>Still due</span>
                          <span className="tabular-nums">
                            +{formatUsd(stillDueAfterFirst)}
                          </span>
                        </div>
                      </>
                    : <div className="flex justify-between gap-3 font-semibold text-foreground">
                        <span>Top-up add-on paid</span>
                        <span className="tabular-nums">
                          {formatUsd(priorInstallment)}
                        </span>
                      </div>
                    }
                  </div>
                  {firstInstallmentBreakdownMode === "due" ?
                    <p className="pt-0.5 text-[10px] text-muted-foreground">
                      Difference: +{formatUsd(Math.abs(grossDelta))} · already
                      paid {formatUsd(priorInstallment)}.
                    </p>
                  : null}
                </NestedChevronPanel>
              : null}

              {/* Latest / only top-up installment */}
              <NestedChevronPanel
                label={
                  showPaidInstallments ?
                    "This top-up add-on"
                  : "Top-up add-on"
                }
                amountText={formatUsd(
                  showPaidInstallments ? latestInstallment : absAmount,
                )}
              >
                <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                  What makes up this figure
                </p>
                <ComponentDeltaList rows={rows} />
                <div className="mt-1.5 space-y-1 border-t border-border/50 pt-1.5">
                  <div className="flex justify-between gap-3 font-medium text-foreground">
                    <span>Gross difference</span>
                    <span className="tabular-nums">
                      {grossDelta >= 0 ? "+" : "−"}
                      {formatUsd(Math.abs(grossDelta))}
                    </span>
                  </div>
                  {showPaidInstallments ?
                    <>
                      <div className="flex justify-between gap-3 text-muted-foreground">
                        <span>Already paid (previous top-up)</span>
                        <span className="tabular-nums">
                          −{formatUsd(priorInstallment)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3 font-semibold text-foreground">
                        <span>This top-up add-on paid</span>
                        <span className="tabular-nums">
                          {formatUsd(latestInstallment)}
                        </span>
                      </div>
                    </>
                  : <div className="flex justify-between gap-3 font-semibold text-foreground">
                      <span>Top-up add-on paid</span>
                      <span className="tabular-nums">{formatUsd(absAmount)}</span>
                    </div>
                  }
                </div>
              </NestedChevronPanel>

              {/* Circle → breakdown 2: balance under payments */}
              {showBalanceBreakdown ?
                <NestedChevronPanel
                  label={balanceLabel}
                  amountText={balanceText}
                  amountClassName={cn(
                    "font-semibold",
                    balance > 0 && "text-rose-300",
                    balance < 0 && "text-sky-300",
                    balance === 0 && "text-emerald-400",
                  )}
                >
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    What makes up this figure
                  </p>
                  <ComponentDeltaList rows={rows} />
                  <div className="mt-1.5 space-y-1 border-t border-border/50 pt-1.5">
                    <div className="flex justify-between gap-3 font-medium text-foreground">
                      <span>Gross difference</span>
                      <span className="tabular-nums">
                        {grossDelta >= 0 ? "+" : "−"}
                        {formatUsd(Math.abs(grossDelta))}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3 text-muted-foreground">
                      <span>Already paid (top-up)</span>
                      <span className="tabular-nums">−{formatUsd(absAmount)}</span>
                    </div>
                    <div className="flex justify-between gap-3 font-semibold text-foreground">
                      <span>{balanceLabel}</span>
                      <span className="tabular-nums">{balanceText}</span>
                    </div>
                  </div>
                  <p className="pt-0.5 text-[10px] text-muted-foreground">
                    Gross difference minus top-up already paid.
                  </p>
                </NestedChevronPanel>
              : null}

              <div className="flex justify-between gap-3 border-t border-border/50 pt-1.5 font-semibold text-foreground">
                <span>New total</span>
                <span className="tabular-nums">{formatUsd(newTotalCents)}</span>
              </div>
            </div>
          : <>
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                What makes up this figure
              </p>
              <ComponentDeltaList rows={rows} />
              <div className="space-y-1 border-t border-border/50 pt-1.5">
                <div className="flex justify-between gap-3 font-medium text-foreground">
                  <span>Gross difference</span>
                  <span className="tabular-nums">
                    {grossDelta >= 0 ? "+" : "−"}
                    {formatUsd(Math.abs(grossDelta))}
                  </span>
                </div>
                {mode === "due" && paid > 0 ?
                  <>
                    <div className="flex justify-between gap-3 text-muted-foreground">
                      <span>Already paid (top-up)</span>
                      <span className="tabular-nums">−{formatUsd(paid)}</span>
                    </div>
                    <div className="flex justify-between gap-3 font-semibold text-foreground">
                      <span>Still due</span>
                      <span className="tabular-nums">
                        {amountCents >= 0 ? "+" : "−"}
                        {formatUsd(absAmount)}
                      </span>
                    </div>
                  </>
                : mode === "paid" ?
                  <div className="flex justify-between gap-3 font-semibold text-foreground">
                    <span>Top-up add-on paid</span>
                    <span className="tabular-nums">{formatUsd(absAmount)}</span>
                  </div>
                : <div className="flex justify-between gap-3 font-semibold text-foreground">
                    <span>This amount</span>
                    <span className="tabular-nums">{amountText}</span>
                  </div>
                }
              </div>
            </>
          }
          {footnote ?
            <p className="pt-0.5 text-[10px] text-muted-foreground">{footnote}</p>
          : null}
        </div>
      : null}
    </div>
  );
}
