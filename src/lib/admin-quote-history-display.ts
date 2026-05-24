import type { AdminQuoteHistoryLine } from "@/data/admin-quote-history";
import type { ItemQuote } from "@/db/schema";
import { isOperationalQuoteRow } from "@/lib/checkout-snapshot-kind";

function quoteRecencyMs(quote: ItemQuote): number {
  return new Date(quote.createdAt).getTime();
}

/** Prefer the latest operational estimate; otherwise the newest saved row. */
export function pickCurrentQuoteHistoryLine(
  lines: AdminQuoteHistoryLine[],
): AdminQuoteHistoryLine {
  if (lines.length === 1) return lines[0]!;
  const sorted = [...lines].sort(
    (a, b) => quoteRecencyMs(b.quote) - quoteRecencyMs(a.quote),
  );
  const operational = sorted.find(
    (line) => isOperationalQuoteRow(line.quote) && line.quote.voidedAt == null,
  );
  return operational ?? sorted[0]!;
}

/** One table row per product (item request), using the current representative quote. */
export function collapseQuoteHistoryToCurrentProducts(
  lines: AdminQuoteHistoryLine[],
): AdminQuoteHistoryLine[] {
  const byRequestId = new Map<string, AdminQuoteHistoryLine[]>();
  for (const line of lines) {
    const bucket = byRequestId.get(line.request.id);
    if (bucket) bucket.push(line);
    else byRequestId.set(line.request.id, [line]);
  }
  return [...byRequestId.values()].map(pickCurrentQuoteHistoryLine);
}

export function countQuoteHistoryProducts(lines: AdminQuoteHistoryLine[]): number {
  return new Set(lines.map((line) => line.request.id)).size;
}

export function quotesForRequestFromHistoryLines(
  lines: AdminQuoteHistoryLine[],
  itemRequestId: string,
): ItemQuote[] {
  return lines
    .filter((line) => line.request.id === itemRequestId)
    .map((line) => line.quote)
    .sort((a, b) => quoteRecencyMs(a) - quoteRecencyMs(b));
}
