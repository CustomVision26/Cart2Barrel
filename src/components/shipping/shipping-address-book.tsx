"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  deleteShippingAddressAction,
  setPrimaryShippingAddressAction,
} from "@/actions/shipping-address";
import { ShippingAddressForm } from "@/components/shipping-address-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Address } from "@/db/schema";
import { DASHBOARD_SHIPPING_ROUTES } from "@/lib/dashboard-shipping-routes";
import { formatShippingStreetOneLine } from "@/lib/shipping-address-format";

type ShippingAddressBookProps = {
  addresses: Address[];
  contactDefaults: { fullName: string; phone: string };
};

export function ShippingAddressBook({
  addresses,
  contactDefaults,
}: ShippingAddressBookProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(addresses.length === 0);

  const editing = addresses.find((row) => row.id === editingId);

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      {addresses.length > 0 ?
        <ul className="space-y-3" role="list">
          {addresses.map((address) => (
            <li key={address.id}>
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base">
                      {address.recipientName?.trim() || "Shipping address"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {address.recipientPhone?.trim() || "No phone on file"}
                    </p>
                  </div>
                  {address.isDefault ?
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Primary
                    </span>
                  : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {address.label?.trim() ?
                      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground/80">
                        {address.label.trim()}
                      </span>
                    : null}
                    {formatShippingStreetOneLine(address)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdding(false);
                        setEditingId(address.id);
                      }}
                    >
                      Edit
                    </Button>
                    {!address.isDefault ?
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await setPrimaryShippingAddressAction({
                              id: address.id,
                            });
                            if (!result.ok) {
                              toast.error(result.message);
                              return;
                            }
                            toast.success("Primary address updated.");
                            router.refresh();
                          });
                        }}
                      >
                        Set primary
                      </Button>
                    : null}
                    {addresses.length > 1 ?
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await deleteShippingAddressAction({
                              id: address.id,
                            });
                            if (!result.ok) {
                              toast.error(result.message);
                              return;
                            }
                            if (editingId === address.id) setEditingId(null);
                            toast.success("Address removed.");
                            router.refresh();
                          });
                        }}
                      >
                        Remove
                      </Button>
                    : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      : null}

      {editing ?
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Edit address</CardTitle>
          </CardHeader>
          <CardContent>
            <ShippingAddressForm
              key={editing.id}
              address={editing}
              contactDefaults={contactDefaults}
              afterSaveRedirect={DASHBOARD_SHIPPING_ROUTES.address}
              variant="embedded"
              onCancel={() => setEditingId(null)}
            />
          </CardContent>
        </Card>
      : null}

      {adding ?
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              {addresses.length === 0 ? "Add your shipping address" : "Add another address"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ShippingAddressForm
              key="new-address"
              address={undefined}
              contactDefaults={contactDefaults}
              afterSaveRedirect={DASHBOARD_SHIPPING_ROUTES.address}
              forcePrimary={addresses.length === 0}
              variant="embedded"
              onCancel={
                addresses.length > 0 ? () => setAdding(false) : undefined
              }
            />
          </CardContent>
        </Card>
      : (
        <Button type="button" variant="outline" onClick={() => {
          setEditingId(null);
          setAdding(true);
        }}>
          Add shipping address
        </Button>
      )}
    </div>
  );
}
