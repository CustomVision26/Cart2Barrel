"use client";

import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelOutsidePurchaseReturnRequestAction } from "@/actions/cancel-outside-purchase-return-request";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type OutsidePurchaseCancelReturnButtonProps = {
  itemRequestId: string;
  productLabel?: string;
};

export function OutsidePurchaseCancelReturnButton({
  itemRequestId,
  productLabel,
}: OutsidePurchaseCancelReturnButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cancelling, startCancel] = useTransition();

  const onConfirm = () => {
    startCancel(async () => {
      const res = await cancelOutsidePurchaseReturnRequestAction({ itemRequestId });
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn(
          "w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
        )}
        onClick={() => setOpen(true)}
      >
        Cancel return
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel return request?</DialogTitle>
            <DialogDescription>
              {productLabel ?
                <>
                  This cancels the return-to-retailer workflow for{" "}
                  <span className="font-medium text-foreground">{productLabel}</span>.
                </>
              : "This cancels the return-to-retailer workflow for this product."}{" "}
              The line reverts to its received condition (for example Received: Damaged) and
              you can request a return again later if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={cancelling}
              onClick={() => setOpen(false)}
            >
              Keep return
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelling}
              onClick={onConfirm}
            >
              {cancelling ?
                <>
                  <Loader2Icon className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                  Cancelling…
                </>
              : "Cancel return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
