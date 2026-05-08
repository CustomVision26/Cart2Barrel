"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { abandonStripeCheckoutAction } from "@/actions/abandon-checkout";

type CartCancelHandlerProps = {
  checkoutSessionId: string;
};

export function CartCancelHandler({ checkoutSessionId }: CartCancelHandlerProps) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) {
      return;
    }
    ran.current = true;
    void (async () => {
      await abandonStripeCheckoutAction({ checkoutSessionId });
      router.replace("/dashboard/cart");
    })();
  }, [checkoutSessionId, router]);

  return null;
}
