"use client";

import { useState, useTransition } from "react";
import { DownloadIcon, FileTextIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CustomsClearanceFormProps = {
  url: string;
  containerName?: string;
};

function inferFilename(url: string): string {
  try {
    const { pathname } = new URL(url);
    const base = pathname.split("/").pop();
    if (base && base.includes(".")) {
      return decodeURIComponent(base);
    }
  } catch {
    // Ignore malformed URLs and fall back to a generic name.
  }
  return "customs-clearance-form";
}

export function CustomsClearanceForm({
  url,
  containerName,
}: CustomsClearanceFormProps) {
  const [open, setOpen] = useState(false);
  const [downloading, startDownload] = useTransition();

  function download() {
    startDownload(async () => {
      try {
        // Fetch the blob so the download is forced even though the file is
        // served from a different origin (Vercel Blob), where the `download`
        // attribute on an anchor would otherwise be ignored by the browser.
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error("Request failed");
        }
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = inferFilename(url);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      } catch {
        window.open(url, "_blank", "noopener,noreferrer");
        toast.error("Could not download automatically — opened in a new tab.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <FileTextIcon className="size-3.5" aria-hidden />
        View customs form
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={downloading}
        onClick={download}
      >
        <DownloadIcon className="size-3.5" aria-hidden />
        {downloading ? "Downloading…" : "Download form"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Customs clearance form</DialogTitle>
            <DialogDescription>
              {containerName ?
                `Customs declaration document for ${containerName}.`
              : "Customs declaration document for your container."}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border border-border/60 bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Customs clearance form"
              className="max-h-[60vh] w-full object-contain"
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={downloading}
            onClick={download}
            className="w-full"
          >
            <DownloadIcon className="size-3.5" aria-hidden />
            {downloading ? "Downloading…" : "Download form"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
