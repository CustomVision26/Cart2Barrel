"use client";

import { Loader2Icon, ScanBarcodeIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useId, useRef, useTransition } from "react";
import { toast } from "sonner";

import { removeWarehouseBarcodeImageAction } from "@/actions/remove-warehouse-barcode-image";
import { uploadWarehouseBarcodeImageAction } from "@/actions/upload-warehouse-barcode-image";
import { Button } from "@/components/ui/button";

export function WarehouseBarcodeImageField(props: {
  orderItemId: string;
  /** Current barcode photo URL from the server row (refreshed after upload/remove). */
  imageUrl?: string | null;
  disabled?: boolean;
}) {
  const { orderItemId, imageUrl, disabled = false } = props;
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const url = imageUrl?.trim() ? imageUrl.trim() : null;

  const onPickFile = useCallback(
    (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file || disabled || pending) return;
      const fd = new FormData();
      fd.set("orderItemId", orderItemId);
      fd.append("file", file);
      if (fileRef.current) fileRef.current.value = "";
      startTransition(async () => {
        const res = await uploadWarehouseBarcodeImageAction(fd);
        if (res.ok) {
          toast.success("Barcode photo saved.");
          router.refresh();
        } else {
          toast.error(res.message);
        }
      });
    },
    [disabled, orderItemId, pending, router],
  );

  const removePhoto = useCallback(() => {
    if (disabled || pending || !url) return;
    startTransition(async () => {
      const res = await removeWarehouseBarcodeImageAction({ orderItemId });
      if (res.ok) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }, [disabled, orderItemId, pending, router, url]);

  return (
    <div className="space-y-2 rounded-lg border border-border/80 bg-muted/10 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-foreground">Barcode photo</p>
          <p className="text-[11px] text-muted-foreground">
            Optional — JPEG, PNG, WebP, or GIF up to 8 MB. Stored on Vercel Blob.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={disabled || pending}
            onChange={(e) => onPickFile(e.target.files)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1"
            disabled={disabled || pending}
            onClick={() => fileRef.current?.click()}
          >
            {pending ?
              <Loader2Icon className="size-3.5 animate-spin" />
            : <ScanBarcodeIcon className="size-3.5" />}
            {url ? "Replace" : "Upload"}
          </Button>
          {url ?
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={disabled || pending}
              onClick={removePhoto}
            >
              <XIcon className="size-3.5" />
              Remove
            </Button>
          : null}
        </div>
      </div>
      {url ?
        <div className="relative mt-1 overflow-hidden rounded-md border border-border bg-background">
          {/* eslint-disable-next-line @next/next/no-img-element -- Blob URLs are arbitrary hosts */}
          <img
            src={url}
            alt="Barcode"
            className="mx-auto max-h-48 w-full object-contain"
          />
        </div>
      :
        <p className="text-[11px] italic text-muted-foreground">No barcode photo yet.</p>
      }
    </div>
  );
}
