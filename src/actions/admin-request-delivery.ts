"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import {
  deliveryRequests,
  itemRequests,
  orderItems,
  orders,
  profiles,
} from "@/db/schema";
import { orderListSelect } from "@/data/order-list-select";
import { sumRefundedCentsByOrderItemIds } from "@/data/order-item-refunds";
import { sendDeliveryRequestEmails } from "@/lib/email/send-delivery-request-emails";
import { formatUsd } from "@/lib/admin-markup";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { effectiveOrderItemFulfillmentStatus } from "@/lib/order-item-read-compat";
import { getAppOrigin } from "@/lib/stripe-server";
import { requestDeliverySchema } from "@/lib/validations/admin-order-item";
import { safeCurrentUser } from "@/lib/safe-current-user";

export type RequestDeliveryState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function requestDeliveryForOrderItemAction(
  raw: unknown
): Promise<RequestDeliveryState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }

  const parsed = requestDeliverySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const db = getDb();
  const [row] = await db
    .select({
      orderItem: orderItems,
      order: orderListSelect,
      request: itemRequests,
      customerEmail: profiles.email,
      customerFullName: profiles.fullName,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .innerJoin(profiles, eq(orders.clerkUserId, profiles.clerkUserId))
    .where(eq(orderItems.id, parsed.data.orderItemId))
    .limit(1);

  if (!row || row.order.status !== "paid") {
    return { ok: false, message: "Order line not found." };
  }

  let refunded = 0;
  try {
    const refundedMap = await sumRefundedCentsByOrderItemIds([
      row.orderItem.id,
    ]);
    refunded = refundedMap.get(row.orderItem.id) ?? 0;
  } catch {
    refunded = 0;
  }
  if (
    row.orderItem.fulfillmentStatus === "refunded" ||
    refunded >= row.orderItem.price
  ) {
    return {
      ok: false,
      message: "This line was refunded; delivery cannot be requested.",
    };
  }

  const effectiveFulfillment = effectiveOrderItemFulfillmentStatus(
    row.orderItem,
    row.order
  );
  if (effectiveFulfillment !== "company_purchase_pending_delivery") {
    return {
      ok: false,
      message: "Delivery can only be requested after company purchase is recorded.",
    };
  }

  const adminId = cu.user.id;
  const adminEmail =
    cu.user.primaryEmailAddress?.emailAddress ??
    cu.user.emailAddresses?.[0]?.emailAddress ??
    null;
  const nameFromParts = [cu.user.firstName, cu.user.lastName]
    .filter((x): x is string => Boolean(x?.trim()))
    .join(" ")
    .trim();
  const adminDisplayName =
    (typeof cu.user.fullName === "string" && cu.user.fullName.trim()
      ? cu.user.fullName.trim()
      : null) ??
    (nameFromParts.length > 0 ? nameFromParts : null);

  const opsDestinationsRaw = process.env.DELIVERY_OPS_EMAIL?.trim() ?? "";
  const customerEmail = row.customerEmail?.trim() || null;

  const [inserted] = await db
    .insert(deliveryRequests)
    .values({
      orderItemId: row.orderItem.id,
      requestedByClerkUserId: adminId,
      opsDestinations: opsDestinationsRaw || "(not configured)",
      customerEmailAttempted: customerEmail,
    })
    .returning({ id: deliveryRequests.id });

  if (!inserted) {
    return { ok: false, message: "Could not save delivery request." };
  }

  const emailResult = await sendDeliveryRequestEmails({
    origin: getAppOrigin(),
    orderItemId: row.orderItem.id,
    orderId: row.order.id,
    productName: row.request.productName,
    productUrl: row.request.productUrl,
    quantity: row.orderItem.quantity,
    lineTotalLabel: formatUsd(row.orderItem.price),
    customerClerkUserId: row.order.clerkUserId,
    customerEmail,
    customerFullName: row.customerFullName,
    adminClerkUserId: adminId,
    adminEmail,
    adminDisplayName,
  });

  await db
    .update(deliveryRequests)
    .set({
      notifiedOpsAt: emailResult.notifiedOpsAt,
      notifiedCustomerAt: emailResult.notifiedCustomerAt,
      notifyErrors: emailResult.notifyErrors,
    })
    .where(eq(deliveryRequests.id, inserted.id));

  revalidatePath("/admin/orders");

  const parts: string[] = ["Delivery request saved."];
  if (emailResult.notifiedOpsAt) {
    parts.push("Operations inbox notified.");
  }
  if (emailResult.notifiedCustomerAt) {
    parts.push("Customer notified.");
  }
  if (emailResult.notifyErrors) {
    parts.push(`Email issue: ${emailResult.notifyErrors}`);
  }

  return { ok: true, message: parts.join(" ") };
}
