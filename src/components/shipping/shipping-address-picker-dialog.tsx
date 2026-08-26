"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SerializableShippingAddress } from "@/data/addresses";
import { DASHBOARD_SHIPPING_ROUTES } from "@/lib/dashboard-shipping-routes";
import { usDeliveryAddressPrompt } from "@/lib/hub-stock";
import { formatShippingStreetOneLine } from "@/lib/shipping-address-format";
import { cn } from "@/lib/utils";

export function ShippingAddressPickerDialog({
  open,
  onOpenChange,
  addresses,
  selectedId,
  requireUs = false,
  title = "Choose shipping address",
  description = "Select a saved address for this shipment.",
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addresses: SerializableShippingAddress[];
  selectedId?: string | null;
  requireUs?: boolean;
  title?: string;
  description?: string;
  onSelect: (address: SerializableShippingAddress) => void;
}) {
  const [pickedId, setPickedId] = useState<string | null>(selectedId ?? null);

  const picked = addresses.find((row) => row.id === pickedId) ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setPickedId(selectedId ?? addresses.find((row) => row.isDefault)?.id ?? null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {addresses.length === 0 ?
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/25 p-3">
            <p className="text-sm text-muted-foreground">
              You do not have a saved shipping address yet.
            </p>
            <Link
              href={DASHBOARD_SHIPPING_ROUTES.address}
              className={buttonVariants({ size: "sm" })}
            >
              Add an address
            </Link>
          </div>
        : (
          <ul className="space-y-2" role="list">
            {addresses.map((address) => {
              const checked = pickedId === address.id;
              return (
                <li key={address.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors",
                      checked ?
                        "border-primary/50 bg-primary/8 ring-1 ring-primary/20"
                      : "border-border/80 bg-muted/20 hover:bg-muted/35",
                    )}
                  >
                    <input
                      type="radio"
                      name="shipping-address-pick"
                      className="mt-1"
                      checked={checked}
                      onChange={() => setPickedId(address.id)}
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {address.recipientName || "Shipping address"}
                        </span>
                        {address.isDefault ?
                          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            Primary
                          </span>
                        : null}
                      </span>
                      {address.recipientPhone ?
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {address.recipientPhone}
                        </span>
                      : null}
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {formatShippingStreetOneLine(address)}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!picked}
            onClick={() => {
              if (!picked) return;
              if (requireUs) {
                const prompt = usDeliveryAddressPrompt(picked);
                if (prompt) {
                  toast.error(prompt);
                  return;
                }
              }
              onSelect(picked);
              onOpenChange(false);
            }}
          >
            Use this address
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
