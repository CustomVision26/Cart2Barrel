"use client";

import { useState, useTransition } from "react";

import { updateHubContactSettingsAction } from "@/actions/hub-contact-settings";
import type { HubContactSettingsPublic } from "@/data/hub-contact-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const textareaClassName =
  "w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function AdminHubContactForm({
  initial,
}: {
  initial: HubContactSettingsPublic;
}) {
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setField<K extends keyof HubContactSettingsPublic>(
    key: K,
    value: string,
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await updateHubContactSettingsAction(form);
      if (res.ok) {
        setMessage(res.message);
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      <p className="text-sm text-muted-foreground">
        These details appear in the customer Contact us dialog and top-bar
        experience.
      </p>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="publicIntro">Public intro</Label>
          <textarea
            id="publicIntro"
            rows={3}
            className={textareaClassName}
            value={form.publicIntro ?? ""}
            onChange={(e) => setField("publicIntro", e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supportEmail">Support email</Label>
          <Input
            id="supportEmail"
            type="email"
            value={form.supportEmail ?? ""}
            onChange={(e) => setField("supportEmail", e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supportPhone">Phone</Label>
          <Input
            id="supportPhone"
            value={form.supportPhone ?? ""}
            onChange={(e) => setField("supportPhone", e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsAppNumber">WhatsApp (digits, country code)</Label>
          <Input
            id="whatsAppNumber"
            value={form.whatsAppNumber ?? ""}
            onChange={(e) => setField("whatsAppNumber", e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessHours">Business hours</Label>
          <Input
            id="businessHours"
            value={form.businessHours ?? ""}
            onChange={(e) => setField("businessHours", e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="instagramUrl">Instagram URL</Label>
          <Input
            id="instagramUrl"
            value={form.instagramUrl ?? ""}
            onChange={(e) => setField("instagramUrl", e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="facebookUrl">Facebook URL</Label>
          <Input
            id="facebookUrl"
            value={form.facebookUrl ?? ""}
            onChange={(e) => setField("facebookUrl", e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="xUrl">X (Twitter) URL</Label>
          <Input
            id="xUrl"
            value={form.xUrl ?? ""}
            onChange={(e) => setField("xUrl", e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tiktokUrl">TikTok URL</Label>
          <Input
            id="tiktokUrl"
            value={form.tiktokUrl ?? ""}
            onChange={(e) => setField("tiktokUrl", e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save hub contact"}
      </Button>
    </form>
  );
}
