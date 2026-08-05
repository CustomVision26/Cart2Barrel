"use client";

import { CreditCard, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { refundOrderLineAction } from "@/actions/refund-order-line";
import {
  listMerchandiseTopupRefundablesAction,
  refundMerchandiseTopupAction,
} from "@/actions/refund-merchandise-topup";
import type { MerchandiseTopupRefundableView } from "@/data/merchandise-topup-refund";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

export type AdminBatchRefundLine = {
  orderItemId: string;
  productLabel: string;
  linePriceCents: number;
  refundedCents: number;
};

function parseRefundAmountCents(raw: string): number | null {
  const parsed = Number.parseInt(raw.replace(/[, _]/g, "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}

/** Batch-header refund entry — lists every refundable line in the batch once. */
export function AdminBatchRefundButton({
  lines,
  batchLabel,
  triggerLabel = "Refund line",
}: {
  lines: AdminBatchRefundLine[];
  batchLabel: string;
  triggerLabel?: string;
}) {
  const refundableLines = useMemo(
    () =>
      lines
        .map((line) => ({
          ...line,
          refundableCents: Math.max(0, line.linePriceCents - line.refundedCents),
        }))
        .filter((line) => line.refundableCents > 0),
    [lines],
  );

  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [amountByItemId, setAmountByItemId] = useState<Record<string, string>>(
    {},
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [topups, setTopups] = useState<MerchandiseTopupRefundableView[]>([]);
  const [selectedTopupIds, setSelectedTopupIds] = useState<Set<string>>(
    new Set(),
  );
  const [topupAmountById, setTopupAmountById] = useState<Record<string, string>>(
    {},
  );
  const [loadingTopups, setLoadingTopups] = useState(false);
  const router = useRouter();

  const loadTopups = useCallback(async (orderItemIds: string[]) => {
    setLoadingTopups(true);
    try {
      const res = await listMerchandiseTopupRefundablesAction({ orderItemIds });
      if (!res.ok) {
        setTopups([]);
        setSelectedTopupIds(new Set());
        setTopupAmountById({});
        return;
      }
      setTopups(res.topups);
      setSelectedTopupIds(new Set(res.topups.map((t) => t.paymentId)));
      setTopupAmountById(
        Object.fromEntries(
          res.topups.map((t) => [t.paymentId, String(t.refundableCents)]),
        ),
      );
    } finally {
      setLoadingTopups(false);
    }
  }, []);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setConfirmOpen(false);
      setTopups([]);
      setSelectedTopupIds(new Set());
      return;
    }
    setReason("");
    setSelectedIds(new Set(refundableLines.map((l) => l.orderItemId)));
    setAmountByItemId(
      Object.fromEntries(
        refundableLines.map((l) => [l.orderItemId, String(l.refundableCents)]),
      ),
    );
    void loadTopups(lines.map((l) => l.orderItemId));
  };

  const selectedLines = useMemo(
    () => refundableLines.filter((l) => selectedIds.has(l.orderItemId)),
    [refundableLines, selectedIds],
  );

  const parsedSelected = useMemo(() => {
    return selectedLines.map((line) => {
      const parsed = parseRefundAmountCents(
        amountByItemId[line.orderItemId] ?? "",
      );
      const exceeds =
        parsed != null && parsed > line.refundableCents;
      return { line, parsed, exceeds };
    });
  }, [amountByItemId, selectedLines]);

  const selectedTopups = useMemo(
    () => topups.filter((t) => selectedTopupIds.has(t.paymentId)),
    [topups, selectedTopupIds],
  );

  const parsedTopups = useMemo(() => {
    return selectedTopups.map((topup) => {
      const parsed = parseRefundAmountCents(
        topupAmountById[topup.paymentId] ?? "",
      );
      const exceeds =
        parsed != null && parsed > topup.refundableCents;
      return { topup, parsed, exceeds };
    });
  }, [selectedTopups, topupAmountById]);

  const canReview =
    (parsedSelected.length > 0 || parsedTopups.length > 0) &&
    parsedSelected.every((row) => row.parsed != null && !row.exceeds) &&
    parsedTopups.every((row) => row.parsed != null && !row.exceeds);

  const totalCents =
    parsedSelected.reduce((sum, row) => sum + (row.parsed ?? 0), 0) +
    parsedTopups.reduce((sum, row) => sum + (row.parsed ?? 0), 0);

  const submitRefund = useCallback(() => {
    if (!canReview) {
      toast.error("Fix refund amounts before confirming.");
      return;
    }
    startTransition(async () => {
      let okCount = 0;
      let refundedTotal = 0;
      let lastError: string | null = null;
      const expected =
        parsedSelected.filter((r) => r.parsed != null).length +
        parsedTopups.filter((r) => r.parsed != null).length;

      for (const row of parsedSelected) {
        if (row.parsed == null) continue;
        const res = await refundOrderLineAction({
          orderItemId: row.line.orderItemId,
          amountCents: row.parsed,
          reason: reason.trim() || undefined,
        });
        if (res.ok) {
          okCount += 1;
          refundedTotal += row.parsed;
        } else {
          lastError = res.message;
        }
      }

      for (const row of parsedTopups) {
        if (row.parsed == null) continue;
        const res = await refundMerchandiseTopupAction({
          paymentId: row.topup.paymentId,
          topupCheckoutOrderId: row.topup.topupCheckoutOrderId,
          reconciliationIds: row.topup.reconciliationIds,
          amountCents: row.parsed,
          reason: reason.trim() || undefined,
        });
        if (res.ok) {
          okCount += 1;
          refundedTotal += res.refundedCents;
        } else {
          lastError = res.message;
        }
      }

      if (okCount > 0) {
        toast.success(
          okCount === expected ?
            `Refunded ${okCount} charge${okCount === 1 ? "" : "s"} (${formatUsd(refundedTotal)}).`
          : `Refunded ${okCount} of ${expected} charges.${lastError ? ` ${lastError}` : ""}`,
        );
        setConfirmOpen(false);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(lastError ?? "Could not refund batch lines.");
      }
    });
  }, [canReview, parsedSelected, parsedTopups, reason, router]);

  // Still show when merchandise lines are fully refunded but top-ups may remain.
  if (lines.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="whitespace-nowrap"
        onClick={() => onOpenChange(true)}
      >
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(90vh,640px)] max-w-md gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <DialogHeader className="space-y-2 border-b border-border/60 px-6 py-5 text-left">
            <DialogTitle>Issue batch line refunds</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Initiate Stripe refunds for products in batch{" "}
              <span className="font-mono font-medium text-foreground">
                {batchLabel}
              </span>
              . Paid purchase-price top-ups for these products are included when
              available. Each amount cannot exceed that charge&apos;s remaining
              balance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            {refundableLines.map((line) => {
              const checked = selectedIds.has(line.orderItemId);
              const amountStr = amountByItemId[line.orderItemId] ?? "";
              const parsed = parseRefundAmountCents(amountStr);
              const exceeds =
                parsed != null && parsed > line.refundableCents;
              return (
                <div
                  key={line.orderItemId}
                  className="space-y-3 rounded-xl border border-border/80 bg-muted/40 px-4 py-3.5"
                >
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-primary"
                      checked={checked}
                      disabled={pending}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) {
                            next.add(line.orderItemId);
                          } else {
                            next.delete(line.orderItemId);
                          }
                          return next;
                        });
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className="line-clamp-2 text-sm font-medium leading-snug text-foreground"
                        title={line.productLabel}
                      >
                        {line.productLabel.trim() || "Unnamed product"}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Line remainder:{" "}
                        <span className="font-medium tabular-nums text-foreground">
                          {formatUsd(line.refundableCents)}
                        </span>
                        {line.refundedCents > 0 ?
                          <>
                            {" "}
                            · previously refunded{" "}
                            <span className="tabular-nums">
                              {formatUsd(line.refundedCents)}
                            </span>
                          </>
                        : null}
                      </span>
                    </span>
                  </label>
                  {checked ?
                    <div className="space-y-2 pl-6">
                      <Label htmlFor={`batch-refund-${line.orderItemId}`}>
                        Refund amount (USD cents)
                      </Label>
                      <Input
                        id={`batch-refund-${line.orderItemId}`}
                        inputMode="numeric"
                        value={amountStr}
                        onChange={(e) =>
                          setAmountByItemId((prev) => ({
                            ...prev,
                            [line.orderItemId]: e.target.value,
                          }))
                        }
                        disabled={pending}
                        className="tabular-nums"
                        aria-invalid={exceeds}
                      />
                      <p
                        className={cn(
                          "text-xs leading-relaxed",
                          exceeds ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        Maximum {line.refundableCents.toLocaleString()}¢ (
                        {formatUsd(line.refundableCents)}).
                      </p>
                    </div>
                  : null}
                </div>
              );
            })}

            {loadingTopups ?
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                Checking for paid top-up add-ons…
              </p>
            : null}

            {topups.map((topup, index) => {
              const checked = selectedTopupIds.has(topup.paymentId);
              const amountStr = topupAmountById[topup.paymentId] ?? "";
              const parsed = parseRefundAmountCents(amountStr);
              const exceeds =
                parsed != null && parsed > topup.refundableCents;
              // List is newest-first (paidAt desc): index 0 = latest.
              const installmentLabel =
                topups.length === 1 ? "Top-up payment"
                : index === 0 ? "Latest top-up payment"
                : topups.length - index === 1 ? "1st top-up payment"
                : `${topups.length - index}${
                    topups.length - index === 2 ? "nd"
                    : topups.length - index === 3 ? "rd"
                    : "th"
                  } top-up payment`;
              return (
                <div
                  key={topup.paymentId}
                  className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3.5"
                >
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-primary"
                      checked={checked}
                      disabled={pending}
                      onChange={(e) => {
                        setSelectedTopupIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) {
                            next.add(topup.paymentId);
                          } else {
                            next.delete(topup.paymentId);
                          }
                          return next;
                        });
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2">
                        <CreditCard
                          className="mt-0.5 size-3.5 shrink-0 text-emerald-400"
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="block text-[11px] font-medium uppercase tracking-wide text-emerald-400/90">
                            {installmentLabel}
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-foreground">
                            {topup.productName}
                          </span>
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Top-up #{" "}
                        <span className="font-mono text-foreground">
                          {topup.topupNumber}
                        </span>
                        {" · "}
                        Remainder{" "}
                        <span className="font-medium tabular-nums text-foreground">
                          {formatUsd(topup.refundableCents)}
                        </span>
                        {topup.refundedCents > 0 ?
                          <>
                            {" "}
                            · previously refunded{" "}
                            <span className="tabular-nums">
                              {formatUsd(topup.refundedCents)}
                            </span>
                          </>
                        : null}
                      </span>
                      <span
                        className="mt-0.5 block font-mono text-[11px] text-muted-foreground"
                        title={topup.topupCheckoutOrderId}
                      >
                        Top-up order # {topup.topupCheckoutOrderId.slice(0, 8)}…
                      </span>
                    </span>
                  </label>
                  {checked ?
                    <div className="space-y-2 pl-6">
                      <Label htmlFor={`batch-topup-refund-${topup.paymentId}`}>
                        Top-up refund amount (USD cents)
                      </Label>
                      <Input
                        id={`batch-topup-refund-${topup.paymentId}`}
                        inputMode="numeric"
                        value={amountStr}
                        onChange={(e) =>
                          setTopupAmountById((prev) => ({
                            ...prev,
                            [topup.paymentId]: e.target.value,
                          }))
                        }
                        disabled={pending}
                        className="tabular-nums"
                        aria-invalid={exceeds}
                      />
                      <p
                        className={cn(
                          "text-xs leading-relaxed",
                          exceeds ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        Maximum {topup.refundableCents.toLocaleString()}¢ (
                        {formatUsd(topup.refundableCents)}). Refunded from this
                        top-up checkout payment.
                      </p>
                    </div>
                  : null}
                </div>
              );
            })}

            <div className="space-y-2">
              <Label htmlFor="batch-refund-reason">
                Internal reason (optional)
              </Label>
              <Input
                id="batch-refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                placeholder="For example: customer request, out of stock"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-border/60 px-6 py-4 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !canReview}
              onClick={() => {
                if (!canReview) {
                  toast.error("Select at least one charge with a valid amount.");
                  return;
                }
                setConfirmOpen(true);
              }}
            >
              Review refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Stripe batch refund?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm leading-relaxed">
              <span className="block">
                You are about to issue refunds totaling{" "}
                <span className="font-medium text-foreground">
                  {formatUsd(totalCents)}
                </span>{" "}
                (
                {parsedSelected.length} product{" "}
                {parsedSelected.length === 1 ? "line" : "lines"}
                {parsedTopups.length > 0 ?
                  <>
                    {" "}
                    + {parsedTopups.length} top-up{" "}
                    {parsedTopups.length === 1 ? "add-on" : "add-ons"}
                  </>
                : null}
                ) in batch{" "}
                <span className="font-mono font-medium text-foreground">
                  {batchLabel}
                </span>
                . This is processed through Stripe and cannot be undone from this
                screen.
              </span>
              {reason.trim() ?
                <span className="block">
                  Internal reason:{" "}
                  <span className="font-medium text-foreground">
                    {reason.trim()}
                  </span>
                </span>
              : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={<Button type="button" variant="outline" disabled={pending} />}
            >
              Go back
            </AlertDialogCancel>
            <AlertDialogAction
              render={<Button type="button" disabled={pending} />}
              onClick={(event) => {
                event.preventDefault();
                submitRefund();
              }}
            >
              {pending ?
                <>
                  <Loader2Icon
                    className="mr-1.5 size-3.5 animate-spin"
                    aria-hidden
                  />
                  Processing…
                </>
              : "Issue refunds"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
