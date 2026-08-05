"use client";

import { useMemo, useState, type ReactNode } from "react";

import {
  SupportTicketComposeForm,
  type SupportTicketComposePayload,
} from "@/components/support/support-ticket-compose-form";
import { SupportTicketThread } from "@/components/support/support-ticket-thread";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SupportTicketMessageRow } from "@/data/support-tickets";
import { formatUsd } from "@/lib/admin-markup";
import {
  allocateBatchActualChargesToProducts,
  availableReconciliationChargeRows,
  productCheckoutChargeBreakdown,
  reconciliationChargeTotalCents,
  type ReconciliationChargeBreakdown,
  type ReconciliationProductLineInput,
} from "@/lib/merchandise-reconciliation";
import { cn } from "@/lib/utils";

function shortProductLabel(name: string, index: number): string {
  const trimmed = name.trim() || `Product ${index + 1}`;
  return trimmed.length > 28 ? `${trimmed.slice(0, 28)}…` : trimmed;
}

/** Message customer dialogue for a batch — review each product, then send one update. */
export function AdminBatchReconciliationMessageDialog({
  open,
  onOpenChange,
  orderItemId,
  batchLabel,
  customerDisplayName,
  products,
  checkout,
  actual,
  dialogueTicketId,
  ticketMessages,
  message,
  onMessageChange,
  replyDraft,
  onReplyDraftChange,
  onSendInitial,
  onReply,
  pending = false,
  composeTrailingActions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderItemId: string;
  batchLabel: string;
  customerDisplayName: string | null;
  products: ReconciliationProductLineInput[];
  checkout: ReconciliationChargeBreakdown;
  actual: ReconciliationChargeBreakdown;
  dialogueTicketId: string | null;
  ticketMessages: SupportTicketMessageRow[];
  message: string;
  onMessageChange: (value: string) => void;
  replyDraft: string;
  onReplyDraftChange: (value: string) => void;
  onSendInitial: (payload: SupportTicketComposePayload) => Promise<void>;
  onReply: (payload: SupportTicketComposePayload) => Promise<void>;
  pending?: boolean;
  composeTrailingActions?: ReactNode;
}) {
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const safeProducts = products.length > 0 ? products : [];
  const activeIndex = Math.min(
    Math.max(0, activeProductIndex),
    Math.max(0, safeProducts.length - 1),
  );
  const activeProduct = safeProducts[activeIndex] ?? null;

  const allocatedActuals = useMemo(
    () => allocateBatchActualChargesToProducts(safeProducts, actual),
    [safeProducts, actual],
  );

  const activeCheckout = activeProduct
    ? productCheckoutChargeBreakdown(activeProduct)
    : checkout;
  const activeActual = allocatedActuals[activeIndex] ?? actual;
  const activeRows = availableReconciliationChargeRows(
    activeCheckout,
    activeActual,
  );
  const batchCheckoutTotal = reconciliationChargeTotalCents(checkout);
  const batchActualTotal = reconciliationChargeTotalCents(actual);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,780px)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Message customer — batch</DialogTitle>
          <DialogDescription>
            Review each product in{" "}
            <span className="font-mono text-foreground">
              {batchLabel.trim() || "this batch"}
            </span>
            {customerDisplayName ? ` for ${customerDisplayName}` : ""}, then send
            one batch price-update message.
          </DialogDescription>
        </DialogHeader>

        {dialogueTicketId && ticketMessages.length > 0 ?
          <div className="space-y-3">
            <div className="max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card sm:max-h-80">
              <SupportTicketThread
                messages={ticketMessages}
                viewerIsStaff
                customerLabel={customerDisplayName ?? "Customer"}
                className="border-0 bg-transparent"
              />
            </div>
            <SupportTicketComposeForm
              textareaId={`recon-batch-msg-reply-${orderItemId}`}
              label="Reply"
              placeholder="Type your response…"
              submitLabel="Send reply"
              ticketId={dialogueTicketId}
              body={replyDraft}
              onBodyChange={onReplyDraftChange}
              onSubmit={onReply}
              disabled={pending}
              trailingActions={composeTrailingActions}
            />
          </div>
        : <div className="space-y-4">
            {safeProducts.length > 0 ?
              <div className="space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Products in this batch ({safeProducts.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {safeProducts.map((product, i) => (
                    <button
                      key={product.productNumber ?? `${product.productName}-${i}`}
                      type="button"
                      onClick={() => setActiveProductIndex(i)}
                      className={cn(
                        "rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                        i === activeIndex ?
                          "border-primary/50 bg-primary/15 text-foreground"
                        : "border-border/60 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground",
                      )}
                    >
                      <span className="font-medium tabular-nums text-muted-foreground">
                        {i + 1}.
                      </span>{" "}
                      {shortProductLabel(product.productName, i)}
                    </button>
                  ))}
                </div>

                {activeProduct ?
                  <div className="space-y-2 rounded-md border border-border/50 bg-background/40 p-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium leading-snug text-foreground">
                        {activeIndex + 1}.{" "}
                        {activeProduct.productName.trim() || "Product"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {[
                          activeProduct.productNumber?.trim() ?
                            `Product #: ${activeProduct.productNumber.trim()}`
                          : null,
                          activeProduct.quantity != null &&
                          activeProduct.quantity > 0 ?
                            `Qty: ${Math.floor(activeProduct.quantity)}`
                          : null,
                          activeProduct.sizeLabel?.trim() ?
                            `Size: ${activeProduct.sizeLabel.trim()}`
                          : null,
                          activeProduct.colorLabel?.trim() ?
                            `Color: ${activeProduct.colorLabel.trim()}`
                          : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <dl className="space-y-1 text-xs">
                        <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                          Checkout (this product)
                        </dt>
                        {activeRows.map((r) => (
                          <div
                            key={`c-${r.key}`}
                            className="flex justify-between gap-2"
                          >
                            <span className="text-muted-foreground">
                              {r.label}
                            </span>
                            <span className="tabular-nums font-medium">
                              {formatUsd(r.checkoutCents)}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between gap-2 border-t border-border/50 pt-1">
                          <span className="font-medium">Subtotal</span>
                          <span className="tabular-nums font-semibold">
                            {formatUsd(
                              reconciliationChargeTotalCents(activeCheckout),
                            )}
                          </span>
                        </div>
                      </dl>
                      <dl className="space-y-1 text-xs">
                        <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                          Updated (allocated)
                        </dt>
                        {activeRows.map((r) => (
                          <div
                            key={`a-${r.key}`}
                            className="flex justify-between gap-2"
                          >
                            <span className="text-muted-foreground">
                              {r.label}
                            </span>
                            <span className="tabular-nums font-medium">
                              {formatUsd(r.actualCents)}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between gap-2 border-t border-border/50 pt-1">
                          <span className="font-medium">Subtotal</span>
                          <span className="tabular-nums font-semibold">
                            {formatUsd(
                              reconciliationChargeTotalCents(activeActual),
                            )}
                          </span>
                        </div>
                      </dl>
                    </div>
                    <div className="flex flex-wrap gap-3 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                      <span>
                        Batch checkout:{" "}
                        <span className="tabular-nums text-foreground">
                          {formatUsd(batchCheckoutTotal)}
                        </span>
                      </span>
                      <span>
                        Batch updated:{" "}
                        <span className="tabular-nums text-foreground">
                          {formatUsd(batchActualTotal)}
                        </span>
                      </span>
                    </div>
                  </div>
                : null}
              </div>
            : null}

            <SupportTicketComposeForm
              textareaId={`recon-batch-msg-${orderItemId}`}
              label="Batch message"
              placeholder="Edit the batch price-update message (includes each product)…"
              submitLabel="Send to customer"
              body={message}
              onBodyChange={onMessageChange}
              onSubmit={async (payload) => {
                await onSendInitial(payload);
                onOpenChange(false);
              }}
              disabled={pending}
              trailingActions={composeTrailingActions}
            />
          </div>
        }

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
