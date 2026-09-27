"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function OutboundCompanyAdButton({
  imageUrl,
  companyName,
}: {
  imageUrl: string | null | undefined;
  companyName: string | null | undefined;
}) {
  const url = imageUrl?.trim() || "";
  const [open, setOpen] = useState(false);
  if (!url) return null;
  const title = companyName?.trim() || "Company";

  return (
    <>
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="h-5 px-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
        onClick={() => setOpen(true)}
      >
        Ad
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(92vh,44rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Company image</DialogDescription>
          </DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element -- Vercel Blob company ad */}
          <img
            src={url}
            alt={`${title} advertisement`}
            className="mx-auto max-h-[min(70vh,36rem)] w-full rounded-md object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
