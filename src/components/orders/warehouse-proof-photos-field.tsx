"use client";

import { CameraIcon, Loader2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useId, useRef, useTransition } from "react";
import { toast } from "sonner";

import { removeWarehouseProofPhotoAction } from "@/actions/remove-warehouse-proof-photo";
import { uploadWarehouseProofPhotosAction } from "@/actions/upload-warehouse-proof-photos";
import { Button } from "@/components/ui/button";
import {
  RETAILER_RECEIPT_IMAGES_MAX,
  RETAILER_RECEIPT_UPLOAD_BATCH_MAX,
} from "@/lib/retailer-receipt-images";

export function WarehouseProofPhotosField({
  orderItemId,
  imageUrls,
  disabled = false,
  onUrlsChange,
}: {
  orderItemId: string;
  imageUrls: string[];
  disabled?: boolean;
  onUrlsChange?: (urls: string[]) => void;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const urls = imageUrls.filter((u) => u.trim().length > 0);
  const atMax = urls.length >= RETAILER_RECEIPT_IMAGES_MAX;

  const onPickFiles = useCallback(
    (fileList: FileList | null) => {
      const files = fileList ? [...fileList] : [];
      if (files.length === 0 || disabled || pending) return;
      if (fileRef.current) fileRef.current.value = "";

      const fd = new FormData();
      fd.set("orderItemId", orderItemId);
      for (const file of files.slice(0, RETAILER_RECEIPT_UPLOAD_BATCH_MAX)) {
        fd.append("files", file);
      }

      startTransition(async () => {
        const res = await uploadWarehouseProofPhotosAction(fd);
        if (res.ok) {
          onUrlsChange?.(res.allUrls);
          toast.success(
            res.newUrls.length === 1 ?
              "Proof photo saved."
            : `${res.newUrls.length} proof photos saved.`,
          );
          router.refresh();
        } else {
          toast.error(res.message);
        }
      });
    },
    [disabled, onUrlsChange, orderItemId, pending, router],
  );

  const removePhoto = useCallback(
    (imageUrl: string) => {
      if (disabled || pending) return;
      startTransition(async () => {
        const res = await removeWarehouseProofPhotoAction({
          orderItemId,
          imageUrl,
        });
        if (res.ok) {
          onUrlsChange?.(res.allUrls);
          toast.success(res.message);
          router.refresh();
        } else {
          toast.error(res.message);
        }
      });
    },
    [disabled, onUrlsChange, orderItemId, pending, router],
  );

  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-muted p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-foreground">Intake proof photos</p>
          <p className="text-[11px] text-muted-foreground">
            Package condition, labels, or damage — up to {RETAILER_RECEIPT_IMAGES_MAX}{" "}
            images (JPEG, PNG, WebP, GIF).
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            disabled={disabled || pending || atMax}
            onChange={(e) => onPickFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1"
            disabled={disabled || pending || atMax}
            onClick={() => fileRef.current?.click()}
          >
            {pending ?
              <Loader2Icon className="size-3.5 animate-spin" />
            : <CameraIcon className="size-3.5" />}
            Add photos
            {urls.length > 0 ?
              <span className="tabular-nums text-muted-foreground">({urls.length})</span>
            : null}
          </Button>
        </div>
      </div>

      {urls.length > 0 ?
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {urls.map((url) => (
            <li key={url} className="relative">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[6rem] items-center justify-center overflow-hidden rounded-md border border-border bg-background p-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Blob URLs */}
                <img
                  src={url}
                  alt="Intake proof"
                  className="max-h-32 w-full object-contain"
                />
              </a>
              <Button
                type="button"
                variant="destructive"
                size="icon-xs"
                className="absolute top-1 right-1 size-6 shadow-sm"
                disabled={disabled || pending}
                aria-label="Remove proof photo"
                onClick={() => removePhoto(url)}
              >
                <XIcon className="size-3" />
              </Button>
            </li>
          ))}
        </ul>
      : <p className="text-[11px] italic text-muted-foreground">No proof photos yet.</p>}
    </div>
  );
}
