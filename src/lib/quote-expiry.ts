import { isOperationalQuoteRow } from "@/lib/checkout-snapshot-kind";
import type { ItemQuote } from "@/db/schema";

/** Default: 7 days expressed in minutes. */
export const DEFAULT_QUOTE_EXPIRY_MINUTES = 7 * 24 * 60;
export const MIN_QUOTE_EXPIRY_MINUTES = 1;
/** Cap at 90 days. */
export const MAX_QUOTE_EXPIRY_MINUTES = 90 * 24 * 60;

export type QuoteExpiryDurationUnit = "minutes" | "hours" | "days";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function clampExpiryMinutes(raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_QUOTE_EXPIRY_MINUTES;
  return Math.max(
    MIN_QUOTE_EXPIRY_MINUTES,
    Math.min(MAX_QUOTE_EXPIRY_MINUTES, Math.floor(raw)),
  );
}

export function minutesFromDurationAmount(
  amount: number,
  unit: QuoteExpiryDurationUnit,
): number {
  const n = Math.floor(amount);
  if (!Number.isFinite(n)) return DEFAULT_QUOTE_EXPIRY_MINUTES;
  if (unit === "days") return clampExpiryMinutes(n * 24 * 60);
  if (unit === "hours") return clampExpiryMinutes(n * 60);
  return clampExpiryMinutes(n);
}

/** Prefer the largest whole unit that divides evenly (days → hours → minutes). */
export function preferredDurationUnit(
  minutes: number,
): { amount: number; unit: QuoteExpiryDurationUnit } {
  const m = clampExpiryMinutes(minutes);
  if (m % (24 * 60) === 0) {
    return { amount: m / (24 * 60), unit: "days" };
  }
  if (m % 60 === 0) {
    return { amount: m / 60, unit: "hours" };
  }
  return { amount: m, unit: "minutes" };
}

export function formatQuoteExpiryWindowLabel(minutes: number): string {
  const { amount, unit } = preferredDurationUnit(minutes);
  if (unit === "days") return `${amount} day${amount === 1 ? "" : "s"}`;
  if (unit === "hours") return `${amount} hour${amount === 1 ? "" : "s"}`;
  return `${amount} minute${amount === 1 ? "" : "s"}`;
}

export type QuoteExpirySource = "product" | "customer" | "global";

/** Product override wins, then account-level minutes (customer or hub). */
export function effectiveQuoteExpiryMinutes(
  accountExpiryMinutes: number,
  productOverrideMinutes?: number | null,
): { expiryMinutes: number; source: QuoteExpirySource | "account" } {
  if (
    productOverrideMinutes != null &&
    Number.isFinite(productOverrideMinutes)
  ) {
    return {
      expiryMinutes: clampExpiryMinutes(productOverrideMinutes),
      source: "product",
    };
  }
  return {
    expiryMinutes: clampExpiryMinutes(accountExpiryMinutes),
    source: "account",
  };
}

/**
 * Clock start for accept/pay countdown.
 * Product overrides use the publish/anchor timestamp so “10 minutes” means
 * 10 minutes from when staff published the override — not from the original
 * staff quote time (which can make short overrides look instantly expired).
 */
export function resolveQuoteExpiryClockStart(params: {
  quoteIssuedAt: string | null | undefined;
  productOverrideMinutes?: number | null;
  productOverrideAnchoredAt?: string | null;
}): string | null {
  const hasProductOverride =
    params.productOverrideMinutes != null &&
    Number.isFinite(params.productOverrideMinutes);
  if (hasProductOverride) {
    const anchored = params.productOverrideAnchoredAt?.trim();
    if (anchored) {
      const ms = new Date(anchored).getTime();
      if (Number.isFinite(ms)) return anchored;
    }
  }
  const issued = params.quoteIssuedAt?.trim();
  if (!issued) return null;
  const ms = new Date(issued).getTime();
  return Number.isFinite(ms) ? issued : null;
}

/** Latest non-voided operational quote `createdAt` (when staff issued the estimate). */
export function getLatestOperationalQuoteIssuedAt(
  quotes: readonly Pick<
    ItemQuote,
    "createdAt" | "voidedAt" | "checkoutSnapshotKind"
  >[],
): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const q of quotes) {
    if (q.voidedAt) continue;
    if (!isOperationalQuoteRow(q)) continue;
    const ms = new Date(q.createdAt).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = q.createdAt;
    }
  }
  return best;
}

export function quoteExpiresAtMs(
  quotedAtIso: string,
  expiryMinutes: number,
): number | null {
  const start = new Date(quotedAtIso).getTime();
  if (!Number.isFinite(start)) return null;
  const minutes = clampExpiryMinutes(expiryMinutes);
  return start + minutes * MS_PER_MINUTE;
}

export function isQuoteExpired(
  quotedAtIso: string | null | undefined,
  expiryMinutes: number,
  nowMs: number = Date.now(),
): boolean {
  if (!quotedAtIso) return false;
  const expires = quoteExpiresAtMs(quotedAtIso, expiryMinutes);
  if (expires == null) return false;
  return nowMs >= expires;
}

function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export type QuoteExpiryCountdown = {
  expiryMinutes: number;
  quotedAt: string;
  expiresAt: string;
  /**
   * Whole days remaining when ≥ 1 day left; otherwise 0 (use `remainderLabel`
   * for hours/minutes).
   */
  daysRemaining: number;
  /** Hours component of the live HH:MM:SS timer. */
  hoursInDay: number;
  minutesInDay: number;
  secondsInDay: number;
  /** e.g. `2 days`, `3 hours`, `15 minutes` */
  remainderLabel: string;
  expired: boolean;
  /** Compact label for tables/logs. */
  label: string;
};

function formatRemainderLabel(msLeft: number, expired: boolean): string {
  if (expired || msLeft <= 0) return "Resubmit required";
  if (msLeft >= MS_PER_DAY) {
    const d = Math.max(1, Math.ceil(msLeft / MS_PER_DAY));
    return `${d} ${d === 1 ? "day" : "days"}`;
  }
  if (msLeft >= MS_PER_HOUR) {
    const h = Math.max(1, Math.ceil(msLeft / MS_PER_HOUR));
    return `${h} ${h === 1 ? "hour" : "hours"}`;
  }
  const m = Math.max(1, Math.ceil(msLeft / MS_PER_MINUTE));
  return `${m} ${m === 1 ? "minute" : "minutes"}`;
}

/**
 * Live countdown: HH:MM:SS of the leading day when ≥ 1 day remains; otherwise
 * total time left as HH:MM:SS. Remainder label sits under the timer.
 */
export function formatQuoteExpiryCountdownLabel(
  msLeft: number,
  expired: boolean,
): string {
  if (expired || msLeft <= 0) return "Expired";

  if (msLeft >= MS_PER_DAY) {
    const daysRemaining = Math.max(1, Math.ceil(msLeft / MS_PER_DAY));
    const msInLeadingDay = msLeft - (daysRemaining - 1) * MS_PER_DAY;
    const clamped = Math.min(MS_PER_DAY, Math.max(0, msInLeadingDay));
    const hoursInDay = Math.floor(clamped / MS_PER_HOUR);
    const minutesInDay = Math.floor((clamped % MS_PER_HOUR) / MS_PER_MINUTE);
    const secondsInDay = Math.floor((clamped % MS_PER_MINUTE) / 1000);
    return `${pad2(hoursInDay)}:${pad2(minutesInDay)}:${pad2(secondsInDay)}/${daysRemaining} day`;
  }

  const hours = Math.floor(msLeft / MS_PER_HOUR);
  const minutes = Math.floor((msLeft % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((msLeft % MS_PER_MINUTE) / 1000);
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

function buildCountdownParts(
  expiresMs: number,
  nowMs: number,
): Pick<
  QuoteExpiryCountdown,
  | "daysRemaining"
  | "hoursInDay"
  | "minutesInDay"
  | "secondsInDay"
  | "remainderLabel"
  | "expired"
  | "label"
> {
  const expired = nowMs >= expiresMs;
  const msLeft = Math.max(0, expiresMs - nowMs);

  let hoursInDay = 0;
  let minutesInDay = 0;
  let secondsInDay = 0;
  let daysRemaining = 0;

  if (!expired && msLeft > 0) {
    if (msLeft >= MS_PER_DAY) {
      daysRemaining = Math.max(1, Math.ceil(msLeft / MS_PER_DAY));
      const msInLeadingDay = Math.min(
        MS_PER_DAY,
        Math.max(0, msLeft - (daysRemaining - 1) * MS_PER_DAY),
      );
      hoursInDay = Math.floor(msInLeadingDay / MS_PER_HOUR);
      minutesInDay = Math.floor((msInLeadingDay % MS_PER_HOUR) / MS_PER_MINUTE);
      secondsInDay = Math.floor((msInLeadingDay % MS_PER_MINUTE) / 1000);
    } else {
      hoursInDay = Math.floor(msLeft / MS_PER_HOUR);
      minutesInDay = Math.floor((msLeft % MS_PER_HOUR) / MS_PER_MINUTE);
      secondsInDay = Math.floor((msLeft % MS_PER_MINUTE) / 1000);
    }
  }

  return {
    daysRemaining,
    hoursInDay,
    minutesInDay,
    secondsInDay,
    remainderLabel: formatRemainderLabel(msLeft, expired),
    expired,
    label: formatQuoteExpiryCountdownLabel(msLeft, expired),
  };
}

export function getQuoteExpiryCountdown(
  quotedAtIso: string | null | undefined,
  expiryMinutes: number,
  nowMs: number = Date.now(),
): QuoteExpiryCountdown | null {
  if (!quotedAtIso) return null;
  const minutes = clampExpiryMinutes(expiryMinutes);
  const expiresMs = quoteExpiresAtMs(quotedAtIso, minutes);
  if (expiresMs == null) return null;
  const parts = buildCountdownParts(expiresMs, nowMs);

  return {
    expiryMinutes: minutes,
    quotedAt: quotedAtIso,
    expiresAt: new Date(expiresMs).toISOString(),
    ...parts,
  };
}

/** Countdown to an absolute deadline (e.g. merchandise top-up expiry). */
export function getAbsoluteExpiryCountdown(
  expiresAtIso: string | null | undefined,
  nowMs: number = Date.now(),
): Omit<QuoteExpiryCountdown, "expiryMinutes" | "quotedAt"> | null {
  if (!expiresAtIso?.trim()) return null;
  const expiresMs = new Date(expiresAtIso).getTime();
  if (!Number.isFinite(expiresMs)) return null;
  const parts = buildCountdownParts(expiresMs, nowMs);
  return {
    expiresAt: new Date(expiresMs).toISOString(),
    ...parts,
  };
}

export function formatQuoteExpiryDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Short product number for tables (OP ref or truncated id). */
export function formatItemRequestProductNumber(request: {
  id: string;
  outsidePurchaseReference?: string | null;
}): string {
  const op = request.outsidePurchaseReference?.trim();
  if (op) return op;
  return request.id.replace(/-/g, "").slice(0, 8).toUpperCase();
}
