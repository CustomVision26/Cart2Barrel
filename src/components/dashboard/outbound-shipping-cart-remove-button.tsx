"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { removeOutboundShippingChargeFromCartAction } from "@/actions/user-outbound-shipping-cart";
import { Button } from "@/components/ui/button";

export function OutboundShippingCartRemoveButton({
  chargeId,
}: {
  chargeId: string;
}) {
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
          await removeOutboundShippingChargeFromCartAction({ chargeId });
          router.refresh();
        });
      }}
    >
      Remove
    </Button>
  );
}
