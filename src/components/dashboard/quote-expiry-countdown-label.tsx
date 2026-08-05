"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { getQuoteExpiryCountdown } from "@/lib/quote-expiry";

type QuoteExpiryCountdownLabelProps = {
  quotedAt: string;
  expiryMinutes: number;
  className?: string;
  /** Fires once when the live countdown crosses into expired (e.g. refresh to dissolve batches). */
  onExpired?: () => void;
};

/** Live `HH:MM:SS` countdown with structured remainder badge — ticks every second. */
export function QuoteExpiryCountdownLabel({
  quotedAt,
  expiryMinutes,
  className,
  onExpired,
}: QuoteExpiryCountdownLabelProps) {
  // null until mount so SSR HTML matches the first client paint (avoids Date.now() drift).
  const [nowMs, setNowMs] = useState<number | null>(null);
  const expiredNotified = useRef(false);

  useEffect(() => {
    setNowMs(Date.now());
    expiredNotified.current = false;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [quotedAt, expiryMinutes]);

  const countdown =
    nowMs == null ? null : getQuoteExpiryCountdown(quotedAt, expiryMinutes, nowMs);

  useEffect(() => {
    if (!countdown?.expired || expiredNotified.current) return;
    expiredNotified.current = true;
    onExpired?.();
  }, [countdown?.expired, onExpired]);

  const shellClassName = cn(
    "flex w-[8.75rem] flex-col gap-1 rounded-md border border-border/70 bg-muted/60 px-2.5 py-2",
    className,
  );

  if (nowMs == null) {
    return (
      <span className={shellClassName} title="Loading time remaining…">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Time left
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums tracking-tight text-muted-foreground">
          --:--:--
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">&nbsp;</span>
      </span>
    );
  }

  if (!countdown) {
    return (
      <span
        className={cn("text-muted-foreground/70", className)}
        title="Waiting for staff quote timestamp"
      >
        —
      </span>
    );
  }

  const urgent =
    countdown.expired ||
    countdown.daysRemaining <= 1 ||
    (!countdown.expired &&
      new Date(countdown.expiresAt).getTime() - nowMs <= 60 * 60 * 1000);
  const timer = countdown.expired
    ? "Expired"
    : `${String(countdown.hoursInDay).padStart(2, "0")}:${String(countdown.minutesInDay).padStart(2, "0")}:${String(countdown.secondsInDay).padStart(2, "0")}`;

  return (
    <time
      dateTime={countdown.expiresAt}
      className={cn(
        "flex w-[8.75rem] flex-col gap-1 rounded-md border px-2.5 py-2",
        urgent
          ? "border-amber-500/35 bg-amber-500/10"
          : "border-border/70 bg-muted/60",
        className,
      )}
      title={`Window started ${new Date(countdown.quotedAt).toLocaleString()}; expires ${new Date(countdown.expiresAt).toLocaleString()}. Pay before expiry—retailer prices can change.`}
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Time left
      </span>
      <span
        className={cn(
          "font-mono text-sm font-semibold tabular-nums tracking-tight",
          urgent
            ? "text-amber-700 dark:text-amber-400"
            : "text-foreground",
        )}
      >
        {timer}
      </span>
      <span className="text-[11px] tabular-nums text-muted-foreground">
        {countdown.remainderLabel}
      </span>
    </time>
  );
}
