"use client";

import { useState } from "react";
import { CopyIcon, ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type AdminProductUrlDialogProps = {
  productUrl: string;
};

export function AdminProductUrlDialog({ productUrl }: AdminProductUrlDialogProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="cursor-pointer border-0 bg-transparent p-0 text-left text-sm font-normal text-primary underline-offset-4 hover:text-primary/90 hover:underline dark:hover:text-primary/80"
      >
        Product URL
      </DialogTrigger>
      <DialogContent className="max-w-[min(36rem,calc(100%-2rem))] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Product URL</DialogTitle>
          <DialogDescription>
            Customer-submitted product page link for this request.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-muted px-3 py-2">
          <p className="break-all font-mono text-xs leading-relaxed text-foreground">
            {productUrl}
          </p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleCopy}
            >
              <CopyIcon className="size-4" />
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button
              variant="default"
              size="sm"
              nativeButton={false}
              render={
                <a href={productUrl} target="_blank" rel="noopener noreferrer" />
              }
            >
              <ExternalLinkIcon className="size-4" />
              Open in new tab
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
