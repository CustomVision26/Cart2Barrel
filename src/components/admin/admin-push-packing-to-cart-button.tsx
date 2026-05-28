"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { applyCustomerPackagePackingToCartAction } from "@/actions/customer-pricing-package";
import { AdminConfirmDialog } from "@/components/admin/admin-confirm-dialog";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const noContainers = cartBarrelCount === 0 && cartBinCount === 0;

  function applyPacking() {
    startTransition(async () => {
      const res = await applyCustomerPackagePackingToCartAction({
        clerkUserId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setConfirmOpen(false);
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <>
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
        onClick={() => setConfirmOpen(true)}
      >
        {pending ? "Applying…" : "Apply to cart"}
      </Button>

      <AdminConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Apply packing fees to cart?"
        description={`Add barrel/bin packing charges for ${cartBarrelCount} barrel(s) and ${cartBinCount} bin(s) to this customer's cart total using their custom package rates.`}
        confirmLabel="Apply to cart"
        pending={pending}
        onConfirm={applyPacking}
      />
    </>
  );
}
