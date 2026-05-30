"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateHubContactSettingsAction } from "@/actions/admin-hub-contact-settings";
import type { HubContactPublic } from "@/data/hub-contact-settings";
import { Button } from "@/components/ui/button";
import { Input, inputFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function AdminHubContactForm({ initial }: { initial: HubContactPublic }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [supportEmail, setSupportEmail] = useState(initial.supportEmail ?? "");
  const [supportPhone, setSupportPhone] = useState(initial.supportPhone ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(initial.whatsappNumber ?? "");
  const [publicIntro, setPublicIntro] = useState(initial.publicIntro ?? "");
  const [businessHours, setBusinessHours] = useState(initial.businessHours ?? "");
  const [instagramUrl, setInstagramUrl] = useState(initial.instagramUrl ?? "");
  const [facebookUrl, setFacebookUrl] = useState(initial.facebookUrl ?? "");
  const [xUrl, setXUrl] = useState(initial.xUrl ?? "");
  const [tiktokUrl, setTiktokUrl] = useState(initial.tiktokUrl ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateHubContactSettingsAction({
        supportEmail,
        supportPhone,
        whatsappNumber,
        publicIntro,
        businessHours,
        instagramUrl,
        facebookUrl,
        xUrl,
        tiktokUrl,
      });
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor="hub-support-email">Support email</Label>
          <Input
            id="hub-support-email"
            type="email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            placeholder="support@cart2barrel.com"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="hub-support-phone">Phone</Label>
            <Input
              id="hub-support-phone"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hub-whatsapp">WhatsApp number</Label>
            <Input
              id="hub-whatsapp"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="+1 555 123 4567"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="hub-intro">Intro message</Label>
          <textarea
            id="hub-intro"
            rows={3}
            value={publicIntro}
            onChange={(e) => setPublicIntro(e.target.value)}
            placeholder="Short welcome shown on the Contact us screen."
            className={cn(inputFieldClassName, "min-h-[5rem] py-2 text-sm")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hub-hours">Business hours</Label>
          <Input
            id="hub-hours"
            value={businessHours}
            onChange={(e) => setBusinessHours(e.target.value)}
            placeholder="Mon–Fri 9am–5pm AST"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-sm font-medium text-foreground">Social links</h2>
          <p className="text-xs text-muted-foreground">
            Full URLs for each channel shown on Contact us.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Instagram</Label>
            <Input
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Facebook</Label>
            <Input
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
              placeholder="https://facebook.com/..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">X (Twitter)</Label>
            <Input
              value={xUrl}
              onChange={(e) => setXUrl(e.target.value)}
              placeholder="https://x.com/..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">TikTok</Label>
            <Input
              value={tiktokUrl}
              onChange={(e) => setTiktokUrl(e.target.value)}
              placeholder="https://tiktok.com/@..."
            />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save contact settings"}
      </Button>
    </form>
  );
}
