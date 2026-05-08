"use client";

import { useCallback, useState, useTransition } from "react";

import { confirmCompanyPurchaseAction } from "@/actions/admin-confirm-company-purchase";
import { requestDeliveryForOrderItemAction } from "@/actions/admin-request-delivery";
import { AdminRefundOrderLineButton } from "@/components/admin/admin-refund-order-line-button";
import { Button } from "@/components/ui/button";
import type { OrderItem } from "@/db/schema";

export function AdminOrderLineActions({
  orderItemId,
  fulfillmentStatus,
  linePriceCents,
  refundedCents,
  productLabel,
}: {
  orderItemId: string;
  fulfillmentStatus: OrderItem["fulfillmentStatus"];
  linePriceCents: number;
  refundedCents: number;
  productLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const refundableCents = Math.max(0, linePriceCents - refundedCents);

  const onPurchase = useCallback(() => {
    setFeedback(null);
    startTransition(async () => {
      const res = await confirmCompanyPurchaseAction({ orderItemId });
      setFeedback(res.message);
    });
  }, [orderItemId]);

  if (fulfillmentStatus === "refunded" || refundableCents <= 0) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-xs text-muted-foreground">
          {fulfillmentStatus === "refunded" || refundedCents >= linePriceCents
            ? "Refunded"
            : "—"}
        </span>
        {feedback ? (
          <span className="max-w-[14rem] text-xs text-muted-foreground">
            {feedback}
          </span>
        ) : null}
      </div>
    );
  }

  if (fulfillmentStatus === "paid_pending_company_purchase") {
    return (
      <div className="flex flex-col items-start gap-2">
        <AdminRefundOrderLineButton
          orderItemId={orderItemId}
          linePriceCents={linePriceCents}
          refundedCents={refundedCents}
          productLabel={productLabel}
        />
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={onPurchase}
        >
          {pending ? "Saving…" : "Purchase"}
        </Button>
        {feedback ? (
          <span className="max-w-[14rem] text-xs text-muted-foreground">
            {feedback}
          </span>
        ) : null}
      </div>
    );
  }

  if (fulfillmentStatus === "company_purchase_pending_delivery") {
    const onDelivery = () => {
      setFeedback(null);
      startTransition(async () => {
        const res = await requestDeliveryForOrderItemAction({ orderItemId });
        setFeedback(res.message);
      });
    };
    return (
      <div className="flex flex-col items-start gap-2">
        <AdminRefundOrderLineButton
          orderItemId={orderItemId}
          linePriceCents={linePriceCents}
          refundedCents={refundedCents}
          productLabel={productLabel}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={onDelivery}
        >
          {pending ? "Sending…" : "Request delivery"}
        </Button>
        {feedback ? (
          <span className="max-w-[14rem] text-xs text-muted-foreground">
            {feedback}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <span className="text-xs text-muted-foreground">
      {fulfillmentStatus === "pending_payment" ? "Awaiting payment" : "—"}
    </span>
  );
}
