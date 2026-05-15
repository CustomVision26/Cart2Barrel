import type { ItemRequest } from "@/db/schema";
import { canonicalBatchSiteKey } from "@/lib/batch-site-key";

/**
 * Verify `candidateIds` are a valid same-retailer batch: only quoted unbatched rows,
 * one site key, and at least two lines. Subsets are allowed (remaining quoted lines on
 * that site can go into another draft batch later).
 */
export function validateQuotedFullSiteSelection(
  allQuotedUnbatched: ItemRequest[],
  candidateIds: string[]
): { ok: true; siteKey: string } | { ok: false; message: string } {
  let chosenKey: string | null = null;
  const uniq = [...new Set(candidateIds)];
  if (candidateIds.length !== uniq.length) {
    return {
      ok: false,
      message: "Each item can only be selected once for a batch.",
    };
  }
  if (uniq.length === 0) {
    return { ok: false, message: "Select items to batch." };
  }

  const rows = allQuotedUnbatched.filter((r) => uniq.includes(r.id));
  if (rows.length !== uniq.length) {
    return {
      ok: false,
      message:
        "One or more selected products already belong to a batch quote. Refresh the page — they may appear under Batch Quotes — or pick different items.",
    };
  }
  for (const r of rows) {
    const k = canonicalBatchSiteKey(r.siteName, r.productUrl);
    chosenKey ??= k;
    if (k !== chosenKey) {
      return {
        ok: false,
        message: "Selections must stay on one retailer (mixed sites).",
      };
    }
  }
  const key = chosenKey ?? "unknown_site";

  if (uniq.length < 2) {
    return {
      ok: false,
      message: "Select at least two quoted products from one site to start a batch.",
    };
  }

  return { ok: true, siteKey: key };
}
