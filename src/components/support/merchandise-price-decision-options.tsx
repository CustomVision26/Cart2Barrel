"use client";

import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { recordMerchandisePriceDecisionAction } from "@/actions/merchandise-price-decision";
import { uploadSupportTicketImagesAction } from "@/actions/upload-support-ticket-images";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  merchandisePriceDecisionOptions,
  type MerchandisePriceDecision,
} from "@/lib/merchandise-reconciliation";
import { revokeBlobPreviewUrl } from "@/lib/staged-product-image";
import {
  SUPPORT_TICKET_IMAGES_MAX,
  SUPPORT_TICKET_UPLOAD_BATCH_MAX,
} from "@/lib/support-ticket-images";
import { cn } from "@/lib/utils";

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
};

export function MerchandisePriceDecisionOptions({
  ticketId,
}: {
  ticketId: string;
}) {
  const router = useRouter();
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [decision, setDecision] = useState<MerchandisePriceDecision | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);

  function clearPendingImages() {
    setPendingImages((current) => {
      for (const image of current) {
        revokeBlobPreviewUrl(image.previewUrl);
      }
      return [];
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    const remaining = SUPPORT_TICKET_IMAGES_MAX - pendingImages.length;
    if (remaining <= 0) {
      toast.error(`You can attach up to ${SUPPORT_TICKET_IMAGES_MAX} images.`);
      return;
    }
    const batch = [...files].slice(0, Math.min(remaining, SUPPORT_TICKET_UPLOAD_BATCH_MAX));
    setPendingImages((prev) => [
      ...prev,
      ...batch.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  }

  function onSubmit() {
    if (!decision) {
      toast.error("Check one option before sending.");
      return;
    }
    startTransition(async () => {
      let imageUrls: string[] = [];
      if (pendingImages.length > 0) {
        const form = new FormData();
        form.set("ticketId", ticketId);
        for (const image of pendingImages) {
          form.append("files", image.file);
        }
        const upload = await uploadSupportTicketImagesAction(form);
        if (!upload.ok) {
          toast.error(upload.message);
          return;
        }
        imageUrls = upload.imageUrls;
      }

      const res = await recordMerchandisePriceDecisionAction({
        ticketId,
        decision,
        note,
        imageUrls,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      clearPendingImages();
      setNote("");
      setDecision(null);
      toast.success(res.message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary/30 bg-card p-4 ring-1 ring-primary/15">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Your decision</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Check one option, then send. You can add a short note and an image if
          needed — it posts into this conversation for the hub team.
        </p>
      </div>
      <fieldset className="space-y-2" disabled={pending}>
        <legend className="sr-only">Purchase price decision</legend>
        {merchandisePriceDecisionOptions.map((option) => {
          const id = `merch-price-decision-${ticketId}-${option.value}`;
          const checked = decision === option.value;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                checked ?
                  "border-primary/60 bg-primary/8 ring-1 ring-primary/30"
                : "border-border/80 bg-background hover:border-primary/35 hover:bg-muted/40",
                pending && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                id={id}
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={checked}
                onChange={() =>
                  setDecision((prev) =>
                    prev === option.value ? null : option.value,
                  )
                }
                disabled={pending}
              />
              <span className="text-sm leading-snug text-foreground">
                {option.label}
              </span>
            </label>
          );
        })}
      </fieldset>

      {decision ?
        <div className="space-y-3 border-t border-border/60 pt-3">
          <div className="space-y-1.5">
            <Label htmlFor={`decision-note-${ticketId}`} className="text-xs">
              Message (optional)
            </Label>
            <textarea
              id={`decision-note-${ticketId}`}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={pending}
              placeholder="Add context for the hub team…"
              className={cn(
                "w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground",
                "outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
              )}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Image (optional)</Label>
            <input
              ref={fileRef}
              id={fileInputId}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={pending}
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || pendingImages.length >= SUPPORT_TICKET_IMAGES_MAX}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlusIcon className="size-3.5" aria-hidden />
                Attach image
              </Button>
              {pendingImages.map((image) => (
                <span
                  key={image.id}
                  className="relative inline-flex size-14 overflow-hidden rounded-md border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.previewUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    className="absolute right-0.5 top-0.5 rounded bg-background/90 p-0.5"
                    disabled={pending}
                    onClick={() =>
                      setPendingImages((prev) => {
                        const target = prev.find((p) => p.id === image.id);
                        if (target) revokeBlobPreviewUrl(target.previewUrl);
                        return prev.filter((p) => p.id !== image.id);
                      })
                    }
                    aria-label="Remove image"
                  >
                    <XIcon className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      : null}

      <Button
        type="button"
        size="sm"
        disabled={pending || !decision}
        onClick={onSubmit}
      >
        {pending ?
          <>
            <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
            Sending…
          </>
        : "Send decision"}
      </Button>
    </div>
  );
}
