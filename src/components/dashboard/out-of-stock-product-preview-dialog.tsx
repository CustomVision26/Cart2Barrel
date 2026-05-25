"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EyeIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { withdrawCustomerProductRequestsAction } from "@/actions/withdraw-customer-product-requests";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ItemRequest } from "@/db/schema";
import { DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE } from "@/lib/dashboard-items-routes";
import { displaySiteName } from "@/lib/site-name";

type OutOfStockProductPreviewDialogProps = {
  request: ItemRequest;
};

export function OutOfStockProductPreviewDialog({
  request,
}: OutOfStockProductPreviewDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [removing, startRemove] = useTransition();

  const onRemove = () => {
    startRemove(async () => {
      const res = await withdrawCustomerProductRequestsAction({
        itemRequestIds: [request.id],
      });
      if (!res.ok) {
        toast.error(res.message ?? "Could not remove this product.");
        return;
      }
      toast.success(res.message ?? "Removed from your active products.");
      setOpen(false);
      router.refresh();
    });
  };

  const productName = request.productName?.trim() || "This product";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
      >
        <EyeIcon className="size-4" />
        Preview
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Out of stock</DialogTitle>
          <DialogDescription>
            Our team could not source {productName}. Remove it from your active
            product record, then submit a new request if you want us to try a
            different product or link.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 rounded-md border border-border bg-muted p-3">
          <ProductRequestThumbnail
            variant="list"
            imageUrl={request.productImageUrl}
            productLabel={productName}
          />
          <OutOfStockProductSummary request={request} productName={productName} />
        </div>
        <p className="text-sm text-muted-foreground">
          After you remove this line, it moves to Product history. To request a
          different product, use{" "}
          <Link
            href={DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Request a new product
          </Link>
          .
        </p>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            variant="destructive"
            disabled={removing}
            className="w-full"
            onClick={onRemove}
          >
            {removing ?
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Removing…
              </>
            : "Remove from product record"}
          </Button>
          <Button type="button" variant="outline" className="w-full" render={<Link href={DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE} />}>
            Request a new product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OutOfStockProductSummary({
  request,
  productName,
}: {
  request: ItemRequest;
  productName: string;
}) {
  return (
    <div className="min-w-0 flex-1 space-y-1 text-sm">
      <p className="font-medium text-foreground line-clamp-2">{productName}</p>
      <p className="text-xs text-muted-foreground">
        {displaySiteName(request.siteName, request.productUrl)}
      </p>
      <a
        href={request.productUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-primary underline-offset-2 hover:underline"
      >
        View product URL
      </a>
    </div>
  );
}



