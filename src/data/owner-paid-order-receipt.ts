import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { itemRequests, orderItems, orders, profiles } from "@/db/schema";
import { orderListSelect } from "@/data/order-list-select";
import { sendPaidOrderReceiptEmail } from "@/lib/email/send-paid-order-receipt-email";
import {
  combinedErrorText,
  isUndefinedColumnError,
} from "@/lib/db-column-missing";
import { getAppOrigin } from "@/lib/stripe-server";

/**
 * Sends the paid-order receipt email once per order (claims via `receipt_email_sent_at`).
 */
export async function trySendOwnerPaidOrderReceiptEmail(
  orderId: string
): Promise<void> {
  const db = getDb();

  const [order] = await db
    .select(orderListSelect)
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.status !== "paid") {
    return;
  }

  const [profile] = await db
    .select({
      email: profiles.email,
      fullName: profiles.fullName,
    })
    .from(profiles)
    .where(eq(profiles.clerkUserId, order.clerkUserId))
    .limit(1);

  const email = profile?.email?.trim();
  if (!email) {
    console.warn(
      `[Cart2Barrel] No profile email for order ${orderId}; receipt not sent.`
    );
    return;
  }

  const lineRows = await db
    .select({
      request: itemRequests,
      price: orderItems.price,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .where(eq(orderItems.orderId, orderId));

  let claimed: { id: string }[] = [];
  try {
    claimed = await db
      .update(orders)
      .set({
        receiptEmailSentAt: new Date().toISOString(),
      })
      .where(and(eq(orders.id, orderId), isNull(orders.receiptEmailSentAt)))
      .returning({ id: orders.id });
  } catch (e) {
    if (isUndefinedColumnError(e, "receipt_email_sent_at")) {
      console.warn(
        "[Cart2Barrel] orders.receipt_email_sent_at missing; run npm run db:migrate. Skipping receipt email.",
        combinedErrorText(e)
      );
      return;
    }
    throw e;
  }

  if (claimed.length === 0) {
    return;
  }

  const origin = getAppOrigin();
  const send = await sendPaidOrderReceiptEmail({
    origin,
    orderId: order.id,
    orderCreatedAt: order.createdAt,
    orderTotalCents: order.totalAmount,
    customerEmail: email,
    customerName: profile?.fullName ?? null,
    lines: lineRows.map((row) => ({
      productName: row.request.productName,
      quantity: row.quantity,
      lineTotalCents: row.price,
    })),
  });

  if (send.error) {
    console.warn(`[Cart2Barrel] Paid order receipt failed: ${send.error}`);
    await db
      .update(orders)
      .set({ receiptEmailSentAt: null })
      .where(eq(orders.id, orderId));
  }
}
