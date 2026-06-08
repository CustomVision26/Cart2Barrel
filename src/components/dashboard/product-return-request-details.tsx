import type { ReactNode } from "react";

import { ProductReturnDesiredOutcomeSummary } from "@/components/dashboard/product-return-desired-outcome-options";
import type {
  FulfilledProductReturnRequestBrief,
  PendingProductReturnRequestBrief,
} from "@/data/order-item-product-return-requests";
import type { ProductReturnDesiredOutcomeContext } from "@/lib/product-return-desired-outcome";
import { refundRequestReasonKindLabel } from "@/lib/refund-request-audit-memo";
import { cn } from "@/lib/utils";

export type ProductReturnRequestDetailsSource =
  | PendingProductReturnRequestBrief
  | FulfilledProductReturnRequestBrief;

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "Not available";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Not available";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatReturnWindow(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start && !end) return "Not specified";
  if (start && end) {
    return `${formatWhen(start)} – ${formatWhen(end)}`;
  }
  return formatWhen(start ?? end);
}

function DetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm leading-relaxed text-foreground">{children}</dd>
    </div>
  );
}

export function ProductReturnRequestDetails({
  request,
  fulfilledAt,
  outcomeContext = "default",
}: {
  request: ProductReturnRequestDetailsSource;
  fulfilledAt?: string | null;
  outcomeContext?: ProductReturnDesiredOutcomeContext;
}) {
  return (
    <section className="rounded-xl border border-border/80 bg-muted/40 p-4">
      <h3 className="text-sm font-semibold text-foreground">Return request summary</h3>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <DetailField label="Requested outcome">
          <ProductReturnDesiredOutcomeSummary
            outcome={request.desiredOutcome}
            context={outcomeContext}
          />
        </DetailField>
        <DetailField label="Reason category">
          {refundRequestReasonKindLabel(request.reasonKind)}
        </DetailField>
        <DetailField label="Your note" className="sm:col-span-2">
          <span className="whitespace-pre-wrap">{request.details}</span>
        </DetailField>
        {request.customerNotes?.trim() ?
          <DetailField label="Notes from Cart2Barrel" className="sm:col-span-2">
            <span className="whitespace-pre-wrap">{request.customerNotes.trim()}</span>
          </DetailField>
        : null}
        <DetailField label="Return window">
          {formatReturnWindow(request.returnWindowStart, request.returnWindowEnd)}
        </DetailField>
        <DetailField label="Submitted">
          <time dateTime={request.createdAt}>{formatWhen(request.createdAt)}</time>
        </DetailField>
        {fulfilledAt ?
          <DetailField label="Return tracking recorded" className="sm:col-span-2">
            <time dateTime={fulfilledAt}>{formatWhen(fulfilledAt)}</time>
          </DetailField>
        : null}
      </dl>
    </section>
  );
}
