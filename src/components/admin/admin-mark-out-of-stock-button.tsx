"use client";

import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { adminMarkItemRequestOutOfStockAction } from "@/actions/admin-mark-item-request-out-of-stock";
import { uploadAdminOutOfStockAttachmentImagesAction } from "@/actions/admin-upload-out-of-stock-attachment-images";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  OUT_OF_STOCK_ATTACHMENT_IMAGE_MAX_BYTES,
  OUT_OF_STOCK_ATTACHMENT_IMAGES_MAX,
  OUT_OF_STOCK_STAFF_NOTE_MAX_LENGTH,
  isOutOfStockAttachmentImageMime,
} from "@/lib/out-of-stock-staff-attachments";
import { cn } from "@/lib/utils";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl: string;
};

type AdminMarkOutOfStockButtonProps = {
  itemRequestId: string;
  productLabel?: string;
};

export function AdminMarkOutOfStockButton({
  itemRequestId,
  productLabel,
}: AdminMarkOutOfStockButtonProps) {
  const router = useRouter();
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [staffNote, setStaffNote] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [isPending, startTransition] = useTransition();

  const resetForm = useCallback(() => {
    setStaffNote("");
    setPendingAttachments((current) => {
      for (const item of current) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return [];
    });
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  const onPickFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length || isPending) return;

      const next: PendingAttachment[] = [];
      for (let i = 0; i < fileList.length; i += 1) {
        const file = fileList[i];
        if (!file) continue;
        if (pendingAttachments.length + next.length >= OUT_OF_STOCK_ATTACHMENT_IMAGES_MAX) {
          toast.error(
            `At most ${OUT_OF_STOCK_ATTACHMENT_IMAGES_MAX} attachment images.`,
          );
          break;
        }
        if (!isOutOfStockAttachmentImageMime(file.type)) {
          toast.error("Only JPEG, PNG, WebP, and GIF images are allowed.");
          continue;
        }
        if (file.size > OUT_OF_STOCK_ATTACHMENT_IMAGE_MAX_BYTES) {
          toast.error(
            `Each image must be at most ${Math.round(OUT_OF_STOCK_ATTACHMENT_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`,
          );
          continue;
        }
        next.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }

      if (next.length > 0) {
        setPendingAttachments((current) => [...current, ...next]);
      }
      if (fileRef.current) fileRef.current.value = "";
    },
    [isPending, pendingAttachments.length],
  );

  const removePendingAttachment = useCallback((id: string) => {
    setPendingAttachments((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const onConfirm = () => {
    startTransition(async () => {
      try {
        let attachmentImageUrls: string[] = [];

        if (pendingAttachments.length > 0) {
          const formData = new FormData();
          formData.set("itemRequestId", itemRequestId);
          for (const attachment of pendingAttachments) {
            formData.append("files", attachment.file);
          }
          const uploadResult =
            await uploadAdminOutOfStockAttachmentImagesAction(formData);
          if (!uploadResult.ok) {
            toast.error(uploadResult.message ?? "Could not upload attachments.");
            return;
          }
          attachmentImageUrls = uploadResult.urls;
        }

        const res = await adminMarkItemRequestOutOfStockAction({
          itemRequestId,
          staffNote: staffNote.trim() || undefined,
          attachmentImageUrls:
            attachmentImageUrls.length > 0 ? attachmentImageUrls : undefined,
        });
        if (!res.ok) {
          toast.error(res.message ?? "Could not mark out of stock.");
          return;
        }
        toast.success(res.message ?? "Marked out of stock.");
        setOpen(false);
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Request failed.";
        toast.error(
          /fetch|network/i.test(message) ?
            "Upload failed — the connection dropped or the images are too large. Try fewer or smaller images, then restart the dev server after config changes."
          : message,
        );
      }
    });
  };

  const atMaxAttachments =
    pendingAttachments.length >= OUT_OF_STOCK_ATTACHMENT_IMAGES_MAX;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="whitespace-nowrap border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-200"
        onClick={() => setOpen(true)}
      >
        Out of stock
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(92vh,40rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark as out of stock?</DialogTitle>
            <DialogDescription>
              {productLabel?.trim() ?
                <>Staff will tell the customer that &ldquo;{productLabel.trim()}&rdquo; cannot be sourced. The line leaves the active queue and appears in quote history.</>
              : <>The customer will see this product as out of stock on their active products list. It leaves your queue and is recorded in quote history.</>}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor={`${inputId}-note`}
                className="text-xs font-medium text-foreground"
              >
                Out of stock notes
              </label>
              <textarea
                id={`${inputId}-note`}
                value={staffNote}
                disabled={isPending}
                maxLength={OUT_OF_STOCK_STAFF_NOTE_MAX_LENGTH}
                rows={4}
                placeholder="Optional note for the customer — e.g. retailer page shows sold out, alternate SKU unavailable."
                className={cn(
                  "w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
                onChange={(event) => setStaffNote(event.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                {staffNote.length}/{OUT_OF_STOCK_STAFF_NOTE_MAX_LENGTH} characters
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border/80 bg-muted/40 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Out of stock attachment images
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Optional screenshots for the customer ({pendingAttachments.length}/
                    {OUT_OF_STOCK_ATTACHMENT_IMAGES_MAX}). JPEG, PNG, WebP, or GIF up to 8
                    MB each.
                  </p>
                </div>
                <div className="shrink-0">
                  <input
                    ref={fileRef}
                    id={`${inputId}-files`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="sr-only"
                    disabled={isPending || atMaxAttachments}
                    onChange={(event) => onPickFiles(event.target.files)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    disabled={isPending || atMaxAttachments}
                    onClick={() => fileRef.current?.click()}
                  >
                    {isPending ?
                      <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                    : <ImagePlusIcon className="size-3.5" aria-hidden />}
                    Add images
                  </Button>
                </div>
              </div>

              {pendingAttachments.length > 0 ?
                <ul className="flex flex-wrap gap-2">
                  {pendingAttachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="group relative overflow-hidden rounded-md border border-border bg-background"
                    >
                      <img
                        src={attachment.previewUrl}
                        alt=""
                        className="size-20 object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute right-0.5 top-0.5 size-6 rounded-full opacity-90 shadow-sm hover:opacity-100"
                        disabled={isPending}
                        title="Remove image"
                        onClick={() => removePendingAttachment(attachment.id)}
                      >
                        <XIcon className="size-3.5" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              : <p className="text-[11px] italic text-muted-foreground">
                  No attachment images selected yet.
                </p>
              }
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={onConfirm}
            >
              {isPending ?
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Updating…
                </>
              : "Confirm out of stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
