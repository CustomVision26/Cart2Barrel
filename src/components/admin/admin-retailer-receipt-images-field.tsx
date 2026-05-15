"use client";

import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { removeAdminRetailerReceiptImageAction } from "@/actions/admin-remove-retailer-receipt-image";
import { uploadAdminRetailerReceiptImagesAction } from "@/actions/admin-upload-retailer-receipt-images";
import { Button } from "@/components/ui/button";
import { RETAILER_RECEIPT_IMAGES_MAX } from "@/lib/retailer-receipt-images";
import { cn } from "@/lib/utils";

export function AdminRetailerReceiptImagesField(props: {
  orderItemId: string;
  initialUrls?: string[] | null;
  disabled?: boolean;
  /** When the host dialog opens, pass `open` so local URLs reset from server props. */
  dialogOpen?: boolean;
}) {
  const { orderItemId, initialUrls, disabled = false, dialogOpen = true } = props;
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [urls, setUrls] = useState<string[]>(() => initialUrls?.filter(Boolean) ?? []);
  const [pending, startTransition] = useTransition();

  const urlsSyncKey = JSON.stringify(initialUrls ?? null);
  useEffect(() => {
    if (!dialogOpen) return;
    setUrls(
      Array.isArray(initialUrls) ?
        initialUrls.filter((u) => typeof u === "string" && u.trim() !== "")
      : [],
    );
  }, [dialogOpen, urlsSyncKey, initialUrls]);

  const onPickFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length || disabled || pending) return;
      const fd = new FormData();
      fd.set("orderItemId", orderItemId);
      for (let i = 0; i < fileList.length; i += 1) {
        fd.append("files", fileList[i]!);
      }
      if (fileRef.current) fileRef.current.value = "";
      startTransition(async () => {
        const res = await uploadAdminRetailerReceiptImagesAction(fd);
        if (res.ok) {
          setUrls(res.allUrls);
          toast.success(
            res.newUrls.length === 1 ?
              "Receipt image saved."
            : `${res.newUrls.length} receipt images saved.`,
          );
          router.refresh();
        } else {
          toast.error(res.message);
        }
      });
    },
    [disabled, orderItemId, pending, router],
  );

  const removeUrl = useCallback(
    (url: string) => {
      if (disabled || pending) return;
      startTransition(async () => {
        const res = await removeAdminRetailerReceiptImageAction({
          orderItemId,
          imageUrl: url,
        });
        if (res.ok) {
          setUrls(res.allUrls);
          toast.success(res.message);
          router.refresh();
        } else {
          toast.error(res.message);
        }
      });
    },
    [disabled, orderItemId, pending, router],
  );

  const atMax = urls.length >= RETAILER_RECEIPT_IMAGES_MAX;

  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-muted/10 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-foreground">Retailer receipt images</p>
          <p className="text-[11px] text-muted-foreground">
            Order confirmation / invoice screenshots ({urls.length}/{RETAILER_RECEIPT_IMAGES_MAX}). JPEG,
            PNG, WebP, or GIF up to 8 MB each.
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
            className="gap-1.5"
            disabled={disabled || pending || atMax}
            onClick={() => fileRef.current?.click()}
          >
            {pending ?
              <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
            : <ImagePlusIcon className="size-3.5" aria-hidden />}
            Add images
          </Button>
        </div>
      </div>

      {urls.length > 0 ?
        <ul className="flex flex-wrap gap-2">
          {urls.map((url) => (
            <li
              key={url}
              className="group relative overflow-hidden rounded-md border border-border bg-background"
            >
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "block",
                  (disabled || pending) && "pointer-events-none opacity-60",
                )}
                title="Open full image"
              >
                <img
                  src={url}
                  alt=""
                  className="size-20 object-cover"
                  loading="lazy"
                />
                <span className="sr-only">Open receipt image</span>
              </a>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-0.5 top-0.5 size-6 rounded-full opacity-90 shadow-sm hover:opacity-100"
                disabled={disabled || pending}
                title="Remove image"
                onClick={() => removeUrl(url)}
              >
                <XIcon className="size-3.5" />
                <span className="sr-only">Remove</span>
              </Button>
            </li>
          ))}
        </ul>
      : (
        <p className="text-[11px] italic text-muted-foreground">No images uploaded yet.</p>
      )}
    </div>
  );
}
