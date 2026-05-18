"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { createCartCheckoutAction } from "@/actions/create-cart-checkout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CartCheckoutButtonProps = {
  checkoutEnabled: boolean;
  className?: string;
  size?: "default" | "sm" | "lg";
};

export function CartCheckoutButton({
  checkoutEnabled,
  className,
  size = "default",
}: CartCheckoutButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!checkoutEnabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Checkout is disabled until Stripe keys are set (see .env.example):
        STRIPE_SECRET_KEY, and for embedded checkout NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        then restart the dev server. Use STRIPE_CHECKOUT_UI_MODE=hosted if you only want
        redirect Checkout without a publishable key.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={isPending}
        size={size}
        className={cn("font-semibold", className)}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const res = await createCartCheckoutAction();
            if (!res.ok) {
              setMessage(res.message ?? "Checkout failed.");
              return;
            }
            if (res.mode === "hosted") {
              window.location.assign(res.checkoutUrl);
              return;
            }
            window.location.assign(
              `/dashboard/cart/checkout?session_id=${encodeURIComponent(res.sessionId)}`
            );
          });
        }}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            Starting checkout…
          </>
        ) : (
          "Proceed to checkout"
        )}
      </Button>
      {message ? (
        <p className="text-sm text-destructive">{message}</p>
      ) : null}
    </div>
  );
}
