"use client";

import { ImagePlusIcon, LinkIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { uploadSupportTicketImagesAction } from "@/actions/upload-support-ticket-images";
import { Button } from "@/components/ui/button";
import { Input, inputFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { revokeBlobPreviewUrl } from "@/lib/staged-product-image";
import {
  SUPPORT_TICKET_IMAGES_MAX,
  SUPPORT_TICKET_UPLOAD_BATCH_MAX,
} from "@/lib/support-ticket-images";
import {
  normalizeSupportTicketProductLinks,
  SUPPORT_TICKET_PRODUCT_LINKS_MAX,
} from "@/lib/support-ticket-product-links";
import { cn } from "@/lib/utils";

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
};

export type SupportTicketComposePayload = {
  body: string;
  imageUrls: string[];
  productLinks: string[];
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
  onSubmit: (payload: SupportTicketComposePayload) => Promise<void>;
};

function canSubmit(
  body: string,
  pendingImages: PendingImage[],
  productLinks: string[],
): boolean {
  return (
    body.trim().length > 0 ||
    pendingImages.length > 0 ||
    productLinks.length > 0
  );
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
  const linkInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [productLinks, setProductLinks] = useState<string[]>([]);
  const [linkDraft, setLinkDraft] = useState("");
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

  function addProductLink() {
    if (disabled || pending) return;
    const next = normalizeSupportTicketProductLinks([...productLinks, linkDraft]);
    if (next.length === productLinks.length) {
      toast.error("Enter a valid http(s) product URL.");
      return;
    }
    if (next.length > SUPPORT_TICKET_PRODUCT_LINKS_MAX) {
      toast.error(
        `Each message can include up to ${SUPPORT_TICKET_PRODUCT_LINKS_MAX} product links.`,
      );
      return;
    }
    setProductLinks(next);
    setLinkDraft("");
  }

  function removeProductLink(url: string) {
    setProductLinks((current) => current.filter((link) => link !== url));
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
    if (!canSubmit(body, pendingImages, productLinks) || disabled || pending) return;

    startTransition(async () => {
      const imageUrls = await uploadPendingImages();
      if (imageUrls == null) return;

      await onSubmit({
        body: body.trim(),
        imageUrls,
        productLinks,
      });
      onBodyChange("");
      clearPendingImages();
      setProductLinks([]);
      setLinkDraft("");
    });
  }

  const submitDisabled =
    disabled || pending || !canSubmit(body, pendingImages, productLinks);

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

      {productLinks.length > 0 ? (
        <ul className="space-y-1.5">
          {productLinks.map((url) => (
            <li
              key={url}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-xs"
            >
              <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-foreground">{url}</span>
              <button
                type="button"
                onClick={() => removeProductLink(url)}
                disabled={pending}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Remove product link"
              >
                <XIcon className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={linkInputId} className="text-xs text-muted-foreground">
          Product link
        </Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={linkInputId}
            type="url"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addProductLink();
              }
            }}
            placeholder="https://…"
            disabled={
              disabled ||
              pending ||
              productLinks.length >= SUPPORT_TICKET_PRODUCT_LINKS_MAX
            }
            className="min-w-[12rem] flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              disabled ||
              pending ||
              !linkDraft.trim() ||
              productLinks.length >= SUPPORT_TICKET_PRODUCT_LINKS_MAX
            }
            onClick={addProductLink}
          >
            <PlusIcon className="size-4" aria-hidden />
            Add link
          </Button>
        </div>
      </div>

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
          Images up to {SUPPORT_TICKET_IMAGES_MAX} · product links up to{" "}
          {SUPPORT_TICKET_PRODUCT_LINKS_MAX}
        </p>
      </div>
    </form>
  );
}
