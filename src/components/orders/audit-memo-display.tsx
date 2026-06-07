import type { ItemRequestLineSnapshot } from "@/db/schema";
import {
  batchEstimateAuditMemoSections,
  parseBatchEstimateAuditMemo,
} from "@/lib/batch-estimate-audit-memo";
import { parseProductReturnTrackingMemo } from "@/lib/product-return-tracking-memo";
import { parseRefundRequestAuditMemo } from "@/lib/refund-request-audit-memo";
import { parseWarehouseReceiptMemo } from "@/lib/warehouse-receipt-snapshot-memo";
import { cn } from "@/lib/utils";

function isWarehouseReceiptPhase(phase: ItemRequestLineSnapshot["phase"]): boolean {
  return (
    phase === "warehouse_delivery_received" ||
    phase === "warehouse_delivery_received_prior"
  );
}

function memoHandledByStructuredPanel(row: ItemRequestLineSnapshot): boolean {
  const memo = row.auditMemo;
  if (!memo?.trim()) return true;
  if (row.phase === "customer_refund_request_submitted") {
    return parseRefundRequestAuditMemo(memo) != null;
  }
  if (row.phase === "product_return_tracking_saved") {
    return parseProductReturnTrackingMemo(memo) != null;
  }
  if (isWarehouseReceiptPhase(row.phase)) {
    return parseWarehouseReceiptMemo(memo) != null;
  }
  return false;
}

function ProseAuditMemoBlock({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Activity note
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {text}
      </p>
    </div>
  );
}

function BatchEstimateAuditMemoPanel({
  parsed,
}: {
  parsed: ReturnType<typeof parseBatchEstimateAuditMemo> & object;
}) {
  const sections = batchEstimateAuditMemoSections(parsed);
  const isAdmin = parsed.audience.toLowerCase() === "admin";

  return (
    <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Batch estimate totals
          </p>
          {parsed.batchNumber ?
            <p className="mt-1 text-sm font-semibold text-foreground">
              {parsed.batchNumber}
            </p>
          : null}
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            isAdmin ?
              "bg-muted text-muted-foreground"
            : "bg-primary/15 text-primary",
          )}
        >
          {parsed.audience} copy
        </span>
      </div>

      {parsed.estimateRowId ?
        <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
          Estimate row · {parsed.estimateRowId}
        </p>
      : null}

      <div className="mt-4 space-y-4">
        {sections.map((section) => {
          const isSubtotal = section.title === "Customer subtotal";
          return (
            <div key={section.title}>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {section.title}
              </p>
              <ul
                className={cn(
                  "mt-1.5 space-y-1 text-sm tabular-nums",
                  isSubtotal ?
                    "rounded-md border border-primary/20 bg-background/60 px-3 py-2"
                  : "",
                )}
              >
                {section.rows.map((row) => (
                  <li
                    key={row.label}
                    className={cn(
                      "flex justify-between gap-3",
                      isSubtotal ?
                        "font-semibold text-foreground"
                      : "text-muted-foreground",
                    )}
                  >
                    <span className="min-w-0 shrink text-left normal-case">
                      {row.label}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-right",
                        isSubtotal ? "text-foreground" : "text-foreground",
                      )}
                    >
                      {row.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SnapshotAuditMemoDisplay({
  row,
}: {
  row: ItemRequestLineSnapshot;
}) {
  const memo = row.auditMemo?.trim();
  if (!memo || memoHandledByStructuredPanel(row)) return null;

  const batch = parseBatchEstimateAuditMemo(memo);
  if (batch) return <BatchEstimateAuditMemoPanel parsed={batch} />;

  return <ProseAuditMemoBlock text={memo} />;
}
