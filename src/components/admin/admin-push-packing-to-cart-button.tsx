"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { applyCustomerPackagePackingToCartAction } from "@/actions/customer-pricing-package";
import { Button } from "@/components/ui/button";

type AdminPushPackingToCartButtonProps = {
  clerkUserId: string;
  cartBarrelCount: number;
  cartBinCount: number;
  disabled?: boolean;
};

export function AdminPushPackingToCartButton({
  clerkUserId,
  cartBarrelCount,
  cartBinCount,
  disabled,
}: AdminPushPackingToCartButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const noContainers = cartBarrelCount === 0 && cartBinCount === 0;

  return (
    <div className="flex flex-col items-stretch gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || pending || noContainers}
        title={
          noContainers ?
            "Customer has no barrels or bins in cart"
          : "Apply this package's barrel/bin packing fees to their cart total"
        }
        onClick={() => {
          setErr(null);
          startTransition(async () => {
            const res = await applyCustomerPackagePackingToCartAction({
              clerkUserId,
            });
            if (!res.ok) {
              setErr(res.message);
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Applying…" : "Apply to cart"}
      </Button>
      {err ?
        <span className="max-w-[10rem] text-[10px] leading-tight text-destructive">
          {err}
        </span>
      : null}
    </div>
  );
}
