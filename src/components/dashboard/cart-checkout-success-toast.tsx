"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { toast } from "sonner";

type CartCheckoutSuccessToastProps = {
  variant: "paid" | "pending";
  /** Short label for toast title */
  headline: string;
  body?: string;
  /** Used with sessionStorage so the toast only shows once (Strict Mode / remounts). */
  dedupeKey: string;
};

/**
 * Fires once on mount so payment confirmation is visible alongside the thank-you panel.
 */
export function CartCheckoutSuccessToast({
  variant,
  headline,
  body,
  dedupeKey,
}: CartCheckoutSuccessToastProps) {
  const router = useRouter();

  useEffect(() => {
    const storageKey = `cart2barrel:checkout-success-toast:${dedupeKey}`;
    if (typeof sessionStorage !== "undefined") {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "1");
    }

    if (variant === "paid") {
      toast.success(headline, {
        description: body,
        duration: 12_000,
        action: {
          label: "View orders",
          onClick: () => {
            router.push("/dashboard/orders");
          },
        },
      });
    } else {
      toast.message(headline, {
        description: body,
      });
    }
  }, [variant, headline, body, router, dedupeKey]);

  return null;
}
