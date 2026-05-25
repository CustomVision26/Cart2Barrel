import { ProductReturnDesiredOutcomeSummary } from "@/components/dashboard/product-return-desired-outcome-options";
import type {
  FulfilledProductReturnRequestBrief,
  PendingProductReturnRequestBrief,
} from "@/data/order-item-product-return-requests";
import { refundRequestReasonKindLabel } from "@/lib/refund-request-audit-memo";

export type ProductReturnRequestDetailsSource =
  | PendingProductReturnRequestBrief
  | FulfilledProductReturnRequestBrief;

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function formatReturnWindow(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start && !end) return "—";
  if (start && end) {
    return `${formatWhen(start)} – ${formatWhen(end)}`;
  }
  return formatWhen(start ?? end);
}

export function ProductReturnRequestDetails({
  request,
  fulfilledAt,
}: {
  request: ProductReturnRequestDetailsSource;
  fulfilledAt?: string | null;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Your return request
      </p>
      <dl className="grid gap-2">
        <div>
          <dt className="text-xs text-muted-foreground">Requested outcome</dt>
          <dd>
            <ProductReturnDesiredOutcomeSummary outcome={request.desiredOutcome} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Reason</dt>
          <dd className="text-foreground">
            {refundRequestReasonKindLabel(request.reasonKind)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Your note</dt>
          <dd className="whitespace-pre-wrap text-foreground">{request.details}</dd>
        </div>
        {request.customerNotes?.trim() ?
          <div>
            <dt className="text-xs text-muted-foreground">Additional notes</dt>
            <dd className="whitespace-pre-wrap text-foreground">
              {request.customerNotes.trim()}
            </dd>
          </div>
        : null}
        <div>
          <dt className="text-xs text-muted-foreground">Return window</dt>
          <dd className="text-foreground">
            {formatReturnWindow(request.returnWindowStart, request.returnWindowEnd)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Submitted</dt>
          <dd className="text-foreground">{formatWhen(request.createdAt)}</dd>
        </div>
        {fulfilledAt ?
          <div>
            <dt className="text-xs text-muted-foreground">Return tracking saved</dt>
            <dd className="text-foreground">{formatWhen(fulfilledAt)}</dd>
          </div>
        : null}
      </dl>
    </div>
  );
}
