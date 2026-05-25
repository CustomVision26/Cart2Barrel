"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Globe,
  Mail,
  MessageCircle,
  Phone,
  SendHorizonal,
  Share2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { getHubContactSettingsPublicAction } from "@/actions/hub-contact-settings";
import {
  listMySupportTicketsAction,
  loadMySupportTicketThreadAction,
  replySupportTicketAsCustomerAction,
  submitSupportTicketAction,
} from "@/actions/support-ticket";
import type { HubContactSettingsPublic } from "@/data/hub-contact-settings";
import { DEFAULT_HUB_CONTACT_PUBLIC } from "@/lib/hub-contact-defaults";
import type {
  SupportTicketSummary,
  SupportTicketWithMessages,
} from "@/data/support-tickets";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

const textareaClassName =
  "w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

type ContactUsDialogProps = {
  triggerClassName?: string;
};

function ContactLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
    >
      <Icon className="size-4 shrink-0 text-primary" aria-hidden />
      {label}
    </a>
  );
}

export function ContactUsDialog({ triggerClassName }: ContactUsDialogProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"contact" | "inbox">("contact");
  const [hub, setHub] = useState<HubContactSettingsPublic>({
    ...DEFAULT_HUB_CONTACT_PUBLIC,
  });
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [thread, setThread] = useState<SupportTicketWithMessages | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadInbox = useCallback(async () => {
    const rows = await listMySupportTicketsAction();
    setTickets(rows);
  }, []);

  const loadThread = useCallback(async (ticketId: string) => {
    const data = await loadMySupportTicketThreadAction({ ticketId });
    setThread(data);
    setActiveTicketId(ticketId);
    setTab("inbox");
  }, []);

  const refreshHub = useCallback(async () => {
    const settings = await getHubContactSettingsPublicAction();
    setHub(settings);
  }, []);

  useEffect(() => {
    const shouldOpen = searchParams.get("openContact") === "1";
    const ticketId = searchParams.get("ticketId");
    if (shouldOpen) {
      setOpen(true);
      if (ticketId) {
        void loadThread(ticketId);
      }
    }
  }, [searchParams, loadThread]);

  useEffect(() => {
    if (!open) return;
    void refreshHub();
    void loadInbox();
  }, [open, refreshHub, loadInbox]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("openContact");
      params.delete("ticketId");
      const q = params.toString();
      router.replace(q ? `?${q}` : window.location.pathname, { scroll: false });
    }
  }

  function handleSubmitNew(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await submitSupportTicketAction({ subject, body });
      if (res.ok) {
        setMessage(res.message);
        setSubject("");
        setBody("");
        await loadInbox();
        if (res.ticketId) {
          await loadThread(res.ticketId);
        }
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  }

  function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTicketId) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await replySupportTicketAsCustomerAction({
        ticketId: activeTicketId,
        body: replyBody,
      });
      if (res.ok) {
        setMessage(res.message);
        setReplyBody("");
        await loadThread(activeTicketId);
        await loadInbox();
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  }

  const hasHubContacts =
    hub.supportEmail ||
    hub.supportPhone ||
    hub.whatsAppNumber ||
    hub.instagramUrl ||
    hub.facebookUrl ||
    hub.xUrl ||
    hub.tiktokUrl;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={cn("shrink-0", triggerClassName)}
          />
        }
      >
        Contact us
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90vh,720px)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-4 py-4 pr-12">
          <DialogTitle>Contact Cart2Barrel hub</DialogTitle>
          <DialogDescription>
            Hub contact details, send a complaint or issue, and view your
            conversation history.
          </DialogDescription>
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              variant={tab === "contact" ? "secondary" : "ghost"}
              onClick={() => setTab("contact")}
            >
              Contact &amp; new message
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "inbox" ? "secondary" : "ghost"}
              onClick={() => setTab("inbox")}
            >
              My messages
              {tickets.length > 0 ?
                <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[10px] font-semibold text-primary">
                  {tickets.length}
                </span>
              : null}
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {message ?
            <p className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {message}
            </p>
          : null}
          {error ?
            <p className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          : null}

          {tab === "contact" ?
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {hub.publicIntro ?? DEFAULT_HUB_CONTACT_PUBLIC.publicIntro}
                </p>
                {hub.businessHours ?
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Hours: </span>
                    {hub.businessHours}
                  </p>
                : null}
                {hasHubContacts ?
                  <div className="flex flex-wrap gap-2">
                    {hub.supportEmail ?
                      <ContactLink
                        href={`mailto:${hub.supportEmail}`}
                        label={hub.supportEmail}
                        icon={Mail}
                      />
                    : null}
                    {hub.supportPhone ?
                      <ContactLink
                        href={`tel:${hub.supportPhone.replace(/\s/g, "")}`}
                        label={hub.supportPhone}
                        icon={Phone}
                      />
                    : null}
                    {hub.whatsAppNumber ?
                      <ContactLink
                        href={`https://wa.me/${hub.whatsAppNumber.replace(/\D/g, "")}`}
                        label="WhatsApp"
                        icon={MessageCircle}
                      />
                    : null}
                    {hub.instagramUrl ?
                      <ContactLink
                        href={hub.instagramUrl}
                        label="Instagram"
                        icon={Share2}
                      />
                    : null}
                    {hub.facebookUrl ?
                      <ContactLink
                        href={hub.facebookUrl}
                        label="Facebook"
                        icon={Globe}
                      />
                    : null}
                    {hub.xUrl ?
                      <ContactLink href={hub.xUrl} label="X" icon={Globe} />
                    : null}
                    {hub.tiktokUrl ?
                      <ContactLink href={hub.tiktokUrl} label="TikTok" icon={Share2} />
                    : null}
                  </div>
                : (
                  <p className="text-xs text-muted-foreground">
                    Hub phone and social links will appear here once an admin adds
                    them.
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmitNew} className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">
                  Send an issue or complaint
                </p>
                <div className="space-y-2">
                  <Label htmlFor="support-subject">Subject</Label>
                  <Input
                    id="support-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief summary"
                    required
                    maxLength={200}
                    disabled={pending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-body">Message</Label>
                  <textarea
                    id="support-body"
                    className={textareaClassName}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Describe your issue, order reference, or complaint…"
                    rows={5}
                    required
                    maxLength={8000}
                    disabled={pending}
                  />
                </div>
                <Button type="submit" disabled={pending} className="w-full gap-2">
                  <SendHorizonal className="size-4" aria-hidden />
                  {pending ? "Sending…" : "Submit to hub"}
                </Button>
              </form>
            </div>
          : (
            <div className="flex min-h-[320px] flex-col gap-3 sm:flex-row">
              <ul className="flex max-h-48 shrink-0 flex-col gap-1 overflow-y-auto sm:max-h-none sm:w-40">
                {tickets.length === 0 ?
                  <li className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No messages yet.
                  </li>
                : tickets.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => void loadThread(t.id)}
                      className={cn(
                        "w-full rounded-lg px-2 py-2 text-left text-xs transition-colors",
                        activeTicketId === t.id ?
                          "bg-primary/15 text-foreground ring-1 ring-primary/30"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <span className="block font-medium">{t.ticketNumber}</span>
                      <span className="line-clamp-2">{t.subject}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="min-w-0 flex-1 rounded-lg border border-border/80 bg-card/40 p-3">
                {!thread ?
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Select a conversation to view messages with the hub.
                  </p>
                : (
                  <div className="flex h-full flex-col gap-3">
                    <div>
                      <p className="font-medium text-foreground">{thread.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {thread.ticketNumber} · {thread.status.replace(/_/g, " ")}
                      </p>
                    </div>
                    <ul className="max-h-52 space-y-2 overflow-y-auto">
                      {thread.messages.map((m) => (
                        <li
                          key={m.id}
                          className={cn(
                            "rounded-lg px-3 py-2 text-sm",
                            m.authorRole === "staff" ?
                              "ml-4 border border-primary/20 bg-primary/10"
                            : "mr-4 border border-border/60 bg-muted/50",
                          )}
                        >
                          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {m.authorRole === "staff" ? "Cart2Barrel hub" : "You"}
                          </p>
                          <p className="whitespace-pre-wrap text-foreground">{m.body}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {new Date(m.createdAt).toLocaleString()}
                          </p>
                        </li>
                      ))}
                    </ul>
                    {thread.status !== "closed" ?
                      <form onSubmit={handleReply} className="space-y-2 border-t border-border pt-2">
                        <textarea
                          className={textareaClassName}
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          placeholder="Reply to the hub…"
                          rows={3}
                          required
                          disabled={pending}
                        />
                        <Button type="submit" size="sm" disabled={pending}>
                          {pending ? "Sending…" : "Send reply"}
                        </Button>
                      </form>
                    : (
                      <p className="text-xs text-muted-foreground">
                        This conversation is closed.{" "}
                        <button
                          type="button"
                          className="text-primary underline"
                          onClick={() => setTab("contact")}
                        >
                          Start a new message
                        </button>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
