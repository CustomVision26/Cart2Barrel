"use client";

import { ImageIcon } from "lucide-react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ReceivedProductPhoto = { url: string; label: string };

const defaultTriggerClassName =
  "inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60 sm:text-sm";

/**
 * Opens received product photos in a dialog. With more than one photo, the
 * dialog shows a slideshow (carousel) the customer can page through.
 */
export function ReceivedPhotosViewer({
  photos,
  triggerLabel,
  triggerClassName,
}: {
  photos: ReceivedProductPhoto[];
  triggerLabel: string;
  triggerClassName?: string;
}) {
  const validPhotos = photos.filter((photo) => photo.url.trim().length > 0);
  if (validPhotos.length === 0) return null;
  const hasMultiple = validPhotos.length > 1;

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className={cn(defaultTriggerClassName, triggerClassName)}
        title={`View ${triggerLabel.toLowerCase()}`}
      >
        <ImageIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
        {triggerLabel}
        {hasMultiple ?
          <span className="tabular-nums text-muted-foreground">
            ({validPhotos.length})
          </span>
        : null}
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,48rem)] w-[min(96vw,42rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{triggerLabel}</DialogTitle>
        </DialogHeader>
        {hasMultiple ?
          <Carousel className="px-12" opts={{ loop: true }}>
            <CarouselContent>
              {validPhotos.map((photo, index) => (
                <CarouselItem key={photo.url}>
                  <figure className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- external blob/CDN URLs */}
                    <img
                      src={photo.url.trim()}
                      alt={photo.label}
                      className="mx-auto max-h-[68vh] w-auto rounded-lg border border-border object-contain shadow-sm"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <figcaption className="text-center text-xs text-muted-foreground">
                      {photo.label} · {index + 1} / {validPhotos.length}
                    </figcaption>
                  </figure>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        : <figure className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- external blob/CDN URLs */}
            <img
              src={validPhotos[0].url.trim()}
              alt={validPhotos[0].label}
              className="mx-auto max-h-[68vh] w-auto rounded-lg border border-border object-contain shadow-sm"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <figcaption className="text-center text-xs text-muted-foreground">
              {validPhotos[0].label}
            </figcaption>
          </figure>
        }
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
