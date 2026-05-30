"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { userReplySupportTicketAction } from "@/actions/support-tickets";
import type { SupportTicketDetail } from "@/data/support-tickets";
import { SupportTicketComposeForm } from "@/components/support/support-ticket-compose-form";
import { SupportTicketThread } from "@/components/support/support-ticket-thread";
import { DASHBOARD_SUPPORT_ROUTES } from "@/lib/admin-support-routes";

export function UserSupportTicketPanel({ ticket }: { ticket: SupportTicketDetail }) {
  const router = useRouter();
  const [reply, setReply] = useState("");

  async function handleReply(payload: { body: string; imageUrls: string[] }) {
    const res = await userReplySupportTicketAction({
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

  return (
    <div className="space-y-4">
      <Link
        href={DASHBOARD_SUPPORT_ROUTES.inbox}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to messages
      </Link>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold text-foreground">{ticket.subject}</h2>
        <p className="text-sm text-muted-foreground">
          Conversation with Cart2Barrel support
        </p>
      </div>

      <SupportTicketThread messages={ticket.messages} viewerIsStaff={false} />

      {ticket.status !== "closed" && ticket.status !== "resolved" ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <SupportTicketComposeForm
            textareaId="user-reply"
            label="Add a follow-up"
            placeholder="Reply to the hub team…"
            submitLabel="Send message"
            ticketId={ticket.id}
            body={reply}
            onBodyChange={setReply}
            onSubmit={handleReply}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          This conversation is closed. Open a new message from Contact us if you
          need more help.
        </p>
      )}
    </div>
  );
}
