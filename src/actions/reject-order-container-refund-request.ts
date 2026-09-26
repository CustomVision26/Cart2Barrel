"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { orderContainerRefundRequests } from "@/db/schema";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { rejectOrderContainerLineRefundSchema } from "@/lib/validations/order-container-refund-request";
import { safeCurrentUser } from "@/lib/safe-current-user";

export type RejectContainerRefundRequestState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function rejectOrderContainerLineRefundAction(
  raw: unknown,
): Promise<RejectContainerRefundRequestState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = rejectOrderContainerLineRefundSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors.rejectionNote?.[0];
    return { ok: false, message: first ?? "Invalid reject payload." };
  }

  const db = getDb();
  const updated = await db
    .update(orderContainerRefundRequests)
    .set({
      status: "rejected",
      reviewedAt: new Date().toISOString(),
      reviewedByClerkUserId: cu.user.id,
      rejectionNote: parsed.data.rejectionNote,
    })
    .where(
      and(
        eq(
          orderContainerRefundRequests.orderContainerItemId,
          parsed.data.orderContainerItemId,
        ),
        eq(orderContainerRefundRequests.status, "pending_approval"),
      ),
    )
    .returning({ id: orderContainerRefundRequests.id });

  if (updated.length === 0) {
    return {
      ok: false,
      message: "Refund request not found or already processed.",
    };
  }

  revalidatePath("/admin/overview");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders-history");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/orders-history");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: "Refund request for this container and packing fee was declined.",
  };
}
