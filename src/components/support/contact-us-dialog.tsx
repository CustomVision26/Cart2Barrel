"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Mail, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";

import { createSupportTicketAction } from "@/actions/support-tickets";
import type { HubContactPublic } from "@/data/hub-contact-settings";
import { SupportTicketComposeForm } from "@/components/support/support-ticket-compose-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DASHBOARD_SUPPORT_ROUTES } from "@/lib/admin-support-routes";

export function ContactUsDialog({
  hubContact,
}: {
  hubContact: HubContactPublic;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmitMessage(payload: {
    body: string;
    imageUrls: string[];
  }) {
    setSubmitting(true);
    try {
      const res = await createSupportTicketAction({
        subject,
        body: payload.body,
        imageUrls: payload.imageUrls,
      });
      if (res.ok) {
        toast.success(res.message);
        setSubject("");
        setBody("");
        setOpen(false);
        if (res.ticketId) {
          router.push(DASHBOARD_SUPPORT_ROUTES.ticket(res.ticketId));
        } else {
          router.push(DASHBOARD_SUPPORT_ROUTES.inbox);
        }
        router.refresh();
      } else {
        toast.error(res.message);
        throw new Error(res.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        className="text-sm font-medium text-foreground hover:text-primary"
      >
        Contact us
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Contact us</DialogTitle>
          <DialogDescription>
            Reach the hub team or send a message about an issue or complaint.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hubContact.publicIntro ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {hubContact.publicIntro}
            </p>
          ) : null}

          <div className="space-y-2 rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Hub contact
            </p>
            <ul className="space-y-2 text-sm">
              {hubContact.supportEmail ? (
                <li>
                  <a
                    href={`mailto:${hubContact.supportEmail}`}
                    className="inline-flex items-center gap-2 text-foreground hover:text-primary"
                  >
                    <Mail className="size-4 shrink-0" aria-hidden />
                    {hubContact.supportEmail}
                  </a>
                </li>
              ) : null}
              {hubContact.supportPhone ? (
                <li>
                  <a
                    href={`tel:${hubContact.supportPhone.replace(/\s/g, "")}`}
                    className="inline-flex items-center gap-2 text-foreground hover:text-primary"
                  >
                    <Phone className="size-4 shrink-0" aria-hidden />
                    {hubContact.supportPhone}
                  </a>
                </li>
              ) : null}
              {hubContact.businessHours ? (
                <li className="text-muted-foreground">{hubContact.businessHours}</li>
              ) : null}
              {hubContact.socialLinks.map((link) => (
                <li key={`${link.label}-${link.url}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-foreground hover:text-primary"
                  >
                    <ExternalLink className="size-4 shrink-0" aria-hidden />
                    {link.label}
                  </a>
                </li>
              ))}
              {!hubContact.supportEmail &&
              !hubContact.supportPhone &&
              !hubContact.businessHours &&
              hubContact.socialLinks.length === 0 ? (
                <li className="text-muted-foreground">
                  Contact details will appear here once the hub team adds them.
                </li>
              ) : null}
            </ul>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-card p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <MessageCircle className="size-4" aria-hidden />
              Send a message
            </p>
            <div className="space-y-2">
              <Label htmlFor="support-subject">Subject</Label>
              <Input
                id="support-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your issue"
                required
                disabled={submitting}
              />
            </div>
            <SupportTicketComposeForm
              textareaId="support-body"
              label="Message"
              placeholder="Describe the issue or complaint you're facing…"
              submitLabel="Submit message"
              disabled={submitting || subject.trim().length < 3}
              body={body}
              onBodyChange={setBody}
              onSubmit={handleSubmitMessage}
            />
            <Link
              href={DASHBOARD_SUPPORT_ROUTES.inbox}
              onClick={() => setOpen(false)}
              className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              View my messages
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
