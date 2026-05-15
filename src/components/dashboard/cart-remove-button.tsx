"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { removeFromCartAction } from "@/actions/remove-from-cart";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CartRemoveButtonProps = {
  itemRequestId: string;
};

export function CartRemoveButton({ itemRequestId }: CartRemoveButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runRemove = (
    disposition: "permanent_remove" | "return_to_quoted",
  ) => {
    startTransition(async () => {
      const res = await removeFromCartAction({ itemRequestId, disposition });
      setConfirmOpen(false);
      if (res.ok) {
        toast.success(res.message ?? "Updated.");
        router.refresh();
      } else {
        toast.error(res.message ?? "Could not update this item.");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 text-muted-foreground hover:text-destructive"
        disabled={pending}
        title="Remove from cart"
        aria-label="Remove from cart"
        onClick={() => setConfirmOpen(true)}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="size-4" aria-hidden />
        )}
      </Button>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!pending) setConfirmOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Remove this product from cart?</DialogTitle>
            <DialogDescription>
              Permanently delete this request, or move it back to your Products pool as{" "}
              <span className="font-medium text-foreground">Quoted</span>. You can add it to
              the cart again after you accept the estimate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => runRemove("permanent_remove")}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden />
                  Updating…
                </>
              ) : (
                "Delete permanently"
              )}
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => runRemove("return_to_quoted")}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 size-3.5 animate-spin" aria-hidden />
                  Updating…
                </>
              ) : (
                "Move back to requests (Quoted)"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
