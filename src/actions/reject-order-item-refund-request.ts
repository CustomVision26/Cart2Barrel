"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { orderItemRefundRequests } from "@/db/schema";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { rejectRefundRequestSchema } from "@/lib/validations/order-item-refund-request";
import { safeCurrentUser } from "@/lib/safe-current-user";

export type RejectRefundRequestState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function rejectOrderItemRefundRequestAction(
  raw: unknown,
): Promise<RejectRefundRequestState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = rejectRefundRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors.rejectionNote?.[0];
    return { ok: false, message: first ?? "Invalid reject payload." };
  }

  const db = getDb();
  const [reqRow] = await db
    .select()
    .from(orderItemRefundRequests)
    .where(eq(orderItemRefundRequests.id, parsed.data.refundRequestId))
    .limit(1);

  if (!reqRow || reqRow.status !== "pending_approval") {
    return {
      ok: false,
      message: "Refund request not found or already processed.",
    };
  }

  await db
    .update(orderItemRefundRequests)
    .set({
      status: "rejected",
      reviewedAt: new Date().toISOString(),
      reviewedByClerkUserId: cu.user.id,
      rejectionNote: parsed.data.rejectionNote,
    })
    .where(eq(orderItemRefundRequests.id, reqRow.id));

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/packages");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");

  return { ok: true, message: "Refund request marked as declined." };
}
