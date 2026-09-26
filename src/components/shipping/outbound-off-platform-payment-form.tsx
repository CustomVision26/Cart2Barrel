"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { submitOutboundOffPlatformPaymentAction } from "@/actions/submit-outbound-off-platform-payment";
import { DeclineBrokerButton } from "@/components/shipping/decline-broker-button";
import { DeclineCourierButton } from "@/components/shipping/decline-courier-button";
import { Button } from "@/components/ui/button";
import { Input, nativeSelectFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BarrelOutboundShippingChargeView } from "@/lib/barrel-outbound-shipping-charge";
import {
  canSwitchOffPlatformPaymentToTransfer,
  OFF_PLATFORM_PAYMENT_METHOD_LABELS,
  type OffPlatformPaymentMethod,
} from "@/lib/barrel-outbound-shipping-charge";
import { cn } from "@/lib/utils";

type OutboundOffPlatformPaymentFormProps = {
  charge: BarrelOutboundShippingChargeView;
  declineBrokerIntakeId?: string;
  declineCourierIntakeId?: string;
};

export function OutboundOffPlatformPaymentForm({
  charge,
  declineBrokerIntakeId,
  declineCourierIntakeId,
}: OutboundOffPlatformPaymentFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState<OffPlatformPaymentMethod | "">("");
  const [payerAccountName, setPayerAccountName] = useState("");
  const [receiptName, setReceiptName] = useState("");
  const [switchingMethod, setSwitchingMethod] = useState(false);
  const hasZelle = Boolean(charge.partnerZelleId?.trim());
  const hasCashApp = Boolean(charge.partnerCashappId?.trim());
  const canSwitchToTransfer = canSwitchOffPlatformPaymentToTransfer(charge);
  const canDeclineBroker =
    charge.chargeKind === "broker" &&
    !charge.paidAt &&
    Boolean(declineBrokerIntakeId);
  const canDeclineCourier =
    charge.chargeKind === "courier" &&
    !charge.paidAt &&
    Boolean(declineCourierIntakeId);
  const declineActions =
    (canDeclineBroker && declineBrokerIntakeId) ||
    (canDeclineCourier && declineCourierIntakeId) ?
      <>
        {canDeclineBroker && declineBrokerIntakeId ?
          <DeclineBrokerButton intakeId={declineBrokerIntakeId} />
        : null}
        {canDeclineCourier && declineCourierIntakeId ?
          <DeclineCourierButton intakeId={declineCourierIntakeId} />
        : null}
      </>
    : null;

  if (charge.offPlatformSubmittedAt && !switchingMethod) {
    const label =
      charge.offPlatformPaymentMethod
        ? OFF_PLATFORM_PAYMENT_METHOD_LABELS[charge.offPlatformPaymentMethod]
        : "Payment";
    const awaitingApproval = !charge.paidAt;
    const receiptUrl = charge.offPlatformReceiptUrl?.trim() || null;
    return (
      <div
        className={
          awaitingApproval
            ? "space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground"
            : "space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-foreground"
        }
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">
            {awaitingApproval ? `${label} submitted — awaiting verification` : `${label} approved`}
          </p>
          {canSwitchToTransfer ?
            <Button
              type="button"
              size="xs"
              variant="outline"
              className="shrink-0"
              onClick={() => {
                setMethod("");
                setPayerAccountName("");
                setReceiptName("");
                setSwitchingMethod(true);
              }}
            >
              Pay with Zelle or Cash App
            </Button>
          : null}
        </div>
        {charge.offPlatformPayerName ?
          <p className="text-muted-foreground">
            Account name:{" "}
            <span className="text-foreground">{charge.offPlatformPayerName}</span>
          </p>
        : null}
        {charge.offPlatformPaymentMethod === "zelle" && charge.partnerZelleId ?
          <p className="text-muted-foreground">
            Sent to Zelle ID{" "}
            <span className="text-foreground">{charge.partnerZelleId}</span>
            {charge.partnerZelleAccount ?
              <>
                {" "}
                (account{" "}
                <span className="text-foreground">{charge.partnerZelleAccount}</span>
                )
              </>
            : null}
          </p>
        : null}
        {charge.offPlatformPaymentMethod === "cashapp" && charge.partnerCashappId ?
          <p className="text-muted-foreground">
            Sent to Cash App ID{" "}
            <span className="text-foreground">{charge.partnerCashappId}</span>
            {charge.partnerCashappAccount ?
              <>
                {" "}
                (account{" "}
                <span className="text-foreground">{charge.partnerCashappAccount}</span>
                )
              </>
            : null}
          </p>
        : null}
        {receiptUrl ?
          <>
            <a
              href={receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex font-medium text-primary underline-offset-4 hover:underline"
            >
              View submitted receipt
            </a>
            <p className="text-muted-foreground">
              A copy of this receipt is kept on your account under Billing Receipt.
            </p>
          </>
        : null}
        {charge.offPlatformPaymentMethod === "local_office" ?
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Pay these charges at the local office. Staff will confirm the payment.
            </p>
            {declineActions}
          </div>
        : declineActions}
      </div>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const res = await submitOutboundOffPlatformPaymentAction(formData);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setSwitchingMethod(false);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2.5 border-t border-border/60 pt-2.5">
      <input type="hidden" name="chargeId" value={charge.chargeId} />
      {switchingMethod ?
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Send this charge with Zelle or Cash App instead of paying at the local
            office.
          </p>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={pending}
            className="shrink-0"
            onClick={() => setSwitchingMethod(false)}
          >
            Keep local office
          </Button>
        </div>
      : null}
      <div className="space-y-1">
        <Label htmlFor={`${charge.chargeId}-pay-method`}>Payment option</Label>
        <select
          id={`${charge.chargeId}-pay-method`}
          name="paymentMethod"
          required
          disabled={pending}
          className={nativeSelectFieldClassName}
          value={method}
          onChange={(e) =>
            setMethod((e.target.value || "") as OffPlatformPaymentMethod | "")
          }
        >
          <option value="">Select how you will pay</option>
          <option value="zelle" disabled={!hasZelle}>
            Zelle payment{hasZelle ? "" : " (ID not published)"}
          </option>
          <option value="cashapp" disabled={!hasCashApp}>
            Cash App{hasCashApp ? "" : " (ID not published)"}
          </option>
          {switchingMethod ? null : (
            <option value="local_office">Pay charges at the local office</option>
          )}
        </select>
      </div>

      {method === "zelle" ?
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>
            Send payment to Zelle ID{" "}
            <span className="font-medium text-foreground">
              {charge.partnerZelleId}
            </span>
          </p>
          {charge.partnerZelleAccount ?
            <p>
              Confirm the account name is{" "}
              <span className="font-medium text-foreground">
                {charge.partnerZelleAccount}
              </span>
            </p>
          : null}
        </div>
      : null}
      {method === "cashapp" ?
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p>
            Send payment to Cash App ID{" "}
            <span className="font-medium text-foreground">
              {charge.partnerCashappId}
            </span>
          </p>
          {charge.partnerCashappAccount ?
            <p>
              Confirm the account name is{" "}
              <span className="font-medium text-foreground">
                {charge.partnerCashappAccount}
              </span>
            </p>
          : null}
        </div>
      : null}
      {method === "local_office" ?
        <p className="text-xs text-muted-foreground">
          Pay {charge.partnerName || "this vendor"} at the local office
          {charge.partnerPhone ? ` · ${charge.partnerPhone}` : ""}
          {charge.partnerAddress ? `. ${charge.partnerAddress}` : "."}
        </p>
      : null}

      {method === "zelle" || method === "cashapp" ?
        <>
          <div className="space-y-1">
            <Label htmlFor={`${charge.chargeId}-account-name`}>
              Your account name
            </Label>
            <Input
              id={`${charge.chargeId}-account-name`}
              name="payerAccountName"
              required
              disabled={pending}
              value={payerAccountName}
              placeholder="Name on the account that sent payment"
              onChange={(e) => setPayerAccountName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${charge.chargeId}-receipt`}>
              Copy of receipt for payment sent
            </Label>
            <Input
              id={`${charge.chargeId}-receipt`}
              name="receipt"
              type="file"
              required
              disabled={pending}
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              onChange={(e) =>
                setReceiptName(e.target.files?.[0]?.name ?? "")
              }
            />
            {receiptName ?
              <p className="text-[11px] text-muted-foreground">{receiptName}</p>
            : null}
          </div>
        </>
      : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending || !method}
          className={cn("w-full sm:w-auto")}
        >
          {pending
            ? "Submitting…"
            : method === "local_office"
              ? "Confirm local office payment"
              : "Submit payment"}
        </Button>
        {declineActions}
      </div>
    </form>
  );
}
