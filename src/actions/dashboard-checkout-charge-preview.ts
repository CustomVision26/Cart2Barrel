"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import {
  loadBatchCheckoutChargesPreview,
  loadOrderCheckoutChargesPreview,
  type CheckoutChargesPreview,
} from "@/data/dashboard-checkout-charge-preview";

const orderScopeSchema = z.object({
  scope: z.literal("order"),
  orderId: z.string().uuid(),
});

const batchScopeSchema = z.object({
  scope: z.literal("batch"),
  orderId: z.string().uuid(),
  batchSessionId: z.string().uuid(),
});

const previewSchema = z.discriminatedUnion("scope", [
  orderScopeSchema,
  batchScopeSchema,
]);

export type DashboardCheckoutChargePreviewInput = z.infer<typeof previewSchema>;

export type DashboardCheckoutChargePreviewResult =
  | { ok: false; message: string }
  | { ok: true; preview: CheckoutChargesPreview };

export async function getDashboardCheckoutChargePreviewAction(
  input: DashboardCheckoutChargePreviewInput,
): Promise<DashboardCheckoutChargePreviewResult> {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid preview request." };
  }

  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  if (parsed.data.scope === "order") {
    return loadOrderCheckoutChargesPreview(userId, parsed.data.orderId);
  }

  return loadBatchCheckoutChargesPreview(
    userId,
    parsed.data.orderId,
    parsed.data.batchSessionId,
  );
}
