"use client";

import { useRouter } from "next/navigation";
import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { reinstateCustomerProductRequestsAction } from "@/actions/reinstate-customer-product-requests";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { cn } from "@/lib/utils";

type ReinstateProductButtonProps = {
  itemRequestId: string;
  productLabel?: string | null;
  isOutsidePurchase?: boolean;
  paymentPrompted?: boolean;
  className?: string;
};

export function ReinstateProductButton({
  itemRequestId,
  productLabel,
  isOutsidePurchase = false,
  paymentPrompted = false,
  className,
}: ReinstateProductButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  const name = productLabel?.trim() || "this product";

  const confirmReinstate = () => {
    startTransition(async () => {
      const res = await reinstateCustomerProductRequestsAction({
        itemRequestIds: [itemRequestId],
      });
      if (!res.ok) {
        toast.error(res.message ?? "Could not reinstate.");
        return;
      }
      toast.success(res.message ?? "Product reinstated.");
      setDialogOpen(false);
      router.push(DASHBOARD_ADD_ITEM_ROUTES.productsActive);
      router.refresh();
    });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        className={cn("gap-1.5", className)}
        onClick={() => setDialogOpen(true)}
      >
        <RotateCcwIcon className="size-3.5 opacity-80" aria-hidden />
        Reinstate to Active
      </Button>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!pending) setDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Reinstate {name} to Active?</DialogTitle>
            <DialogDescription>
              {isOutsidePurchase ?
                paymentPrompted ?
                  "This outside purchase returns to your Active list with status Payment due · prompted. Merchandise was bought elsewhere — you still owe service & handling when you add it to cart and check out."
                : "This outside purchase returns to your Active list with status Payment due. Add it to cart when you are ready to pay service & handling."
              : "This product moves back to your Active list. Staff estimates and batch rules apply as before."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={confirmReinstate}
            >
              {pending ? (
                <>
                  <Loader2Icon className="mr-2 size-3.5 animate-spin" aria-hidden />
                  Reinstating…
                </>
              ) : (
                "Reinstate to Active"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
