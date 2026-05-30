"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

function formatStableTimestamp(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type RelativeTimeLabelProps = {
  iso: string;
  className?: string;
  formatRelative: (iso: string) => string;
};

/** Relative time that hydrates safely (stable absolute label until client mount). */
export function RelativeTimeLabel({
  iso,
  className,
  formatRelative,
}: RelativeTimeLabelProps) {
  const [label, setLabel] = useState(() => formatStableTimestamp(iso));

  useEffect(() => {
    setLabel(formatRelative(iso));
  }, [formatRelative, iso]);

  return (
    <time dateTime={iso} className={cn(className)}>
      {label}
    </time>
  );
}
