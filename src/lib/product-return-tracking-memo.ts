import type { ProductReturnDesiredOutcome } from "@/lib/product-return-desired-outcome";
import { PRODUCT_RETURN_AWAITING_REFUND_LABEL } from "@/lib/product-return-request-labels";
import { z } from "zod";

export const PRODUCT_RETURN_STATUS_HEADLINE = "Product return: awaiting delivery";

const productReturnTrackingMemoSchema = z.object({
  kind: z.literal("product_return_tracking_v1"),
  orderItemId: z.string().uuid(),
  trackingUrl: z.string().optional(),
  retailerTrackingCompany: z.string().optional(),
  retailerTrackingNumber: z.string().optional(),
});

export type ProductReturnTrackingMemoV1 = z.infer<
  typeof productReturnTrackingMemoSchema
>;

export function buildProductReturnTrackingAuditMemo(
  payload: Omit<ProductReturnTrackingMemoV1, "kind">,
): string {
  const body: ProductReturnTrackingMemoV1 = { kind: "product_return_tracking_v1", ...payload };
  return JSON.stringify(body);
}

export function parseProductReturnTrackingMemo(
  raw: string | null | undefined,
): ProductReturnTrackingMemoV1 | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const r = productReturnTrackingMemoSchema.safeParse(parsed);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function productReturnTrackingHumanNote(input: {
  desiredOutcome?: ProductReturnDesiredOutcome | null;
  trackingUrl?: string | null;
  retailerTrackingCompany?: string | null;
  retailerTrackingNumber?: string | null;
}): string {
  const headline =
    input.desiredOutcome === "money_back" ?
      PRODUCT_RETURN_AWAITING_REFUND_LABEL
    : PRODUCT_RETURN_STATUS_HEADLINE;
  const lines: string[] = [headline];
  const u = input.trackingUrl?.trim();
  const co = input.retailerTrackingCompany?.trim();
  const num = input.retailerTrackingNumber?.trim();
  if (u) lines.push(`Return tracking URL: ${u}`);
  if (co || num) {
    lines.push(
      `Carrier / retailer: ${co || "—"} · Tracking: ${num || "—"}`,
    );
  }
  return lines.join("\n");
}
