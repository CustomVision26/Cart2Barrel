"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";

import type { AdminSpotlightProductMutationState } from "@/actions/admin-spotlight-products";
import type { AdminUploadSpotlightProductImageState } from "@/actions/admin-spotlight-products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { revokeBlobPreviewUrl } from "@/lib/staged-product-image";

type AdminSpotlightPreviewImageFieldProps = {
  label: string;
  imageUrl: string | null;
  pending: boolean;
  compact?: boolean;
  onRefresh: () => Promise<AdminSpotlightProductMutationState>;
  onUpload: (formData: FormData) => Promise<AdminUploadSpotlightProductImageState>;
  onSetImageUrl: (imageUrl: string) => Promise<AdminSpotlightProductMutationState>;
  onSuccess: () => void;
  runMutation: (fn: () => Promise<void>) => void;
  /** FormData key for entity id (`productId` or `variantId`). */
  entityIdField: "productId" | "variantId";
  entityId: string;
};

export function AdminSpotlightPreviewImageField({
  label,
  imageUrl,
  pending,
  compact = false,
  onRefresh,
  onUpload,
  onSetImageUrl,
  onSuccess,
  runMutation,
  entityIdField,
  entityId,
}: AdminSpotlightPreviewImageFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState("");
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [showUrlPaste, setShowUrlPaste] = useState(false);

  const displayUrl = localPreview ?? imageUrl?.trim() ?? null;
  const hasImage = Boolean(displayUrl);

  const handleFile = (file: File | null) => {
    revokeBlobPreviewUrl(localPreview);
    if (!file) {
      setLocalPreview(null);
      return;
    }
    setLocalPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.set(entityIdField, entityId);
    fd.set("file", file);
    if (imageUrl) fd.set("replace", "true");
    runMutation(async () => {
      const res = await onUpload(fd);
      if (!res.ok) {
        toast.error(res.message);
        revokeBlobPreviewUrl(localPreview);
        setLocalPreview(null);
        return;
      }
      toast.success("Image uploaded.");
      revokeBlobPreviewUrl(localPreview);
      setLocalPreview(null);
      onSuccess();
    });
  };

  const refreshImage = () => {
    runMutation(async () => {
      const res = await onRefresh();
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Image updated.");
      onSuccess();
    });
  };

  const saveUrl = () => {
    const url = urlInput.trim();
    if (!url) {
      toast.error("Enter an https image URL.");
      return;
    }
    runMutation(async () => {
      const res = await onSetImageUrl(url);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message ?? "Image saved.");
      setUrlInput("");
      setShowUrlPaste(false);
      onSuccess();
    });
  };

  const thumbSize = compact ? "size-12" : "size-20";

  return (
    <div className={compact ? "flex flex-col gap-2" : "space-y-3"}>
      {!compact ?
        <Label>{label}</Label>
      : null}
      <div className={compact ? "flex flex-wrap items-start gap-2" : "flex flex-wrap items-start gap-3"}>
        <div
          className={`relative ${thumbSize} shrink-0 overflow-hidden rounded-md border border-border bg-muted`}
        >
          {displayUrl ?
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayUrl} alt="" className="size-full object-cover" />
          : <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageIcon className={compact ? "size-4" : "size-6"} aria-hidden />
            </div>
          }
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {!hasImage && !compact ?
            <p className="text-xs text-muted-foreground">
              No preview image. Refresh from the listing URL, upload a file, or paste
              an https image link.
            </p>
          : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={refreshImage}
            >
              {pending ?
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              : <RefreshCw className="size-3.5" aria-hidden />}
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-3.5" aria-hidden />
              {hasImage ? "Replace" : "Upload"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setShowUrlPaste((v) => !v)}
            >
              Paste URL
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={pending}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              handleFile(f);
              e.target.value = "";
            }}
          />
          {showUrlPaste ?
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="url"
                placeholder="https://…/image.jpg"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={pending}
                className="min-w-[12rem] flex-1"
              />
              <Button type="button" size="sm" disabled={pending} onClick={saveUrl}>
                Save URL
              </Button>
            </div>
          : null}
        </div>
      </div>
    </div>
  );
}
