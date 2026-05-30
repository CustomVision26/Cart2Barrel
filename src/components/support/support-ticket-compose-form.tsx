"use client";

import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { uploadSupportTicketImagesAction } from "@/actions/upload-support-ticket-images";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type SupportTicketComposeFormProps = {
  textareaId: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  pendingLabel?: string;
  disabled?: boolean;
  /** When replying to an existing ticket; omit for new tickets (staging upload). */
  ticketId?: string | null;
  body: string;
  onBodyChange: (value: string) => void;
  onSubmit: (payload: { body: string; imageUrls: string[] }) => Promise<void>;
};

function canSubmit(body: string, pendingImages: PendingImage[]): boolean {
  return body.trim().length > 0 || pendingImages.length > 0;
}

export function SupportTicketComposeForm({
  textareaId,
  label,
  placeholder,
  submitLabel,
  pendingLabel = "Sending…",
  disabled = false,
  ticketId = null,
  body,
  onBodyChange,
  onSubmit,
}: SupportTicketComposeFormProps) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      for (const image of pendingImages) {
        revokeBlobPreviewUrl(image.previewUrl);
      }
    };
  }, [pendingImages]);

  function clearPendingImages() {
    setPendingImages((current) => {
      for (const image of current) {
        revokeBlobPreviewUrl(image.previewUrl);
      }
      return [];
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function removePendingImage(id: string) {
    setPendingImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target) revokeBlobPreviewUrl(target.previewUrl);
      return current.filter((image) => image.id !== id);
    });
  }

  function onPickFiles(fileList: FileList | null) {
    if (!fileList?.length || disabled || pending) return;

    const next: PendingImage[] = [];
    const remaining = SUPPORT_TICKET_IMAGES_MAX - pendingImages.length;
    if (remaining <= 0) {
      toast.error(`Each message can include up to ${SUPPORT_TICKET_IMAGES_MAX} images.`);
      return;
    }

    const batch = Math.min(fileList.length, remaining, SUPPORT_TICKET_UPLOAD_BATCH_MAX);
    for (let i = 0; i < batch; i += 1) {
      const file = fileList[i]!;
      next.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (fileList.length > batch) {
      toast.error(
        `Only ${batch} image${batch === 1 ? "" : "s"} added (max ${SUPPORT_TICKET_IMAGES_MAX} per message).`,
      );
    }

    setPendingImages((current) => [...current, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadPendingImages(): Promise<string[] | null> {
    if (pendingImages.length === 0) return [];

    const fd = new FormData();
    if (ticketId) fd.set("ticketId", ticketId);
    for (const image of pendingImages) {
      fd.append("files", image.file);
    }

    const res = await uploadSupportTicketImagesAction(fd);
    if (!res.ok) {
      toast.error(res.message);
      return null;
    }
    return res.imageUrls;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit(body, pendingImages) || disabled || pending) return;

    startTransition(async () => {
      const imageUrls = await uploadPendingImages();
      if (imageUrls == null) return;

      await onSubmit({ body: body.trim(), imageUrls });
      onBodyChange("");
      clearPendingImages();
    });
  }

  const submitDisabled = disabled || pending || !canSubmit(body, pendingImages);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Label htmlFor={textareaId}>{label}</Label>
      <textarea
        id={textareaId}
        rows={4}
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || pending}
        className={cn(inputFieldClassName, "min-h-[6rem] py-2 text-sm")}
      />

      {pendingImages.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {pendingImages.map((image) => (
            <li key={image.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.previewUrl}
                alt=""
                className="size-20 rounded-lg object-cover ring-1 ring-border/80"
              />
              <button
                type="button"
                onClick={() => removePendingImage(image.id)}
                disabled={pending}
                className="absolute -right-1.5 -top-1.5 inline-flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
                aria-label="Remove image"
              >
                <XIcon className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="sr-only"
          disabled={disabled || pending || pendingImages.length >= SUPPORT_TICKET_IMAGES_MAX}
          onChange={(e) => onPickFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            disabled || pending || pendingImages.length >= SUPPORT_TICKET_IMAGES_MAX
          }
          onClick={() => fileRef.current?.click()}
        >
          {pending ?
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          : <ImagePlusIcon className="size-4" aria-hidden />}
          Add image
        </Button>
        <Button type="submit" disabled={submitDisabled}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, WebP, or GIF · up to {SUPPORT_TICKET_IMAGES_MAX} per message
        </p>
      </div>
    </form>
  );
}
