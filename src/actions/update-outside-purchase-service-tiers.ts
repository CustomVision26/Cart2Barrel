"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";

import { getDb } from "@/db";
import { outsidePurchaseServiceHandlingFeeTiers } from "@/db/schema";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { updateOutsidePurchaseServiceHandlingTiersSchema } from "@/lib/validations/merchant-pricing-settings";

export type UpdateOutsidePurchaseServiceHandlingTiersState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function updateOutsidePurchaseServiceHandlingTiersAction(
  raw: unknown,
): Promise<UpdateOutsidePurchaseServiceHandlingTiersState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = updateOutsidePurchaseServiceHandlingTiersSchema.safeParse({
    tiers: raw,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid tier data.";
    return { ok: false, message: first };
  }

  const sorted = [...parsed.data.tiers].sort(
    (a, b) => a.maxUnitPriceInclusiveCents - b.maxUnitPriceInclusiveCents,
  );

  const db = getDb();
  try {
    await db.delete(outsidePurchaseServiceHandlingFeeTiers);
    await db.insert(outsidePurchaseServiceHandlingFeeTiers).values(
      sorted.map((t, i) => ({
        maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
        feePerUnitCents: t.feePerUnitCents,
        sortIndex: i + 1,
      })),
    );

    revalidatePath("/admin/overview");
    revalidatePath("/admin/item-requests", "layout");
    return {
      ok: true,
      message: "Outside purchase service & handling tiers saved.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save tiers.";
    return {
      ok: false,
      message:
        msg.includes("outside_purchase_service_handling_fee_tiers")
          ? "Database is missing outside purchase tier table. Run npm run db:push (migration 0062), then try again."
          : msg,
    };
  }
}
