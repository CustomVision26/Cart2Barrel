"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  setUserContainerCartQuantityAction,
} from "@/actions/user-container-cart";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatUsd } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

export type SerializableContainerOffering = {
  id: string;
  name: string;
  sizeLabel: string;
  priceUsdCents: number;
  isActive: boolean;
};

export type SerializableContainerImage = {
  id: string;
  imageUrl: string;
  sortIndex: number;
};

type DashboardBarrelOfferingCardProps = {
  offering: SerializableContainerOffering;
  images: SerializableContainerImage[];
  cartQuantity: number | null;
};

export function DashboardBarrelOfferingCard({
  offering,
  images,
  cartQuantity,
}: DashboardBarrelOfferingCardProps) {
  const router = useRouter();
  const [qty, setQty] = useState(
    cartQuantity != null && cartQuantity > 0 ? cartQuantity : 1,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAddToCart() {
    setError(null);
    startTransition(async () => {
      const res = await setUserContainerCartQuantityAction({
        offeringId: offering.id,
        quantity: qty,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.refresh();
    });
  }

  const priceLabel = formatUsd(offering.priceUsdCents);

  return (
    <Card className="overflow-hidden border-border/80">
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-lg">{offering.name}</CardTitle>
        <CardDescription>
          {offering.sizeLabel} · {priceLabel} each
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {images.length > 0 ?
          <div className="relative px-10 pb-2">
            <Carousel className="w-full" opts={{ loop: images.length > 1 }}>
              <CarouselContent>
                {images.map((im) => (
                  <CarouselItem key={im.id}>
                    <div
                      className={cn(
                        "relative aspect-[4/3] overflow-hidden rounded-md border border-border/60 bg-muted/20",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={im.imageUrl}
                        alt=""
                        className="size-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {images.length > 1 ?
                <>
                  <CarouselPrevious className="left-1 border-border/80 bg-background/90" />
                  <CarouselNext className="right-1 border-border/80 bg-background/90" />
                </>
              : null}
            </Carousel>
          </div>
        : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-md border border-dashed border-border/60 bg-muted/15 text-sm text-muted-foreground">
            Photos coming soon
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label
              htmlFor={`qty-${offering.id}`}
              className="text-xs font-medium text-muted-foreground"
            >
              Quantity
            </label>
            <Input
              id={`qty-${offering.id}`}
              type="number"
              min={1}
              max={99}
              value={qty}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(n) && n >= 1 && n <= 99) setQty(n);
                else if (e.target.value === "") setQty(1);
              }}
              className="h-9 w-20 tabular-nums"
            />
          </div>
          <Button
            type="button"
            className="min-w-[8rem]"
            disabled={pending}
            onClick={handleAddToCart}
          >
            {pending ? "Saving…" : "Add to cart"}
          </Button>
        </div>
        {cartQuantity != null && cartQuantity > 0 ?
          <p className="text-xs text-muted-foreground">
            In your cart:{" "}
            <span className="font-medium text-foreground">{cartQuantity}</span>
          </p>
        : null}
        {error ?
          <p className="text-sm text-destructive">{error}</p>
        : null}
      </CardContent>
      <CardFooter className="border-t border-border/50 bg-muted/10 py-3 text-xs text-muted-foreground">
        Charged at checkout with your other cart items.
      </CardFooter>
    </Card>
  );
}
