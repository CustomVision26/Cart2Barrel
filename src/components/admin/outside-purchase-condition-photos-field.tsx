"use client";

import { StarIcon } from "lucide-react";
import { useCallback, useId } from "react";
import { toast } from "sonner";

import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import { ImageFileInput } from "@/components/ui/image-file-input";
import {
  OUTSIDE_PURCHASE_CONDITION_IMAGES_MAX,
} from "@/lib/outside-purchase-condition-images";
import { validateProductImageFile } from "@/lib/staged-product-image";
import { cn } from "@/lib/utils";

export type OutsidePurchaseConditionPhotoDraft = {
  id: string;
  previewUrl: string;
  file?: File;
  existingUrl?: string;
};

function createDraftFromFile(file: File): OutsidePurchaseConditionPhotoDraft {
  return {
    id: crypto.randomUUID(),
    previewUrl: URL.createObjectURL(file),
    file,
  };
}

export function createOutsidePurchaseConditionDraftFromUrl(
  url: string,
): OutsidePurchaseConditionPhotoDraft {
  return {
    id: crypto.randomUUID(),
    previewUrl: url.trim(),
    existingUrl: url.trim(),
  };
}

export function appendOutsidePurchaseConditionPhotoFiles(
  photos: OutsidePurchaseConditionPhotoDraft[],
  fileList: FileList | null,
  options?: {
    maxPhotos?: number;
    onAdded?: (nextPhotos: OutsidePurchaseConditionPhotoDraft[]) => void;
  },
): OutsidePurchaseConditionPhotoDraft[] {
  const maxPhotos = options?.maxPhotos ?? OUTSIDE_PURCHASE_CONDITION_IMAGES_MAX;
  const files = [...(fileList ?? [])];
  if (files.length === 0) return photos;

  const next = [...photos];
  for (const file of files) {
    if (next.length >= maxPhotos) {
      toast.error(`At most ${maxPhotos} received condition photos.`);
      break;
    }
    const err = validateProductImageFile(file);
    if (err) {
      toast.error(err);
      continue;
    }
    next.push(createDraftFromFile(file));
  }
  options?.onAdded?.(next);
  return next;
}

export function removeOutsidePurchaseConditionPhotoDraft(
  photos: OutsidePurchaseConditionPhotoDraft[],
  id: string,
): OutsidePurchaseConditionPhotoDraft[] {
  const target = photos.find((photo) => photo.id === id);
  if (target?.file) {
    URL.revokeObjectURL(target.previewUrl);
  }
  return photos.filter((photo) => photo.id !== id);
}

export function outsidePurchaseConditionPhotoPlanFromDrafts(
  photos: OutsidePurchaseConditionPhotoDraft[],
) {
  return photos.map((photo) =>
    photo.existingUrl ?
      ({ type: "existing" as const, url: photo.existingUrl })
    : ({ type: "new" as const }),
  );
}

export function appendOutsidePurchaseConditionPhotosToFormData(
  formData: FormData,
  photos: OutsidePurchaseConditionPhotoDraft[],
  displayPhotoId: string | null,
) {
  const displayIndex = photos.findIndex((photo) => photo.id === displayPhotoId);
  formData.set(
    "productDisplayImageIndex",
    String(displayIndex >= 0 ? displayIndex : 0),
  );
  formData.set(
    "conditionPhotoPlan",
    JSON.stringify(outsidePurchaseConditionPhotoPlanFromDrafts(photos)),
  );
  for (const photo of photos) {
    if (photo.file) {
      formData.append("conditionImages", photo.file);
    }
  }
}

export function displayPhotoPreviewUrl(
  photos: OutsidePurchaseConditionPhotoDraft[],
  displayPhotoId: string | null,
): string | null {
  if (photos.length === 0) return null;
  const selected =
    photos.find((photo) => photo.id === displayPhotoId) ?? photos[0] ?? null;
  return selected?.previewUrl ?? null;
}

type OutsidePurchaseConditionPhotosFieldProps = {
  inputId?: string;
  photos: OutsidePurchaseConditionPhotoDraft[];
  displayPhotoId: string | null;
  onPhotosChange: (photos: OutsidePurchaseConditionPhotoDraft[]) => void;
  onDisplayPhotoIdChange: (id: string | null) => void;
  className?: string;
};

export function OutsidePurchaseConditionPhotosField({
  inputId,
  photos,
  displayPhotoId,
  onPhotosChange,
  onDisplayPhotoIdChange,
  className,
}: OutsidePurchaseConditionPhotosFieldProps) {
  const generatedId = useId();
  const fileInputId = inputId ?? `op-condition-images-${generatedId}`;

  const onAddFiles = useCallback(
    (fileList: FileList | null) => {
      const next = appendOutsidePurchaseConditionPhotoFiles(photos, fileList, {
        onAdded: (added) => {
          if (!displayPhotoId && added.length > 0) {
            onDisplayPhotoIdChange(added[0]?.id ?? null);
          }
        },
      });
      if (next !== photos) {
        onPhotosChange(next);
      }
    },
    [displayPhotoId, onDisplayPhotoIdChange, onPhotosChange, photos],
  );

  const onRemove = useCallback(
    (id: string) => {
      const next = removeOutsidePurchaseConditionPhotoDraft(photos, id);
      onPhotosChange(next);
      if (displayPhotoId === id) {
        onDisplayPhotoIdChange(next[0]?.id ?? null);
      }
    },
    [displayPhotoId, onDisplayPhotoIdChange, onPhotosChange, photos],
  );

  return (
    <div className={cn("space-y-3", className)}>
      <ImageFileInput
        id={fileInputId}
        multiple
        onFiles={onAddFiles}
        selectedFileName={
          photos.length > 0 ?
            `${photos.length} photo${photos.length === 1 ? "" : "s"} selected`
          : null
        }
      />
      <p className="text-xs text-muted-foreground">
        Upload one or more photos of the received product. Choose which photo
        customers see as the product display image ({photos.length}/
        {OUTSIDE_PURCHASE_CONDITION_IMAGES_MAX}).
      </p>
      {photos.length > 0 ?
        <ul className="grid gap-3 sm:grid-cols-2">
          {photos.map((photo, index) => {
            const isDisplay = photo.id === displayPhotoId;
            return (
              <li
                key={photo.id}
                className={cn(
                  "rounded-lg border p-2.5",
                  isDisplay ?
                    "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/80 bg-card",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <ProductRequestThumbnail
                    variant="admin"
                    imageUrl={photo.previewUrl}
                    productLabel={`Received condition ${index + 1}`}
                    className="size-20 shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground">
                        Photo {index + 1}
                      </span>
                      {isDisplay ?
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          <StarIcon className="size-3" aria-hidden />
                          Display
                        </span>
                      : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {!isDisplay ?
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => onDisplayPhotoIdChange(photo.id)}
                        >
                          Use as display
                        </Button>
                      : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => onRemove(photo.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      : null}
    </div>
  );
}
