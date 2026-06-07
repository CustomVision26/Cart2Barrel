import type { ItemRequest } from "@/db/schema";
import type { ReceivedProductPhoto } from "@/components/orders/received-photos-viewer";

export const OUTSIDE_PURCHASE_CONDITION_IMAGES_MAX = 6;

export type OutsidePurchaseConditionPhotoPlanEntry =
  | { type: "existing"; url: string }
  | { type: "new" };

type OutsidePurchaseConditionRequestLike = Pick<
  ItemRequest,
  | "outsidePurchaseConditionImageUrls"
  | "outsidePurchaseConditionImageUrl"
  | "productImageUrl"
>;

/** Canonical list of received-condition photo URLs for an outside-purchase line. */
export function outsidePurchaseConditionImageUrlsFromRequest(
  request: OutsidePurchaseConditionRequestLike,
): string[] {
  const fromArray = (request.outsidePurchaseConditionImageUrls ?? [])
    .map((url) => url.trim())
    .filter(Boolean);
  if (fromArray.length > 0) {
    return [...new Set(fromArray)];
  }

  const legacy = request.outsidePurchaseConditionImageUrl?.trim();
  if (legacy) {
    const urls = [legacy];
    const product = request.productImageUrl?.trim();
    if (product && product !== legacy) {
      urls.push(product);
    }
    return [...new Set(urls)];
  }

  const product = request.productImageUrl?.trim();
  return product ? [product] : [];
}

export function outsidePurchaseConditionPhotosFromRequest(
  request: OutsidePurchaseConditionRequestLike,
): ReceivedProductPhoto[] {
  return outsidePurchaseConditionImageUrlsFromRequest(request).map((url, index) => ({
    url,
    label:
      index === 0 ?
        "Received condition photo"
      : `Received condition photo ${index + 1}`,
  }));
}

export function parseOutsidePurchaseConditionPhotoPlan(
  raw: unknown,
): OutsidePurchaseConditionPhotoPlanEntry[] | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const plan: OutsidePurchaseConditionPhotoPlanEntry[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") return null;
      if ("type" in entry && entry.type === "new") {
        plan.push({ type: "new" });
        continue;
      }
      if (
        "type" in entry &&
        entry.type === "existing" &&
        "url" in entry &&
        typeof entry.url === "string" &&
        entry.url.trim()
      ) {
        plan.push({ type: "existing", url: entry.url.trim() });
        continue;
      }
      return null;
    }
    return plan;
  } catch {
    return null;
  }
}

export function productDisplayImageIndexFromFormData(
  raw: FormData | null | undefined,
  fallback = 0,
): number {
  if (!(raw instanceof FormData)) return fallback;
  const value = raw.get("productDisplayImageIndex");
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}
