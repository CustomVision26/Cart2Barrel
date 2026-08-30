"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MapPinIcon, PackageIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { addHubStockToCartAction } from "@/actions/user-hub-stock-cart";
import {
  HubStockFeatureList,
  HubStockMetaChips,
  HubStockProductHeroCarousel,
} from "@/components/marketing/hub-stock-product-presentation";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SerializableShippingAddress } from "@/data/addresses";
import type { PublicHubStockProduct } from "@/data/hub-stock-products";
import { formatUsd } from "@/lib/admin-markup";
import { hubStockQtyIsLow, usDeliveryAddressPrompt } from "@/lib/hub-stock";
import { cn } from "@/lib/utils";
import type { HubStockDestinationInput } from "@/lib/validations/hub-stock";

function defaultAddressId(addresses: SerializableShippingAddress[]): string | null {
  const usReady = addresses.find((row) => !usDeliveryAddressPrompt(row));
  if (usReady) return usReady.id;
  return addresses.find((row) => row.isDefault)?.id ?? addresses[0]?.id ?? null;
}

export function HomeHubStockAddToCartDialog({
  product,
  isSignedIn,
  savedAddresses,
  open,
  onOpenChange,
}: {
  product: PublicHubStockProduct;
  isSignedIn: boolean;
  savedAddresses: SerializableShippingAddress[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [destination, setDestination] =
    useState<HubStockDestinationInput>("us_address");
  const [quantity, setQuantity] = useState(1);
  const [addressId, setAddressId] = useState<string | null>(null);

  const maxQty = Math.max(1, product.stockQty);
  const images = product.imageUrls.map((url) => url.trim()).filter(Boolean);
  const description = product.description.trim();
  const lowStock = hubStockQtyIsLow(product.stockQty);
  const selectedAddress =
    savedAddresses.find((row) => row.id === addressId) ?? null;

  useEffect(() => {
    if (!open) return;
    setQuantity(1);
    setDestination("us_address");
    setAddressId(defaultAddressId(savedAddresses));
  }, [open, product.id, savedAddresses]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden sm:max-w-lg duration-300 data-open:zoom-in-95">
        <HubStockProductHeroCarousel
          productName={product.name}
          imageUrls={images}
          className="-mx-4 -mt-4"
        />

        <DialogHeader className="gap-1.5 pr-6">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <SparklesIcon className="size-3 text-primary" aria-hidden />
            Add to cart
          </div>
          <DialogTitle className="font-heading text-lg leading-snug">
            {product.name}
          </DialogTitle>
          <DialogDescription>
            Already in the hub — no estimate needed. {formatUsd(product.priceUsdCents)}
          </DialogDescription>
          <HubStockMetaChips
            sizeLabel={product.sizeLabel}
            colorLabel={product.colorLabel}
          />
        </DialogHeader>

        {description ?
          <HubStockFeatureList description={description} className="max-h-[22vh]" />
        : null}

        {!isSignedIn ?
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/25 p-3">
            <p className="text-sm text-muted-foreground">
              Sign in to add in-hub products to your cart.
            </p>
            <Link href="/login" className={buttonVariants()}>
              Sign in
            </Link>
          </div>
        : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (destination === "us_address") {
                const prompt = usDeliveryAddressPrompt(selectedAddress);
                if (prompt) {
                  toast.error(prompt);
                  return;
                }
              }
              startTransition(async () => {
                const result = await addHubStockToCartAction({
                  productId: product.id,
                  quantity,
                  destination,
                  addressId:
                    destination === "us_address" ? addressId ?? undefined : undefined,
                });
                if (!result.ok) {
                  toast.error(result.message);
                  return;
                }
                toast.success("Added to cart.");
                onOpenChange(false);
                router.refresh();
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor={`qty-${product.id}`}>Quantity</Label>
              <Input
                id={`qty-${product.id}`}
                name="quantity"
                type="number"
                min={1}
                max={maxQty}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                required
              />
              <p
                className={cn(
                  "text-xs",
                  lowStock ?
                    "font-medium text-red-600 dark:text-red-400"
                  : "text-muted-foreground",
                )}
              >
                {product.stockQty} in stock
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Ship to</legend>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm shadow-sm transition-colors motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300",
                  destination === "us_address" ?
                    "border-primary/50 bg-primary/8 ring-1 ring-primary/20"
                  : "border-border/80 bg-muted/20 hover:bg-muted/35",
                )}
              >
                <input
                  type="radio"
                  name="destination"
                  value="us_address"
                  checked={destination === "us_address"}
                  onChange={() => setDestination("us_address")}
                  className="mt-1"
                />
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/20">
                  <MapPinIcon className="size-3.5" aria-hidden />
                </span>
                <span>
                  <span className="font-medium text-foreground">US address</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Staff ships this product to your US address after checkout. In-hub items to the same address pack as one shipment with a single shipping rate.
                  </span>
                </span>
              </label>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm shadow-sm transition-colors motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both",
                  destination === "overseas_container" ?
                    "border-primary/50 bg-primary/8 ring-1 ring-primary/20"
                  : "border-border/80 bg-muted/20 hover:bg-muted/35",
                )}
                style={{ animationDelay: "80ms", animationDuration: "420ms" }}
              >
                <input
                  type="radio"
                  name="destination"
                  value="overseas_container"
                  checked={destination === "overseas_container"}
                  onChange={() => setDestination("overseas_container")}
                  className="mt-1"
                />
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/20">
                  <PackageIcon className="size-3.5" aria-hidden />
                </span>
                <span>
                  <span className="font-medium text-foreground">
                    Overseas packaging container
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Pack this item into your overseas shipping container at the hub.
                  </span>
                </span>
              </label>
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Adding…" : "Add to cart"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
