"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { removeFromCartAction } from "@/actions/remove-from-cart";
import { Button } from "@/components/ui/button";

type CartRemoveButtonProps = {
  itemRequestId: string;
};

export function CartRemoveButton({ itemRequestId }: CartRemoveButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 text-muted-foreground hover:text-destructive"
        disabled={isPending}
        title="Remove from cart"
        aria-label="Remove from cart"
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const res = await removeFromCartAction({ itemRequestId });
            if (!res.ok) {
              setMessage(res.message ?? "Could not remove.");
            } else {
              router.refresh();
            }
          });
        }}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="size-4" aria-hidden />
        )}
      </Button>
      {message ? (
        <p className="max-w-[12rem] text-right text-xs text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
