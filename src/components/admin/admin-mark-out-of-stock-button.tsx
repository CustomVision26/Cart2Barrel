"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { adminMarkItemRequestOutOfStockAction } from "@/actions/admin-mark-item-request-out-of-stock";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AdminMarkOutOfStockButtonProps = {
  itemRequestId: string;
  productLabel?: string;
};

export function AdminMarkOutOfStockButton({
  itemRequestId,
  productLabel,
}: AdminMarkOutOfStockButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onConfirm = () => {
    startTransition(async () => {
      const res = await adminMarkItemRequestOutOfStockAction({ itemRequestId });
      if (!res.ok) {
        toast.error(res.message ?? "Could not mark out of stock.");
        return;
      }
      toast.success(res.message ?? "Marked out of stock.");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="whitespace-nowrap border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-200"
        onClick={() => setOpen(true)}
      >
        Out of stock
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as out of stock?</DialogTitle>
            <DialogDescription>
              {productLabel?.trim() ?
                <>Staff will tell the customer that &ldquo;{productLabel.trim()}&rdquo; cannot be sourced. The line leaves the active queue and appears in quote history.</>
              : <>The customer will see this product as out of stock on their active products list. It leaves your queue and is recorded in quote history.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={onConfirm}
            >
              {isPending ?
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Updating…
                </>
              : "Confirm out of stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
