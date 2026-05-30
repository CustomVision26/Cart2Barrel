"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import {
  adminReplySupportTicketAction,
  adminUpdateSupportTicketStatusAction,
} from "@/actions/admin-support-tickets";
import type { SupportTicketDetail } from "@/data/support-tickets";
import { SupportTicketComposeForm } from "@/components/support/support-ticket-compose-form";
import { SupportTicketThread } from "@/components/support/support-ticket-thread";
import { inputFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import { SUPPORT_TICKET_STATUS_VALUES } from "@/lib/validations/support";
import { cn } from "@/lib/utils";
import type { SupportTicketStatus } from "@/db/schema";

type AdminTicketDetail = SupportTicketDetail & {
  customerDisplayName: string;
  customerEmail: string | null;
};

const STATUS_OPTIONS: { value: SupportTicketStatus; label: string }[] =
  SUPPORT_TICKET_STATUS_VALUES.map((value) => ({
    value,
    label:
      value === "awaiting_staff"
        ? "Awaiting staff"
        : value === "awaiting_customer"
          ? "Awaiting customer"
          : value.charAt(0).toUpperCase() + value.slice(1),
  }));

export function AdminSupportTicketPanel({ ticket }: { ticket: AdminTicketDetail }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState<SupportTicketStatus>(ticket.status);
  const [statusPending, startStatusTransition] = useTransition();

  async function handleReply(payload: { body: string; imageUrls: string[] }) {
    const res = await adminReplySupportTicketAction({
      ticketId: ticket.id,
      body: payload.body,
      imageUrls: payload.imageUrls,
    });
    if (res.ok) {
      toast.success(res.message);
      router.refresh();
    } else {
      toast.error(res.message);
      throw new Error(res.message);
    }
  }

  function handleStatusChange(next: SupportTicketStatus) {
    setStatus(next);
    startStatusTransition(async () => {
      const res = await adminUpdateSupportTicketStatusAction({
        ticketId: ticket.id,
        status: next,
      });
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
        setStatus(ticket.status);
      }
    });
  }

  return (
    <div className="space-y-4">
      <Link
        href={ADMIN_SUPPORT_ROUTES.inbox}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to inbox
      </Link>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{ticket.subject}</h2>
            <p className="text-sm text-muted-foreground">
              {ticket.customerDisplayName}
              {ticket.customerEmail ? ` · ${ticket.customerEmail}` : ""}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ticket-status" className="text-xs">
              Status
            </Label>
            <select
              id="ticket-status"
              value={status}
              disabled={statusPending}
              onChange={(e) =>
                handleStatusChange(e.target.value as SupportTicketStatus)
              }
              className={cn(inputFieldClassName, "h-8 min-w-[10rem] text-sm")}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <SupportTicketThread
        messages={ticket.messages}
        viewerIsStaff
        customerLabel={ticket.customerDisplayName}
      />

      {status !== "closed" && status !== "resolved" ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <SupportTicketComposeForm
            textareaId="admin-reply"
            label="Reply to customer"
            placeholder="Type your response…"
            submitLabel="Send reply"
            ticketId={ticket.id}
            body={reply}
            onBodyChange={setReply}
            onSubmit={handleReply}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          This ticket is closed. Reopen it to send another reply.
        </p>
      )}
    </div>
  );
}
