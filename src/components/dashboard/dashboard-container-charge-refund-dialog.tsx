"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelCustomerContainerRefundRequestAction } from "@/actions/cancel-customer-container-refund-request";
import { submitCustomerContainerRefundRequestAction } from "@/actions/submit-customer-container-refund-request";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ContainerLineRefundState } from "@/data/container-line-refund-state";
import type { OrderContainerLineAdmin } from "@/data/order-container-admin";
import { formatUsd } from "@/lib/admin-markup";
import { ORDER_ITEM_REFUND_REASON_KIND_VALUES } from "@/lib/validations/order-item-refund-request";
import type { OrderContainerRefundChargeValue } from "@/lib/validations/order-container-refund-request";

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

const EMPTY_SLICE = {
  pending: null,
  refundedCents: 0,
  remainderCents: 0,
};

export function DashboardContainerChargeRefundDialog({
  line,
  orderId,
  state,
}: {
  line: OrderContainerLineAdmin;
  orderId: string;
  state: ContainerLineRefundState | undefined;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reasonKind, setReasonKind] = useState<
    (typeof ORDER_ITEM_REFUND_REASON_KIND_VALUES)[number]
  >(ORDER_ITEM_REFUND_REASON_KIND_VALUES[0]!);
  const [details, setDetails] = useState("");
  const [confirmPolicy, setConfirmPolicy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [cancelPending, startCancel] = useTransition();

  const containerSlice = state?.container ?? {
    ...EMPTY_SLICE,
    remainderCents: Math.max(0, line.lineTotalCents),
  };
  const packingSlice = state?.packingFee ?? {
    ...EMPTY_SLICE,
    remainderCents: Math.max(0, line.packagingFeeCents),
  };

  const chargeTargets: OrderContainerRefundChargeValue[] = [];
  if (containerSlice.remainderCents >= 1 && !containerSlice.pending) {
    chargeTargets.push("container");
  }
  if (packingSlice.remainderCents >= 1 && !packingSlice.pending) {
    chargeTargets.push("packing_fee");
  }

  const combinedRemainder =
    (chargeTargets.includes("container") ? containerSlice.remainderCents : 0) +
    (chargeTargets.includes("packing_fee") ? packingSlice.remainderCents : 0);
  const anyPending = Boolean(containerSlice.pending || packingSlice.pending);
  const fullyRefunded =
    containerSlice.remainderCents < 1 &&
    packingSlice.remainderCents < 1 &&
    (containerSlice.refundedCents > 0 || packingSlice.refundedCents > 0);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setDetails("");
      setConfirmPolicy(false);
    }
  }, []);

  const submit = useCallback(() => {
    startTransition(async () => {
      const res = await submitCustomerContainerRefundRequestAction({
        orderContainerItemId: line.id,
        chargeTargets,
        reasonKind,
        details,
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
  }, [chargeTargets, details, line.id, reasonKind, router]);

  const cancelPendingRequest = useCallback(() => {
    startCancel(async () => {
      const res = await cancelCustomerContainerRefundRequestAction({
        orderContainerItemId: line.id,
      });
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }, [line.id, router]);

  if (anyPending && chargeTargets.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-medium text-amber-900 dark:text-amber-100">
          Awaiting staff approval
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="whitespace-nowrap"
          disabled={cancelPending}
          onClick={cancelPendingRequest}
        >
          {cancelPending ? "Cancelling…" : "Cancel refund"}
        </Button>
      </div>
    );
  }

  if (fullyRefunded) {
    return (
      <p className="text-[10px] font-medium text-muted-foreground">
        Refunded{" "}
        {formatUsd(containerSlice.refundedCents + packingSlice.refundedCents)}
      </p>
    );
  }

  if (chargeTargets.length === 0) return null;

  const detailsLen = details.trim().length;
  const detailsNeed = Math.max(0, 40 - detailsLen);
  const packingIncluded = chargeTargets.includes("packing_fee");

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
              Staff reviews every refund before money is released. This request covers
              {packingIncluded
                ? " the shipping container and its packing fee."
                : " the shipping container."}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border bg-muted p-3 text-sm">
            <dl className="grid gap-2 text-foreground">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Container
                </dt>
                <dd className="mt-0.5 font-medium leading-snug">
                  {line.nameSnapshot}
                </dd>
              </div>
              {chargeTargets.includes("container") ?
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">Container</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatUsd(containerSlice.remainderCents)}
                  </dd>
                </div>
              : null}
              {packingIncluded ?
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">Packing fee</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatUsd(packingSlice.remainderCents)}
                  </dd>
                </div>
              : null}
              <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total refundable
                </dt>
                <dd className="font-semibold tabular-nums">
                  {formatUsd(combinedRemainder)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Order number
                </dt>
                <dd className="mt-0.5 break-all font-mono text-xs" title={orderId}>
                  {orderId}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor={`dash-container-refund-reason-${line.id}`}>
                Primary reason
              </Label>
              <select
                id={`dash-container-refund-reason-${line.id}`}
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
              <Label htmlFor={`dash-container-refund-details-${line.id}`}>
                What happened?
              </Label>
              <textarea
                id={`dash-container-refund-details-${line.id}`}
                rows={6}
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Explain the issue clearly. Minimum 40 characters."
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

            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                checked={confirmPolicy}
                disabled={pending}
                onChange={(e) => setConfirmPolicy(e.target.checked)}
              />
              <span className="text-sm leading-snug text-muted-foreground">
                I understand Amani Cart2Barrel must approve this request before Stripe can send money
                back to my payment method.
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
