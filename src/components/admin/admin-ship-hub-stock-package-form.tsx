"use client";

import { ChevronRight, ExternalLinkIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import {
  checkHubStockUsPackageTrackingAction,
  markHubStockUsPackageDeliveredAction,
  shipHubStockUsPackageAction,
} from "@/actions/admin-ship-hub-stock-package";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function trackableHttpUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export function AdminShipHubStockPackageForm({
  orderId,
  initialCarrier,
  initialTrackingNumber,
  initialTrackingUrl,
  isUpdate,
  onClose,
  onShipped,
}: {
  orderId: string;
  initialCarrier?: string | null;
  initialTrackingNumber?: string | null;
  initialTrackingUrl?: string | null;
  isUpdate: boolean;
  onClose: () => void;
  onShipped?: () => void;
}) {
  const router = useRouter();
  const [carrier, setCarrier] = useState(initialCarrier?.trim() ?? "");
  const [trackingNumber, setTrackingNumber] = useState(
    initialTrackingNumber?.trim() ?? "",
  );
  const [trackingUrl, setTrackingUrl] = useState(initialTrackingUrl?.trim() ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackOk, setFeedbackOk] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"save" | "check" | "deliver" | null>(null);

  const trackingHref = trackableHttpUrl(trackingUrl);

  const submitShipment = useCallback(() => {
    setFeedback(null);
    const companyTrim = carrier.trim();
    const numberTrim = trackingNumber.trim();
    if (!companyTrim) {
      setFeedbackOk(false);
      setFeedback("Enter the carrier name.");
      return;
    }
    if (!numberTrim) {
      setFeedbackOk(false);
      setFeedback("Enter the tracking number.");
      return;
    }
    setBusy("save");
    startTransition(async () => {
      const res = await shipHubStockUsPackageAction({
        orderId,
        retailerTrackingCompany: companyTrim,
        retailerTrackingNumber: numberTrim,
        trackingUrl: trackingUrl.trim() === "" ? undefined : trackingUrl.trim(),
      });
      setFeedbackOk(res.ok);
      setFeedback(res.message);
      setBusy(null);
      if (res.ok) {
        onShipped?.();
        router.refresh();
      }
    });
  }, [carrier, onShipped, orderId, router, trackingNumber, trackingUrl]);

  const checkDelivery = useCallback(() => {
    setFeedback(null);
    setBusy("check");
    startTransition(async () => {
      const res = await checkHubStockUsPackageTrackingAction({ orderId });
      setFeedbackOk(res.ok);
      setFeedback(res.message);
      setBusy(null);
    });
  }, [orderId]);

  const markArrived = useCallback(() => {
    setFeedback(null);
    setBusy("deliver");
    startTransition(async () => {
      const res = await markHubStockUsPackageDeliveredAction({ orderId });
      setFeedbackOk(res.ok);
      setFeedback(res.message);
      setBusy(null);
      if (res.ok) {
        onShipped?.();
        onClose();
        router.refresh();
      }
    });
  }, [onClose, onShipped, orderId, router]);

  return (
    <form
      className="space-y-3 rounded-xl border border-primary/35 bg-primary/8 px-3.5 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        submitShipment();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-foreground">
            {isUpdate ? "Update warehouse shipment" : "Ship warehouse package"}
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Carrier and tracking apply to every in-hub product packed in this US
            package. The customer is notified when you submit.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label="Close ship warehouse package"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`hub-ship-carrier-${orderId}`}>Carrier</Label>
          <Input
            id={`hub-ship-carrier-${orderId}`}
            value={carrier}
            onChange={(event) => setCarrier(event.target.value)}
            placeholder="UPS, USPS, FedEx…"
            disabled={pending}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`hub-ship-number-${orderId}`}>Tracking number</Label>
          <Input
            id={`hub-ship-number-${orderId}`}
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
            placeholder="1Z…"
            disabled={pending}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`hub-ship-url-${orderId}`}>
          Tracking URL <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            id={`hub-ship-url-${orderId}`}
            type="url"
            inputMode="url"
            value={trackingUrl}
            onChange={(event) => setTrackingUrl(event.target.value)}
            placeholder="https://…"
            disabled={pending}
            autoComplete="off"
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={pending || !trackingHref}
            onClick={() => {
              if (!trackingHref) return;
              window.open(trackingHref, "_blank", "noopener,noreferrer");
            }}
          >
            Open tracking
            <ExternalLinkIcon />
          </Button>
        </div>
      </div>

      {feedback ?
        <p
          className={
            feedbackOk ?
              "text-xs text-foreground"
            : "text-xs text-destructive"
          }
        >
          {feedback}
        </p>
      : isUpdate ?
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Open tracking to confirm the carrier page. Check delivery uses a live
          Shippo key; test keys cannot look up FedEx. Next marks the package
          arrived at the customer.
        </p>
      : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
        {isUpdate ?
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={checkDelivery}
          >
            {busy === "check" && pending ? "Checking…" : "Check delivery"}
          </Button>
        : null}
        <Button type="submit" variant={isUpdate ? "outline" : "default"} size="sm" disabled={pending}>
          {busy === "save" && pending ?
            "Saving…"
          : isUpdate ?
            "Save tracking"
          : "Submit shipment"}
        </Button>
        {isUpdate ?
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={markArrived}
          >
            {busy === "deliver" && pending ? "Updating…" : "Next"}
            {busy === "deliver" && pending ? null : (
              <ChevronRight className="size-3.5" aria-hidden />
            )}
          </Button>
        : null}
      </div>
    </form>
  );
}
