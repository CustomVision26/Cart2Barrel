"use server";

import { revalidatePath } from "next/cache";

import { performOrderItemStripeRefund } from "@/data/perform-order-item-stripe-refund";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { refundOrderLineSchema } from "@/lib/validations/admin-order-item";
import { safeCurrentUser } from "@/lib/safe-current-user";

export type RefundOrderLineState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function refundOrderLineAction(
  raw: unknown,
): Promise<RefundOrderLineState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = refundOrderLineSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid refund request." };
  }

  const result = await performOrderItemStripeRefund({
    orderItemId: parsed.data.orderItemId,
    amountCentsRequested: parsed.data.amountCents,
    internalReasonForDb: parsed.data.reason?.trim() || null,
    stripeReason: "requested_by_customer",
    createdByClerkUserId: cu.user.id,
  });

  if (!result.ok) {
    return result;
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/packages");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");

  const refundedCents = result.refundedCents;
  const clamped =
    parsed.data.amountCents > refundedCents ?
      ` Capped from ${parsed.data.amountCents}¢ to maximum ${refundedCents}¢. `
    : " ";

  const msg =
    result.lineFullyRefunded ?
      `Refunded ${refundedCents} cents; line is now fully refunded.${clamped}`
    : `Refunded ${refundedCents} cents.${clamped}`;

  return { ok: true, message: msg.trim() };
}
