"use client";

import { ImagePlusIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useId, useRef, useTransition } from "react";
import { toast } from "sonner";

import { adminUploadItemRequestProductImageAction } from "@/actions/admin-upload-item-request-product-image";
import { Button } from "@/components/ui/button";
import { RETAILER_RECEIPT_IMAGE_MAX_BYTES } from "@/lib/retailer-receipt-images";
import { validateProductImageFile } from "@/lib/staged-product-image";

export function AdminItemRequestProductImageUpload({
  itemRequestId,
  disabled = false,
  /** When true, only stage a local preview until the parent saves the quote. */
  deferPersist = false,
  onUploaded,
  onStaged,
}: {
  itemRequestId: string;
  disabled?: boolean;
  deferPersist?: boolean;
  onUploaded?: (imageUrl: string) => void;
  onStaged?: (file: File, previewUrl: string) => void;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onPickFile = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length || disabled || pending) return;
      const file = fileList[0];
      if (!file) return;

      const validationError = validateProductImageFile(file);
      if (validationError) {
        toast.error(validationError);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      if (fileRef.current) fileRef.current.value = "";

      if (deferPersist) {
        const previewUrl = URL.createObjectURL(file);
        onStaged?.(file, previewUrl);
        toast.success("Image ready — save the quote to apply it.");
        return;
      }

      const fd = new FormData();
      fd.set("itemRequestId", itemRequestId);
      fd.append("file", file);

      startTransition(async () => {
        const res = await adminUploadItemRequestProductImageAction(fd);
        if (res.ok) {
          onUploaded?.(res.imageUrl);
          toast.success("Product image saved to storage.");
          router.refresh();
        } else {
          toast.error(res.message);
        }
      });
    },
    [deferPersist, disabled, itemRequestId, onStaged, onUploaded, pending, router],
  );

  const maxMb = Math.round(RETAILER_RECEIPT_IMAGE_MAX_BYTES / (1024 * 1024));

  return (
    <div className="flex flex-col items-center gap-3 py-1">
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
        className="gap-1.5"
        disabled={disabled || pending}
        onClick={() => fileRef.current?.click()}
      >
        {pending ? (
          <>
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Uploading…
          </>
        ) : (
          <>
            <ImagePlusIcon className="size-4" aria-hidden />
            Upload product image
          </>
        )}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        JPEG, PNG, WebP, or GIF up to {maxMb} MB.
        {deferPersist ?
          " Preview only until you save the quote."
        : " Saved on Vercel Blob for cart and shopper lists."}
      </p>
    </div>
  );
}
