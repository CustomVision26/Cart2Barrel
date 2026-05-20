"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { acceptDeliveryConditionForBarrelAction } from "@/actions/accept-delivery-condition-for-barrel";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DashboardPaidOrderLineRow } from "@/data/dashboard-order-lines";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import {
  isProblemDeliveryReceiptFulfillment,
  problemDeliveryReceiptStatusLabel,
  problemDeliveryWarehouseCondition,
} from "@/lib/delivery-condition-acceptance";
import { warehouseReceiveConditionLabel } from "@/lib/warehouse-receive-condition";
import { cn } from "@/lib/utils";

export function DashboardAcceptDeliveryConditionDialog({
  row,
}: {
  row: DashboardPaidOrderLineRow;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const fulfillment = effectiveOrderItemFulfillmentStatus(row.orderItem, row.order);
  const canAccept =
    isProblemDeliveryReceiptFulfillment(fulfillment) &&
    row.refundedCents < row.orderItem.price;

  const condition = canAccept ?
    problemDeliveryWarehouseCondition(
      fulfillment,
      row.orderItem.warehouseReceivedCondition,
    )
  : null;
  const conditionLabel =
    condition ? warehouseReceiveConditionLabel(condition) : "problem";
  const statusLabel = canAccept ?
    problemDeliveryReceiptStatusLabel(
      fulfillment,
      row.orderItem.warehouseReceivedCondition,
    )
  : null;

  const submit = useCallback(() => {
    startTransition(async () => {
      const res = await acceptDeliveryConditionForBarrelAction({
        orderItemId: row.orderItem.id,
      });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }, [router, row.orderItem.id]);

  if (!canAccept) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "mt-2 w-full",
        )}
      >
        Accept condition
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to barrel anyway?</DialogTitle>
          <DialogDescription>
            Staff recorded this delivery as{" "}
            <span className="font-medium text-foreground">{conditionLabel}</span>
            {statusLabel ?
              <>
                {" "}
                ({statusLabel})
              </>
            : null}
            . If you continue, you agree to accept the product in this condition and
            move it into the barrel packing queue. Cart2Barrel staff will assign it to
            your container next.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Accept & add to barrel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
