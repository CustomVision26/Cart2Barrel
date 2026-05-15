"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitCustomerRefundRequestAction } from "@/actions/submit-customer-refund-request";
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
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import { formatUsd } from "@/lib/admin-markup";
import {
  orderLineFulfillmentAllowsRefundWorkflow,
  refundableLineRemainderCents,
} from "@/lib/order-line-refund-eligibility";
import { ORDER_ITEM_REFUND_REASON_KIND_VALUES } from "@/lib/validations/order-item-refund-request";

function reasonUiLabel(kind: (typeof ORDER_ITEM_REFUND_REASON_KIND_VALUES)[number]) {
  switch (kind) {
    case "defective_or_damaged":
      return "Defective or damaged merchandise";
    case "wrong_item":
      return "Wrong item";
    case "not_received":
      return "Never received";
    case "not_as_described":
      return "Not as described";
    case "duplicate_charge":
      return "Duplicate charge";
    case "changed_mind":
      return "Changed mind / cancel purchase";
    case "other":
      return "Other";
    default: {
      const _e: never = kind;
      return _e;
    }
  }
}

export function DashboardRequestRefundDialog({ row }: { row: DashboardPaidOrderLineRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reasonKind, setReasonKind] = useState<(typeof ORDER_ITEM_REFUND_REASON_KIND_VALUES)[number]>(
    ORDER_ITEM_REFUND_REASON_KIND_VALUES[0]!
  );
  const [details, setDetails] = useState("");
  const [fullLine, setFullLine] = useState(true);
  const [partialUsd, setPartialUsd] = useState("");
  const [confirmPolicy, setConfirmPolicy] = useState(false);
  const [pending, startTransition] = useTransition();

  const refundableRemainder = refundableLineRemainderCents(row.orderItem.price, row.refundedCents);
  const canRequestRefund =
    orderLineFulfillmentAllowsRefundWorkflow(row.orderItem, row.order)
    && refundableRemainder >= 1
    && !row.pendingRefundRequest;

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setDetails("");
      setFullLine(true);
      setPartialUsd("");
      setConfirmPolicy(false);
    }
  }, []);

  const submit = useCallback(() => {
    startTransition(async () => {
      const res = await submitCustomerRefundRequestAction({
        orderItemId: row.orderItem.id,
        reasonKind,
        details,
        refundFullLineRemainder: fullLine,
        requestedAmountUsd: fullLine ? undefined : partialUsd,
        acknowledgeProcessing: true,
      });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }, [
    details,
    fullLine,
    partialUsd,
    reasonKind,
    row.orderItem.id,
    router,
  ]);

  if (!canRequestRefund) {
    return null;
  }

  const productTitle = row.request.productName?.trim() || "Unnamed product";
  const orderId = row.order.id;
  const batchDisplay =
    row.resolvedBatchNumber?.trim()
      ? row.resolvedBatchNumber.trim()
      : row.resolvedBatchSessionId?.trim()
        ? `Session ${row.resolvedBatchSessionId.trim().slice(0, 8)}…`
        : null;

  const detailsLen = details.trim().length;
  const detailsNeed = Math.max(0, 40 - detailsLen);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="whitespace-nowrap"
        onClick={() => onOpenChange(true)}
      >
        Request refund
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request a refund</DialogTitle>
            <DialogDescription>
              Staff reviews every refund before money is released. Explain enough that we can match
              your case to policy for this shipment stage.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <dl className="grid gap-2 text-foreground">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Product
                </dt>
                <dd className="mt-0.5 font-medium leading-snug">{productTitle}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Order number
                </dt>
                <dd className="mt-0.5 break-all font-mono text-xs" title={orderId}>
                  {orderId}
                </dd>
              </div>
              {batchDisplay ?
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Batch
                  </dt>
                  <dd className="mt-0.5 font-medium">{batchDisplay}</dd>
                  {row.resolvedBatchSessionId?.trim() && row.resolvedBatchNumber?.trim() ?
                    <dd
                      className="mt-1 break-all font-mono text-[10px] text-muted-foreground"
                      title={row.resolvedBatchSessionId.trim()}
                    >
                      ID {row.resolvedBatchSessionId.trim()}
                    </dd>
                  : null}
                </div>
              : null}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Remaining refundable (this line)
                </dt>
                <dd className="mt-0.5 font-semibold tabular-nums">
                  {formatUsd(refundableRemainder)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dash-refund-reason">Primary reason</Label>
              <select
                id="dash-refund-reason"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={pending}
                value={reasonKind}
                onChange={(e) =>
                  setReasonKind(
                    e.target.value as (typeof ORDER_ITEM_REFUND_REASON_KIND_VALUES)[number],
                  )
                }
              >
                {ORDER_ITEM_REFUND_REASON_KIND_VALUES.map((k) => (
                  <option key={k} value={k}>
                    {reasonUiLabel(k)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dash-refund-details">What happened?</Label>
              <textarea
                id="dash-refund-details"
                rows={6}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Explain the issue clearly (photos may be emailed separately when staff replies). Minimum 40 characters."
                disabled={pending}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
              <p
                className={
                  detailsLen >= 40
                    ? "text-xs font-medium text-emerald-700 dark:text-emerald-400"
                    : "text-xs font-medium text-amber-800 dark:text-amber-200"
                }
              >
                {detailsLen >= 40
                  ? `${detailsLen} characters · ready to submit`
                  : `${detailsLen}/40 · add ${detailsNeed} more character${detailsNeed === 1 ? "" : "s"} to enable Submit`}
              </p>
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-sm font-medium text-foreground">Refund amount preference</p>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  className="mt-1 accent-primary"
                  checked={fullLine}
                  disabled={pending}
                  onChange={() => setFullLine(true)}
                />
                <span className="text-sm leading-snug text-foreground">
                  Full refundable amount on this line ({formatUsd(refundableRemainder)}).
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  className="mt-1 accent-primary"
                  checked={!fullLine}
                  disabled={pending}
                  onChange={() => setFullLine(false)}
                />
                <span className="flex-1 text-sm leading-snug text-foreground">
                  Partial amount (USD, including cents)
                  {!fullLine ?
                    <>
                      {" "}
                      <Input
                        className="mt-2 tabular-nums"
                        inputMode="decimal"
                        placeholder="e.g. 42.75"
                        disabled={pending}
                        value={partialUsd}
                        onChange={(e) => setPartialUsd(e.target.value)}
                      />
                    </>
                  : null}
                </span>
              </label>
            </div>

            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                checked={confirmPolicy}
                disabled={pending}
                onChange={(e) => setConfirmPolicy(e.target.checked)}
              />
              <span className="text-sm leading-snug text-muted-foreground">
                I understand Cart2Barrel must approve this request before Stripe can send money
                back to my payment method, and I may receive a Stripe refund receipt afterward.
              </span>
            </label>

          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || !confirmPolicy || detailsLen < 40}
              title={
                detailsLen < 40
                  ? `Explain in at least 40 characters (${detailsNeed} more needed).`
                : !confirmPolicy
                  ? "Confirm the acknowledgement above."
                  : undefined
              }
              onClick={submit}
            >
              {pending ? "Submitting…" : "Submit refund request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
