"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { removeHubStockCartItemAction } from "@/actions/user-hub-stock-cart";
import { Button } from "@/components/ui/button";

export function HubStockCartRemoveButton({ cartItemId }: { cartItemId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 shrink-0 text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await removeHubStockCartItemAction({ cartItemId });
          router.refresh();
        });
      }}
    >
      Remove
    </Button>
  );
}
