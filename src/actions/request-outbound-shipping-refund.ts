"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { getOutboundShippingChargesByBarrelIds } from "@/data/barrel-outbound-shipping-charges";
import { getPaidOutboundChargeRow } from "@/data/barrel-outbound-shipping-refunds";
import { requestOutboundShippingRefundForCharge } from "@/data/barrel-outbound-shipping-refunds";
import {
  outboundShippingRefundPath,
  type BarrelOutboundShippingChargeView,
} from "@/lib/barrel-outbound-shipping-charge";
import { requestOutboundShippingRefundSchema } from "@/lib/validations/barrel-outbound-shipping-charge";

export type RequestOutboundShippingRefundState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function requestOutboundShippingRefundAction(
  raw: unknown,
): Promise<RequestOutboundShippingRefundState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = requestOutboundShippingRefundSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const row = await getPaidOutboundChargeRow({
    chargeId: parsed.data.chargeId,
    clerkUserId: userId,
  });
  if (!row?.paidAt) {
    return { ok: false, message: "Paid shipping charge not found." };
  }

  const byBarrel = await getOutboundShippingChargesByBarrelIds(userId, [
    row.barrelId,
  ]);
  const charges = byBarrel.get(row.barrelId) ?? [];
  const charge = charges.find((item) => item.chargeId === row.id);
  if (!charge) {
    return { ok: false, message: "Paid shipping charge not found." };
  }

  const path = outboundShippingRefundPath(charge);
  if (!path) {
    return {
      ok: false,
      message: "This payment is not eligible for an online refund request.",
    };
  }

  let related: BarrelOutboundShippingChargeView[] = [];
  if (path === "amani") {
    related = charges.filter(
      (item) =>
        item.chargeId !== charge.chargeId &&
        outboundShippingRefundPath(item) === "amani",
    );
  }

  const result = await requestOutboundShippingRefundForCharge({
    clerkUserId: userId,
    charge,
    barrelId: row.barrelId,
    refundPath: path,
    relatedCharges: related,
  });
  if (result.ok) {
    revalidatePath("/dashboard/shipping");
    revalidatePath("/dashboard/shipping/pricing");
    revalidatePath("/admin/shipments");
    revalidatePath("/dashboard/support");
  }
  return result;
}
