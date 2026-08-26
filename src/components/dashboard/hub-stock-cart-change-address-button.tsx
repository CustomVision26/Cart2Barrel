"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateHubStockCartAddressAction } from "@/actions/user-hub-stock-cart";
import { ShippingAddressPickerDialog } from "@/components/shipping/shipping-address-picker-dialog";
import { Button } from "@/components/ui/button";
import type { SerializableShippingAddress } from "@/data/addresses";

export function HubStockCartChangeAddressButton({
  cartItemId,
  addresses,
}: {
  cartItemId: string;
  addresses: SerializableShippingAddress[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="xs"
        className="h-auto px-0 text-[11px]"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        Change address
      </Button>
      <ShippingAddressPickerDialog
        open={open}
        onOpenChange={setOpen}
        addresses={addresses}
        requireUs
        title="Change shipping address"
        description="US delivery must use a United States address from your address book."
        onSelect={(address) => {
          startTransition(async () => {
            const result = await updateHubStockCartAddressAction({
              cartItemId,
              addressId: address.id,
            });
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success("Shipping address updated.");
            router.refresh();
          });
        }}
      />
    </>
  );
}
