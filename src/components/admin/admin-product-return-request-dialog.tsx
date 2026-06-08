"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { adminFulfillProductReturnRequestAction } from "@/actions/admin-fulfill-product-return-request";
import { AdminRetailerReceiptImagesField } from "@/components/admin/admin-retailer-receipt-images-field";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductReturnDesiredOutcomeSummary } from "@/components/dashboard/product-return-desired-outcome-options";
import type { PendingProductReturnRequestBrief } from "@/data/order-item-product-return-requests";
import type { OrderItem } from "@/db/schema";
import { resolveProductReturnDesiredOutcomeContext } from "@/lib/product-return-desired-outcome";
import { defaultProductReturnStaffCustomerNote } from "@/lib/product-return-staff-customer-note";
import { cn } from "@/lib/utils";

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function AdminProductReturnRequestDialog({
  orderItemId,
  productLabel,
  returnRequest,
  initialReceiptImageUrls,
  fulfillmentStatus,
  warehouseReceivedCondition,
}: {
  orderItemId: string;
  productLabel: string;
  returnRequest: PendingProductReturnRequestBrief;
  initialReceiptImageUrls?: string[] | null;
  fulfillmentStatus?: OrderItem["fulfillmentStatus"];
  warehouseReceivedCondition?: string | null;
}) {
  const outcomeContext = resolveProductReturnDesiredOutcomeContext({
    fulfillmentStatus,
    warehouseReceivedCondition,
  });
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState("");
  const [retailerTrackingCompany, setRetailerTrackingCompany] = useState("");
  const [retailerTrackingNumber, setRetailerTrackingNumber] = useState("");
  const [notesForCustomer, setNotesForCustomer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackOk, setFeedbackOk] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setNotesForCustomer(
        defaultProductReturnStaffCustomerNote(returnRequest.desiredOutcome),
      );
    }
  }, [open, returnRequest.desiredOutcome]);

  const submit = useCallback(() => {
    setFeedback(null);
    startTransition(async () => {
      const res = await adminFulfillProductReturnRequestAction({
        orderItemId,
        trackingUrl: trackingUrl.trim() === "" ? undefined : trackingUrl.trim(),
        retailerTrackingCompany:
          retailerTrackingCompany.trim() === "" ?
            undefined
          : retailerTrackingCompany.trim(),
        retailerTrackingNumber:
          retailerTrackingNumber.trim() === "" ?
            undefined
          : retailerTrackingNumber.trim(),
        customerNotes: notesForCustomer.trim(),
      });
      setFeedbackOk(res.ok);
      setFeedback(res.message);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  }, [
    orderItemId,
    retailerTrackingCompany,
    retailerTrackingNumber,
    notesForCustomer,
    router,
    trackingUrl,
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFeedback(null);
          setFeedbackOk(false);
        }
      }}
    >
      <DialogTrigger
        type="button"
        className={cn(buttonVariants({ variant: "default", size: "sm" }))}
      >
        View return
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Product return request</DialogTitle>
          <DialogDescription>
            Customer asked Cart2Barrel to return{" "}
            <span className="font-medium text-foreground">{productLabel}</span>. Staff complete
            the physical return and carrier transaction, then save tracking and receipt here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
              Customer request
            </p>
            <dl className="mt-2 grid gap-2">
              <div>
                <dt className="text-xs text-muted-foreground">Requested outcome</dt>
                <dd className="text-foreground">
                  <ProductReturnDesiredOutcomeSummary
                    outcome={returnRequest.desiredOutcome}
                    context={outcomeContext}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Customer note</dt>
                <dd className="whitespace-pre-wrap text-foreground">
                  {returnRequest.details}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Submitted</dt>
                <dd>{formatWhen(returnRequest.createdAt)}</dd>
              </div>
            </dl>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Return shipment & receipt
            </p>
            <AdminRetailerReceiptImagesField
              orderItemId={orderItemId}
              initialUrls={initialReceiptImageUrls}
              disabled={pending}
              dialogOpen={open}
            />
            <div className="space-y-2">
              <Label htmlFor={`admin-return-url-${orderItemId}`}>Return tracking URL</Label>
              <Input
                id={`admin-return-url-${orderItemId}`}
                type="url"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                disabled={pending}
                placeholder="https://…"
              />
            </div>
            <fieldset className="space-y-2 rounded-lg border border-border/80 bg-muted p-3">
              <legend className="px-1 text-xs font-medium">Carrier + tracking number</legend>
              <Input
                placeholder="Carrier / retailer"
                value={retailerTrackingCompany}
                onChange={(e) => setRetailerTrackingCompany(e.target.value)}
                disabled={pending}
              />
              <Input
                placeholder="Tracking number"
                value={retailerTrackingNumber}
                onChange={(e) => setRetailerTrackingNumber(e.target.value)}
                disabled={pending}
              />
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor={`admin-return-customer-note-${orderItemId}`}>
                Notes for customer
              </Label>
              <textarea
                id={`admin-return-customer-note-${orderItemId}`}
                className="min-h-[6rem] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground"
                value={notesForCustomer}
                onChange={(e) => setNotesForCustomer(e.target.value)}
                disabled={pending}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                Shown to the customer on their order when return tracking is saved. You
                can edit this before saving.
              </p>
            </div>
          </div>

          {feedback ?
            <p
              className={cn(
                "text-sm",
                feedbackOk ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
              )}
            >
              {feedback}
            </p>
          : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" disabled={pending} onClick={submit}>
            {pending ? "Saving…" : "Save return tracking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
