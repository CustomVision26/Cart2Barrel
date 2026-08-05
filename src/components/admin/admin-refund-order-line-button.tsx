"use client";

import { CreditCard, Loader2Icon } from "lucide-react";
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

function parseRefundAmountCents(raw: string): number | null {
  const parsed = Number.parseInt(raw.replace(/[, _]/g, "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}

export function AdminRefundOrderLineButton({
  orderItemId,
  linePriceCents,
  refundedCents,
  productLabel,
  triggerLabel = "Refund line",
}: {
  orderItemId: string;
  linePriceCents: number;
  refundedCents: number;
  productLabel: string;
  triggerLabel?: string;
}) {
  const refundableCents = Math.max(0, linePriceCents - refundedCents);
  const displayProductLabel = productLabel.trim() || "Unnamed product";
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [amountStr, setAmountStr] = useState(String(refundableCents));
  const [includeLine, setIncludeLine] = useState(true);
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

  const selectedTopups = useMemo(
    () => topups.filter((t) => selectedTopupIds.has(t.paymentId)),
    [topups, selectedTopupIds],
  );

  const parsedAmountCents = useMemo(
    () => parseRefundAmountCents(amountStr),
    [amountStr],
  );

  const parsedTopups = useMemo(() => {
    return selectedTopups.map((topup) => {
      const parsed = parseRefundAmountCents(
        topupAmountById[topup.paymentId] ?? "",
      );
      const exceeds = parsed != null && parsed > topup.refundableCents;
      return { topup, parsed, exceeds };
    });
  }, [selectedTopups, topupAmountById]);

  const amountExceedsRemainder =
    includeLine &&
    parsedAmountCents != null &&
    parsedAmountCents > refundableCents;

  const loadTopups = useCallback(async () => {
    setLoadingTopups(true);
    try {
      const res = await listMerchandiseTopupRefundablesAction({
        orderItemIds: [orderItemId],
      });
      if (!res.ok || res.topups.length === 0) {
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
  }, [orderItemId]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setConfirmOpen(false);
      setTopups([]);
      setSelectedTopupIds(new Set());
      return;
    }
    setAmountStr(String(refundableCents));
    setIncludeLine(refundableCents > 0);
    setReason("");
    void loadTopups();
  };

  const canReview =
    ((includeLine &&
      refundableCents > 0 &&
      parsedAmountCents != null &&
      !amountExceedsRemainder) ||
      (!includeLine && selectedTopups.length > 0)) &&
    parsedTopups.every((row) => row.parsed != null && !row.exceeds) &&
    (includeLine || selectedTopups.length > 0) &&
    !(includeLine && refundableCents <= 0);

  const totalPreviewCents =
    (includeLine && parsedAmountCents != null ? parsedAmountCents : 0) +
    parsedTopups.reduce((sum, row) => sum + (row.parsed ?? 0), 0);

  const submitRefund = useCallback(() => {
    if (!canReview) {
      toast.error("Fix refund amounts before confirming.");
      return;
    }

    startTransition(async () => {
      let okCount = 0;
      let lastError: string | null = null;
      let refundedTotal = 0;

      if (includeLine && parsedAmountCents != null && refundableCents > 0) {
        const res = await refundOrderLineAction({
          orderItemId,
          amountCents: parsedAmountCents,
          reason: reason.trim() || undefined,
        });
        if (res.ok) {
          okCount += 1;
          refundedTotal += parsedAmountCents;
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
        toast.success(`Refunded ${formatUsd(refundedTotal)}.`);
        setConfirmOpen(false);
        setOpen(false);
      } else {
        toast.error(lastError ?? "Could not process refund.");
      }
    });
  }, [
    canReview,
    includeLine,
    orderItemId,
    parsedAmountCents,
    parsedTopups,
    reason,
    refundableCents,
  ]);

  const onReviewRefund = () => {
    if (!canReview) {
      toast.error("Select a valid refund amount.");
      return;
    }
    setConfirmOpen(true);
  };

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
            <DialogTitle>Issue line refund</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Initiate a Stripe refund for this order line and any paid
              purchase-price top-up installments. Amounts cannot exceed each
              charge&apos;s remaining balance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-5">
            {refundableCents > 0 ?
              <div className="space-y-3 rounded-xl border border-border/80 bg-muted/40 px-4 py-3.5">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-primary"
                    checked={includeLine}
                    disabled={pending}
                    onChange={(e) => setIncludeLine(e.target.checked)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Product
                    </span>
                    <span
                      className="mt-1 block line-clamp-2 text-sm font-medium leading-snug text-foreground"
                      title={displayProductLabel}
                    >
                      {displayProductLabel}
                    </span>
                    <span className="mt-2 block text-xs text-muted-foreground">
                      Line remainder:{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {formatUsd(refundableCents)}
                      </span>
                      {refundedCents > 0 ?
                        <>
                          {" "}
                          · previously refunded{" "}
                          <span className="tabular-nums">
                            {formatUsd(refundedCents)}
                          </span>
                        </>
                      : null}
                    </span>
                  </span>
                </label>
                {includeLine ?
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="refund-cents">Refund amount (USD cents)</Label>
                    <Input
                      id="refund-cents"
                      inputMode="numeric"
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      disabled={pending}
                      className="tabular-nums"
                      aria-invalid={amountExceedsRemainder}
                    />
                    <p
                      className={cn(
                        "text-xs leading-relaxed",
                        amountExceedsRemainder ?
                          "text-destructive"
                        : "text-muted-foreground",
                      )}
                    >
                      Maximum refundable: {refundableCents.toLocaleString()}¢ (
                      {formatUsd(refundableCents)}).
                    </p>
                  </div>
                : null}
              </div>
            : null}

            {loadingTopups ?
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                Checking for paid top-up add-ons…
              </p>
            : null}

            {topups.map((topup, index) => {
              const selected = selectedTopupIds.has(topup.paymentId);
              const parsed = parseRefundAmountCents(
                topupAmountById[topup.paymentId] ?? "",
              );
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
                      checked={selected}
                      disabled={pending}
                      onChange={(e) => {
                        setSelectedTopupIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(topup.paymentId);
                          else next.delete(topup.paymentId);
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
                          <span className="mt-0.5 block text-sm font-medium text-foreground">
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
                        {topup.paidAt ?
                          <>
                            {" · "}
                            Paid{" "}
                            {new Date(topup.paidAt).toLocaleString()}
                          </>
                        : null}
                      </span>
                      <span
                        className="mt-0.5 block font-mono text-[10px] text-muted-foreground"
                        title={topup.topupCheckoutOrderId}
                      >
                        Top-up order # {topup.topupCheckoutOrderId.slice(0, 8)}…
                      </span>
                    </span>
                  </label>
                  {selected ?
                    <div className="space-y-2 pl-6">
                      <Label htmlFor={`topup-refund-${topup.paymentId}`}>
                        Top-up refund amount (USD cents)
                      </Label>
                      <Input
                        id={`topup-refund-${topup.paymentId}`}
                        inputMode="numeric"
                        value={topupAmountById[topup.paymentId] ?? ""}
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
                          exceeds ?
                            "text-destructive"
                          : "text-muted-foreground",
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

            {!loadingTopups &&
            refundableCents <= 0 &&
            topups.length === 0 ?
              <p className="text-sm text-muted-foreground">
                Nothing left to refund on this line or its top-up add-ons.
              </p>
            : null}

            <div className="space-y-2">
              <Label htmlFor="refund-reason">Internal reason (optional)</Label>
              <Input
                id="refund-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                placeholder="For example: customer request, out of stock"
              />
              <p className="text-xs text-muted-foreground">
                Stored for staff reference only. Not shown to the customer.
              </p>
            </div>

            {totalPreviewCents > 0 ?
              <p className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Refund total</span>
                <span className="ml-2 font-semibold tabular-nums text-foreground">
                  {formatUsd(totalPreviewCents)}
                </span>
              </p>
            : null}
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
              onClick={onReviewRefund}
            >
              Review refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Stripe refund?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm leading-relaxed">
              <span className="block">
                You are about to issue a refund of{" "}
                <span className="font-medium text-foreground">
                  {formatUsd(totalPreviewCents)}
                </span>{" "}
                for{" "}
                <span className="font-medium text-foreground">
                  {displayProductLabel}
                </span>
                {selectedTopups.length > 0 ?
                  ` (including ${selectedTopups.length} top-up payment${selectedTopups.length === 1 ? "" : "s"})`
                : null}
                . This action is processed through Stripe and cannot be undone
                from this screen.
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
                  <Loader2Icon className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                  Processing…
                </>
              : "Issue refund"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
