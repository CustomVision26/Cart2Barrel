"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { adminReplySupportTicketAction } from "@/actions/admin-support-ticket";
import type { SupportTicketWithMessages } from "@/data/support-tickets";
import { ADMIN_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const textareaClassName =
  "w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

type AdminSupportTicketThreadProps = {
  thread: SupportTicketWithMessages & {
    clerkUserId: string;
    customerDisplayName: string;
    customerEmail: string | null;
  };
};

export function AdminSupportTicketThread({ thread }: AdminSupportTicketThreadProps) {
  const [body, setBody] = useState("");
  const [markResolved, setMarkResolved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await adminReplySupportTicketAction({
        ticketId: thread.id,
        body,
        markResolved,
      });
      if (res.ok) {
        setMessage(res.message);
        setBody("");
        setMarkResolved(false);
        window.location.reload();
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={ADMIN_SUPPORT_ROUTES.inbox}
            className="text-sm text-primary hover:underline"
          >
            ← Back to inbox
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-foreground">
            {thread.subject}
          </h1>
          <p className="text-sm text-muted-foreground">
            {thread.ticketNumber} · {thread.customerDisplayName}
            {thread.customerEmail ? ` · ${thread.customerEmail}` : ""}
          </p>
          <p className="text-xs capitalize text-muted-foreground">
            Status: {thread.status.replace(/_/g, " ")}
          </p>
        </div>
      </div>

      {message ?
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {message}
        </p>
      : null}
      {error ?
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      : null}

      <ul className="space-y-3 rounded-xl border border-border/80 bg-card/30 p-4">
        {thread.messages.map((m) => (
          <li
            key={m.id}
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              m.authorRole === "staff" ?
                "ml-8 border border-primary/25 bg-primary/10"
              : "mr-8 border border-border/60 bg-muted/50",
            )}
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {m.authorRole === "staff" ? "Hub (you)" : "Customer"}
            </p>
            <p className="whitespace-pre-wrap text-foreground">{m.body}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {new Date(m.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-3 border-t border-border pt-4">
        <div className="space-y-2">
          <Label htmlFor="admin-reply">Reply to customer</Label>
          <textarea
            id="admin-reply"
            rows={5}
            className={textareaClassName}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Your official response…"
            required
            disabled={pending}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={markResolved}
            onChange={(e) => setMarkResolved(e.target.checked)}
            disabled={pending}
            className="rounded border-input"
          />
          Mark resolved after sending (customer can still reply to reopen)
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send response"}
        </Button>
      </form>
    </div>
  );
}
