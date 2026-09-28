"use server";

import { revalidatePath } from "next/cache";

import { getOutboundShippingChargesByBarrelIds } from "@/data/barrel-outbound-shipping-charges";
import { fulfillOutboundShippingRefundsForBarrel } from "@/data/barrel-outbound-shipping-refunds";
import { getDb } from "@/db";
import { barrels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";
import { fulfillOutboundShippingRefundsForBarrelSchema } from "@/lib/validations/barrel-outbound-shipping-charge";

export type FulfillOutboundShippingRefundState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function fulfillOutboundShippingRefundsForBarrelAction(
  raw: unknown,
): Promise<FulfillOutboundShippingRefundState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = fulfillOutboundShippingRefundsForBarrelSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const db = getDb();
  const [barrel] = await db
    .select({
      id: barrels.id,
      clerkUserId: barrels.clerkUserId,
    })
    .from(barrels)
    .where(eq(barrels.id, parsed.data.barrelId))
    .limit(1);
  if (!barrel) {
    return { ok: false, message: "Container not found." };
  }

  const byBarrel = await getOutboundShippingChargesByBarrelIds(
    barrel.clerkUserId,
    [barrel.id],
  );
  const charges = byBarrel.get(barrel.id) ?? [];
  const result = await fulfillOutboundShippingRefundsForBarrel({
    barrelId: barrel.id,
    clerkUserId: barrel.clerkUserId,
    staffClerkUserId: cu.user.id,
    charges,
  });
  if (result.ok) {
    revalidatePath("/admin/shipments");
    revalidatePath("/dashboard/shipping");
    revalidatePath("/dashboard/shipping/pricing");
  }
  return result;
}
