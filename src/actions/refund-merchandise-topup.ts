"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  listMerchandiseTopupRefundablesForOrderItems,
  performMerchandiseTopupStripeRefund,
  type MerchandiseTopupRefundableView,
} from "@/data/merchandise-topup-refund";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";

const listSchema = z.object({
  orderItemIds: z.array(z.string().uuid()).min(1).max(50),
});

const refundSchema = z.object({
  paymentId: z.string().uuid().optional(),
  topupCheckoutOrderId: z.string().uuid(),
  reconciliationIds: z.array(z.string().uuid()).min(1).max(50),
  amountCents: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

export type ListMerchandiseTopupRefundablesState =
  | { ok: true; topups: MerchandiseTopupRefundableView[] }
  | { ok: false; message: string };

export type RefundMerchandiseTopupState =
  | { ok: true; message: string; refundedCents: number }
  | { ok: false; message: string };

export async function listMerchandiseTopupRefundablesAction(
  raw: unknown,
): Promise<ListMerchandiseTopupRefundablesState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }
  const parsed = listSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }
  const topups = await listMerchandiseTopupRefundablesForOrderItems({
    orderItemIds: parsed.data.orderItemIds,
  });
  return { ok: true, topups };
}

export async function refundMerchandiseTopupAction(
  raw: unknown,
): Promise<RefundMerchandiseTopupState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }
  const parsed = refundSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid top-up refund request." };
  }

  const result = await performMerchandiseTopupStripeRefund({
    paymentId: parsed.data.paymentId,
    topupCheckoutOrderId: parsed.data.topupCheckoutOrderId,
    reconciliationIds: parsed.data.reconciliationIds,
    amountCentsRequested: parsed.data.amountCents,
    internalReasonForDb: parsed.data.reason?.trim() || null,
    createdByClerkUserId: cu.user.id,
  });

  if (!result.ok) return result;

  revalidatePath("/admin/orders");
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/packages");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");

  return {
    ok: true,
    refundedCents: result.refundedCents,
    message: `Refunded top-up add-on ${result.refundedCents} cents.`,
  };
}
