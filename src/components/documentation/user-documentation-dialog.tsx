"use client";

import { BookOpen } from "lucide-react";
import { useState } from "react";

import { AdminDocumentationBrowser } from "@/components/documentation/admin-documentation-browser";
import { UserDocumentationBrowser } from "@/components/documentation/user-documentation-browser";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function UserDocumentationDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        className="text-sm font-medium text-foreground hover:text-primary"
      >
        Documentation
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="space-y-2 border-b border-border/80 bg-muted/20 px-4 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="size-5 text-primary" aria-hidden />
            User guide
          </DialogTitle>
          <DialogDescription>
            Every screen has a quick reference for scanning and a full article for
            deeper reading. Pick a topic from the sidebar or search below.
          </DialogDescription>
        </DialogHeader>

        <UserDocumentationBrowser variant="dialog" className="min-h-0 flex-1" />
      </DialogContent>
    </Dialog>
  );
}
