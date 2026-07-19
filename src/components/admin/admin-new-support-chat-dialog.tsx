"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

import { adminCreateSupportTicketAction } from "@/actions/admin-support-tickets";
import { SupportTicketComposeForm } from "@/components/support/support-ticket-compose-form";
import type { SupportTicketComposePayload } from "@/components/support/support-ticket-compose-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input, inputFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminProfilePickerRow } from "@/data/customer-pricing-packages";
import { ADMIN_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import { cn } from "@/lib/utils";

type AdminNewSupportChatDialogProps = {
  customers: AdminProfilePickerRow[];
};

export function AdminNewSupportChatDialog({
  customers,
}: AdminNewSupportChatDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customerClerkUserId, setCustomerClerkUserId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool =
      q.length === 0
        ? customers
        : customers.filter(
            (c) =>
              c.displayName.toLowerCase().includes(q) ||
              (c.email?.toLowerCase().includes(q) ?? false),
          );
    return pool.slice(0, 100);
  }, [customers, query]);

  function resetForm() {
    setQuery("");
    setCustomerClerkUserId("");
    setSubject("");
    setBody("");
  }

  async function handleSubmit(payload: SupportTicketComposePayload) {
    if (!customerClerkUserId) {
      toast.error("Select a customer.");
      throw new Error("Select a customer.");
    }
    if (subject.trim().length < 3) {
      toast.error("Subject is too short.");
      throw new Error("Subject is too short.");
    }

    setSubmitting(true);
    try {
      const res = await adminCreateSupportTicketAction({
        customerClerkUserId,
        subject,
        body: payload.body,
        imageUrls: payload.imageUrls,
        productLinks: payload.productLinks,
      });
      if (!res.ok) {
        toast.error(res.message);
        throw new Error(res.message);
      }
      toast.success(res.message);
      resetForm();
      setOpen(false);
      if (res.ticketId) {
        router.push(ADMIN_SUPPORT_ROUTES.ticket(res.ticketId));
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger
        type="button"
        className={cn(buttonVariants({ size: "sm" }))}
      >
        <MessageSquarePlus className="size-4" aria-hidden />
        New chat
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New chat</DialogTitle>
          <DialogDescription>
            Start a conversation with a customer. You can attach product images
            and retailer links for the item you are discussing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="admin-new-chat-customer-filter">Customer</Label>
            <Input
              id="admin-new-chat-customer-filter"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name or email…"
              disabled={submitting}
            />
            <select
              id="admin-new-chat-customer"
              value={customerClerkUserId}
              onChange={(e) => setCustomerClerkUserId(e.target.value)}
              disabled={submitting}
              className={cn(inputFieldClassName, "h-9 text-sm")}
            >
              <option value="">Select customer…</option>
              {filteredCustomers.map((c) => (
                <option key={c.clerkUserId} value={c.clerkUserId}>
                  {c.displayName}
                  {c.email ? ` · ${c.email}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-new-chat-subject">Subject</Label>
            <Input
              id="admin-new-chat-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What is this chat about?"
              disabled={submitting}
            />
          </div>

          <SupportTicketComposeForm
            textareaId="admin-new-chat-body"
            label="Message"
            placeholder="Write your message to the customer…"
            submitLabel="Start chat"
            disabled={
              submitting ||
              !customerClerkUserId ||
              subject.trim().length < 3
            }
            body={body}
            onBodyChange={setBody}
            onSubmit={handleSubmit}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
