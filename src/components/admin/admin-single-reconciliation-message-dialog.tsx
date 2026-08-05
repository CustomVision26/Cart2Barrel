"use client";

import type { ReactNode } from "react";

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

/** Message customer dialogue for a single checkout product. */
export function AdminSingleReconciliationMessageDialog({
  open,
  onOpenChange,
  orderItemId,
  productName,
  customerDisplayName,
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
  productName: string;
  customerDisplayName: string | null;
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
  const label = productName.trim() || "product";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Message customer — product</DialogTitle>
          <DialogDescription>
            Single-product price update
            {customerDisplayName ? ` for ${customerDisplayName}` : ""}. Prefill
            covers {label}; attach images if needed.
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
              textareaId={`recon-single-msg-reply-${orderItemId}`}
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
        : <SupportTicketComposeForm
            textareaId={`recon-single-msg-${orderItemId}`}
            label="Message"
            placeholder="Edit the single-product price-update message…"
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
