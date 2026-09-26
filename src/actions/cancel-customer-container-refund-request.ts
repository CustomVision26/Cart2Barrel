"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@clerk/nextjs/server";

import { getDb } from "@/db";
import { orderContainerItems, orderContainerRefundRequests, orders } from "@/db/schema";
import { isMissingOrderContainerRefundsTableError } from "@/lib/db-column-missing";
import { cancelCustomerContainerRefundRequestSchema } from "@/lib/validations/order-container-refund-request";

export type CancelCustomerContainerRefundRequestState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function cancelCustomerContainerRefundRequestAction(
  raw: unknown,
): Promise<CancelCustomerContainerRefundRequestState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to cancel a refund request." };
  }

  const parsed = cancelCustomerContainerRefundRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "We could not read this cancel request." };
  }

  const db = getDb();
  const [scoped] = await db
    .select({
      containerId: orderContainerItems.id,
      orderId: orders.id,
    })
    .from(orderContainerItems)
    .innerJoin(orders, eq(orderContainerItems.orderId, orders.id))
    .where(
      and(
        eq(orderContainerItems.id, parsed.data.orderContainerItemId),
        eq(orders.clerkUserId, userId),
      ),
    )
    .limit(1);

  if (!scoped) {
    return { ok: false, message: "Shipping container line not found." };
  }

  try {
    const cancelled = await db
      .update(orderContainerRefundRequests)
      .set({
        status: "rejected",
        reviewedAt: new Date().toISOString(),
        reviewedByClerkUserId: userId,
        rejectionNote: "Cancelled by shopper.",
      })
      .where(
        and(
          eq(
            orderContainerRefundRequests.orderContainerItemId,
            scoped.containerId,
          ),
          eq(orderContainerRefundRequests.clerkUserId, userId),
          eq(orderContainerRefundRequests.status, "pending_approval"),
        ),
      )
      .returning({ id: orderContainerRefundRequests.id });

    if (cancelled.length === 0) {
      return {
        ok: false,
        message: "No pending refund request to cancel for this container.",
      };
    }
  } catch (e) {
    if (isMissingOrderContainerRefundsTableError(e)) {
      return { ok: false, message: "Refund requests are not available yet." };
    }
    console.error("[cancelCustomerContainerRefundRequest]", e);
    return { ok: false, message: "Could not cancel the refund request. Try again." };
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/orders-history");
  revalidatePath("/dashboard");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders-history");
  revalidatePath("/admin/overview");

  return {
    ok: true,
    message: "Refund request cancelled. You can submit a new request if needed.",
  };
}
