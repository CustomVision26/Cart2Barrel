"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { addOutboundShippingChargeToCartAction } from "@/actions/user-outbound-shipping-cart";
import { OutboundCompanyAdButton } from "@/components/shipping/outbound-company-ad-button";
import { OutboundOffPlatformPaymentForm } from "@/components/shipping/outbound-off-platform-payment-form";
import { OutboundPaymentReceiptDialog } from "@/components/shipping/outbound-payment-receipt-dialog";
import { OutboundShippingRefundButton } from "@/components/shipping/outbound-shipping-refund-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatUsd } from "@/lib/admin-markup";
import {
  jointChargePayHost,
  type BarrelOutboundShippingChargeView,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  isOffPlatformOutboundChargeKind,
  outboundChargeKindDisplayLabel,
  outboundShippingRefundPath,
  paidOutboundCharges,
  unpaidPublishedCharges,
} from "@/lib/barrel-outbound-shipping-charge";
import { cn } from "@/lib/utils";

export function PaidVendorBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400",
        className,
      )}
    >
      Paid
    </span>
  );
}

function freightPaymentInvoiceHref(orderId: string): string {
  const params = new URLSearchParams({
    orderId,
    format: "pdf",
    disposition: "inline",
  });
  return `/api/dashboard/payment-invoice?${params.toString()}`;
}

export function BarrelPublishedOutboundCharges({
  charges,
  kinds,
  showHeading = true,
  includePaid = false,
  onAdded,
  selection,
  declineBrokerIntakeId,
  declineCourierIntakeId,
  preferPayHostBarrelIds,
}: {
  charges: BarrelOutboundShippingChargeView[];
  kinds?: BarrelOutboundShippingChargeView["chargeKind"][];
  showHeading?: boolean;
  includePaid?: boolean;
  onAdded?: (charge: BarrelOutboundShippingChargeView) => void;
  selection?: {
    name: string;
    selected: boolean;
    onSelect: () => void;
    disabled?: boolean;
  };
  declineBrokerIntakeId?: string;
  declineCourierIntakeId?: string;
  preferPayHostBarrelIds?: readonly string[];
}) {
  const kindMatch = (charge: BarrelOutboundShippingChargeView) =>
    kinds ? kinds.includes(charge.chargeKind) : true;
  const paidItems = includePaid
    ? paidOutboundCharges(charges).filter(kindMatch)
    : [];
  const unpaidItems = unpaidPublishedCharges(charges).filter(kindMatch);
  const items = [...paidItems, ...unpaidItems];
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {showHeading ?
        <>
          <p className="text-sm font-medium text-foreground">Published charges</p>
          <p className="text-xs text-muted-foreground">
            Freight is paid from your cart. Broker and local courier charges are
            paid with Zelle, Cash App, or at the local office.
          </p>
        </>
      : null}
      <ul className="space-y-2">
        {items.map((charge) => (
          <PublishedChargeRow
            key={charge.chargeId}
            charge={charge}
            onAdded={onAdded}
            selection={selection}
            declineBrokerIntakeId={declineBrokerIntakeId}
            declineCourierIntakeId={declineCourierIntakeId}
            preferPayHostBarrelIds={preferPayHostBarrelIds}
          />
        ))}
      </ul>
    </div>
  );
}

function PublishedChargeRow({
  charge,
  onAdded,
  selection,
  declineBrokerIntakeId,
  declineCourierIntakeId,
  preferPayHostBarrelIds,
}: {
  charge: BarrelOutboundShippingChargeView;
  onAdded?: (charge: BarrelOutboundShippingChargeView) => void;
  selection?: {
    name: string;
    selected: boolean;
    onSelect: () => void;
    disabled?: boolean;
  };
  declineBrokerIntakeId?: string;
  declineCourierIntakeId?: string;
  preferPayHostBarrelIds?: readonly string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const kindLabel = outboundChargeKindDisplayLabel(charge);
  const title = charge.partnerName?.trim() || charge.lines[0]?.label || kindLabel;
  const paid = Boolean(charge.paidAt);
  const offPlatform = isOffPlatformOutboundChargeKind(charge.chargeKind);
  const payHost = jointChargePayHost(
    charge.linkedContainers,
    preferPayHostBarrelIds,
  );
  const isJointPayHost = !payHost || payHost.barrelId === charge.barrelId;
  const linkedAliases = (charge.linkedContainers ?? [])
    .map((item) => item.alias)
    .join(" + ");
  const showCartAction = !paid && !offPlatform && !selection && isJointPayHost;
  const showPaymentForm = !paid && offPlatform && !selection && isJointPayHost;

  function addToCart() {
    startTransition(async () => {
      const res = await addOutboundShippingChargeToCartAction({
        chargeId: charge.chargeId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Added to cart.");
      onAdded?.(charge);
      router.refresh();
    });
  }

  const details = (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {kindLabel}
        </p>
        <OutboundCompanyAdButton
          imageUrl={charge.partnerImageUrl}
          companyName={charge.partnerName ?? title}
        />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {charge.partnerCountry ?
        <p className="text-xs text-muted-foreground">{charge.partnerCountry}</p>
      : null}
      {charge.partnerLocation ?
        <p
          className="text-xs font-semibold text-primary"
          title="Where this company transports the container from"
        >
          {charge.partnerLocation}
        </p>
      : null}
      {charge.partnerAddress ?
        <p className="text-xs whitespace-pre-wrap text-muted-foreground">
          {charge.partnerAddress}
        </p>
      : null}
      {charge.partnerPhone ?
        <p className="text-xs text-muted-foreground">Tel {charge.partnerPhone}</p>
      : null}
      {charge.lines.length > 1 ?
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {charge.lines.map((line) => (
            <p key={line.label} className="flex justify-between gap-4">
              <span>{line.label}</span>
              <span className="tabular-nums">{formatUsd(line.amountCents)}</span>
            </p>
          ))}
        </div>
      : null}
      {charge.linkedContainers && charge.linkedContainers.length > 1 ?
        isJointPayHost ?
          <p className="mt-1 text-xs text-muted-foreground">
            Covers {linkedAliases} · first at the 1-container rate, extras at
            the extra rate · one payment marks all paid
          </p>
        : (
          <p className="mt-1 text-xs text-muted-foreground">
            Joint charge of {formatUsd(charge.totalCents)} is on {payHost?.alias ?? "the linked container"}.
            Add to cart from that card — one payment covers {linkedAliases}.
          </p>
        )
      : null}
      {isJointPayHost ?
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {formatUsd(charge.totalCents)}
        </p>
      : null}
      {showPaymentForm ?
        <OutboundOffPlatformPaymentForm
          charge={charge}
          declineBrokerIntakeId={declineBrokerIntakeId}
          declineCourierIntakeId={declineCourierIntakeId}
        />
      : null}
    </div>
  );

  const paidOrderId = charge.paidOrderId?.trim() || null;
  const companyRefund =
    paid && outboundShippingRefundPath(charge) === "company_contact";
  const action =
    paid ?
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <PaidVendorBadge />
        {paidOrderId ?
          <a
            href={freightPaymentInvoiceHref(paidOrderId)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
          >
            Receipt
          </a>
        : (
          <OutboundPaymentReceiptDialog
            charges={[charge]}
            showCustomer={false}
            triggerLabel="Receipt"
            triggerSize="xs"
          />
        )}
        {companyRefund ? <OutboundShippingRefundButton charge={charge} /> : null}
      </div>
    : showCartAction ?
      charge.inCart ?
        <Link
          href="/dashboard/cart"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground"
        >
          <ShoppingCart className="size-3.5" aria-hidden />
          In cart
        </Link>
      : (
        <Button type="button" size="sm" disabled={pending} onClick={addToCart}>
          {pending ? "Adding…" : "Add to cart"}
        </Button>
      )
    : null;

  return (
    <li
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3",
        selection?.selected
          ? "border-primary/55 bg-primary/10"
          : paid
            ? "border-emerald-500/25 bg-background"
            : "border-border/80 bg-background",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {selection ? (
          <label className="relative z-10 mt-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center">
            <input
              type="radio"
              name={selection.name}
              className="sr-only"
              checked={selection.selected}
              disabled={selection.disabled}
              onChange={selection.onSelect}
            />
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded-full border-2",
                selection.selected
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/70 bg-background",
              )}
              aria-hidden
            >
              {selection.selected ?
                <span className="size-1.5 rounded-full bg-primary-foreground" />
              : null}
            </span>
          </label>
        ) : null}
        {details}
      </div>
      {action}
    </li>
  );
}
