"use client";

import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { updateOrderItemPurchaseTrackingAction } from "@/actions/admin-update-purchase-tracking";
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
import { cn } from "@/lib/utils";

export type AdminPurchaseTrackingDialogProps = {
  orderItemId: string;
  productLabel: string;
  initialTrackingUrl: string | null;
  initialRetailerTrackingCompany: string | null;
  initialRetailerTrackingNumber: string | null;
  /** Inbound shipment vs return-to-retailer after a problem receipt. */
  variant?: "inbound" | "return";
  /**
   * Trigger button text. When omitted, return variant uses "Return product", inbound uses "Tracking product".
   * Use `"tracking"` when return shipment is already in flight (e.g. awaiting delivery) but ops should see the same control as inbound tracking.
   */
  triggerLabel?: "tracking" | "return";
  initialReceiptImageUrls?: string[] | null;
};

function trackableHttpUrl(raw: string | null | undefined): string | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export function AdminPurchaseTrackingDialog(props: AdminPurchaseTrackingDialogProps) {
  const {
    orderItemId,
    productLabel,
    initialTrackingUrl,
    initialRetailerTrackingCompany,
    initialRetailerTrackingNumber,
    variant = "inbound",
    triggerLabel,
    initialReceiptImageUrls,
  } = props;
  const isReturn = variant === "return";
  const triggerButtonLabel =
    triggerLabel === "tracking" ? "Tracking product"
    : triggerLabel === "return" ? "Return product"
    : isReturn ? "Return product"
    : "Tracking product";

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState("");
  const [retailerTrackingCompany, setRetailerTrackingCompany] = useState("");
  const [retailerTrackingNumber, setRetailerTrackingNumber] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackOk, setFeedbackOk] = useState(false);
  const [pending, startTransition] = useTransition();

  const resetFormFromProps = useCallback(() => {
    setTrackingUrl(initialTrackingUrl?.trim() ?? "");
    setRetailerTrackingCompany(initialRetailerTrackingCompany?.trim() ?? "");
    setRetailerTrackingNumber(initialRetailerTrackingNumber?.trim() ?? "");
  }, [
    initialRetailerTrackingCompany,
    initialRetailerTrackingNumber,
    initialTrackingUrl,
  ]);

  const submit = useCallback(() => {
    setFeedback(null);
    const companyTrim = retailerTrackingCompany.trim();
    const numberTrim = retailerTrackingNumber.trim();
    if (numberTrim !== "" && companyTrim === "") {
      setFeedbackOk(false);
      setFeedback(
        "Enter the retailer / carrier tracking company name when you add a tracking number.",
      );
      return;
    }
    if (companyTrim !== "" && numberTrim === "") {
      setFeedbackOk(false);
      setFeedback(
        "Enter the tracking number when you add a retailer / carrier name.",
      );
      return;
    }
    startTransition(async () => {
      const res = await updateOrderItemPurchaseTrackingAction({
        orderItemId,
        trackingUrl: trackingUrl.trim() === "" ? undefined : trackingUrl.trim(),
        retailerTrackingCompany:
          companyTrim === "" ? undefined : companyTrim,
        retailerTrackingNumber: numberTrim === "" ? undefined : numberTrim,
        purpose: isReturn ? "return" : "inbound",
      });
      setFeedbackOk(res.ok);
      setFeedback(res.message);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  }, [
    isReturn,
    orderItemId,
    retailerTrackingCompany,
    retailerTrackingNumber,
    router,
    trackingUrl,
  ]);

  const typedTrackingHref = trackableHttpUrl(trackingUrl);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          resetFormFromProps();
          setFeedback(null);
          setFeedbackOk(false);
          return;
        }
        setFeedback(null);
        setFeedbackOk(false);
      }}
    >
      <DialogTrigger
        type="button"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        {triggerButtonLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,560px)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isReturn ? "Return product" : "Tracking"}</DialogTitle>
          <DialogDescription>
            {isReturn ?
              <>
                Record return shipment tracking for this paid line (
                <span className="font-medium text-foreground">{productLabel}</span>
                ).
              </>
            : `Edit retailer shipment tracking for this paid line (${productLabel}).`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <AdminRetailerReceiptImagesField
            orderItemId={orderItemId}
            initialUrls={initialReceiptImageUrls}
            disabled={pending}
            dialogOpen={open}
          />

          <div className="space-y-2">
            <Label htmlFor={`tracking-url-edit-${orderItemId}`}>Tracking URL</Label>
            <Input
              id={`tracking-url-edit-${orderItemId}`}
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              disabled={pending}
              autoComplete="off"
            />
            {typedTrackingHref ?
              <Link
                href={typedTrackingHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "link", size: "sm" }),
                  "inline-flex h-auto max-w-full items-center gap-1 px-0 py-0 font-medium break-all text-left leading-snug",
                )}
              >
                Visit tracking site
                <ExternalLinkIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />
              </Link>
            : null}
          </div>

          <fieldset className="space-y-2 rounded-lg border border-border/80 bg-muted p-3">
            <legend className="px-1 text-xs font-medium text-foreground">
              Carrier / retailer + number
            </legend>
            <p className="pb-1 text-[11px] text-muted-foreground">
              Provide both company and number together, or leave both empty.
            </p>
            <div className="space-y-2">
              <Label htmlFor={`tracking-co-edit-${orderItemId}`}>Tracking company</Label>
              <Input
                id={`tracking-co-edit-${orderItemId}`}
                type="text"
                placeholder="UPS, USPS, …"
                value={retailerTrackingCompany}
                onChange={(e) => setRetailerTrackingCompany(e.target.value)}
                disabled={pending}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`tracking-num-edit-${orderItemId}`}>Tracking number</Label>
              <Input
                id={`tracking-num-edit-${orderItemId}`}
                type="text"
                inputMode="text"
                spellCheck={false}
                placeholder="Paste tracking ID"
                value={retailerTrackingNumber}
                onChange={(e) => setRetailerTrackingNumber(e.target.value)}
                disabled={pending}
                autoComplete="off"
              />
            </div>
          </fieldset>

          {feedback ?
            <p
              className={`rounded-md px-3 py-2 text-xs ${
                feedbackOk ?
                  "border border-emerald-500/35 bg-emerald-500/10 text-emerald-100"
                : "border border-destructive/35 bg-destructive/10 text-foreground"
              }`}
            >
              {feedback}
            </p>
          : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={submit}>
            {pending ? "Saving…" : isReturn ? "Save return tracking" : "Save tracking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminPurchaseTrackingLink({
  trackingUrl,
  className,
}: {
  trackingUrl: string | null | undefined;
  className?: string;
}) {
  const href = trackableHttpUrl(trackingUrl);
  if (!href) return null;
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        buttonVariants({ variant: "secondary", size: "sm" }),
        "inline-flex h-8 items-center gap-1.5",
        className,
      )}
    >
      Open tracking
      <ExternalLinkIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
    </Link>
  );
}
