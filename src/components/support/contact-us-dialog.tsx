"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { createSupportTicketAction } from "@/actions/support-tickets";
import type { HubContactPublic } from "@/data/hub-contact-settings";
import {
  googleMapsSearchUrl,
  hubContactHasPublicDetails,
} from "@/lib/hub-contact-display";
import {
  HubContactIcons,
  hubSocialIcon,
} from "@/components/support/hub-contact-icons";
import {
  SupportTicketComposeForm,
  type SupportTicketComposePayload,
} from "@/components/support/support-ticket-compose-form";
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
import {
  clearContactUsQuery,
  CONTACT_US_OPEN_EVENT,
  urlRequestsContactUsDialog,
} from "@/lib/contact-us-open";

export function ContactUsDialog({
  hubContact,
  allowTicketSubmit = true,
  triggerClassName,
}: {
  hubContact: HubContactPublic;
  allowTicketSubmit?: boolean;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openDialog = () => setOpen(true);
    if (urlRequestsContactUsDialog()) {
      openDialog();
    }
    window.addEventListener(CONTACT_US_OPEN_EVENT, openDialog);
    return () => {
      window.removeEventListener(CONTACT_US_OPEN_EVENT, openDialog);
    };
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      clearContactUsQuery();
    }
  }
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmitMessage(payload: SupportTicketComposePayload) {
    setSubmitting(true);
    try {
      const res = await createSupportTicketAction({
        subject,
        body: payload.body,
        imageUrls: payload.imageUrls,
        productLinks: payload.productLinks,
      });
      if (res.ok) {
        toast.success(res.message);
        setSubject("");
        setBody("");
        setOpen(false);
        clearContactUsQuery();
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        type="button"
        className={
          triggerClassName ??
          "text-sm font-medium text-foreground hover:text-primary"
        }
      >
        Contact us
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Contact us</DialogTitle>
          <DialogDescription>
            {allowTicketSubmit
              ? "Reach the hub team or send a message about an issue or complaint."
              : "Reach the hub team by email, phone, or social. Sign in to send a message and track replies."}
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
              {hubContact.businessAddress ? (
                <li>
                  <a
                    href={googleMapsSearchUrl(hubContact.businessAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-2 text-foreground hover:text-primary"
                  >
                    <HubContactIcons.MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span className="whitespace-pre-line">{hubContact.businessAddress}</span>
                  </a>
                </li>
              ) : null}
              {hubContact.supportEmail ? (
                <li>
                  <a
                    href={`mailto:${hubContact.supportEmail}`}
                    className="inline-flex items-center gap-2 text-foreground hover:text-primary"
                  >
                    <HubContactIcons.Mail className="size-4 shrink-0" aria-hidden />
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
                    <HubContactIcons.Phone className="size-4 shrink-0" aria-hidden />
                    {hubContact.supportPhone}
                  </a>
                </li>
              ) : null}
              {hubContact.businessHours ? (
                <li className="inline-flex items-start gap-2 text-muted-foreground">
                  <HubContactIcons.Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{hubContact.businessHours}</span>
                </li>
              ) : null}
              {hubContact.socialLinks.map((link) => (
                <li key={`${link.label}-${link.url}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-foreground hover:text-primary"
                  >
                    {hubSocialIcon(link.label)}
                    {link.label}
                  </a>
                </li>
              ))}
              {!hubContactHasPublicDetails(hubContact) ? (
                <li className="text-muted-foreground">
                  Contact details will appear here once the hub team adds them.
                </li>
              ) : null}
            </ul>
          </div>

          {allowTicketSubmit ? (
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
          ) : (
            <div className="space-y-3 rounded-lg border border-border bg-card p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MessageCircle className="size-4" aria-hidden />
                Send a message
              </p>
              <p className="text-sm text-muted-foreground">
                Sign in to send a message and track replies. You can still reach
                the hub with the contact details above.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-8 items-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Sign up
                </Link>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
