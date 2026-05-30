"use client";

import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

type SupportTicketMessageImagesProps = {
  imageUrls: string[];
  className?: string;
};

export function SupportTicketMessageImages({
  imageUrls,
  className,
}: SupportTicketMessageImagesProps) {
  if (imageUrls.length === 0) return null;

  return (
    <ul className={cn("mt-2 flex flex-wrap gap-2", className)}>
      {imageUrls.map((url) => (
        <li key={url}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-lg ring-1 ring-border/80 transition hover:ring-primary/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Support attachment"
              className="size-24 object-cover sm:size-28"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
