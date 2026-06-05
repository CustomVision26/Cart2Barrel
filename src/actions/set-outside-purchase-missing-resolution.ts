"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { setOutsidePurchaseMissingResolutionForOwner } from "@/data/outside-purchase-missing-resolution";
import { isMissingItemRequestReceiptImageColumnError } from "@/data/item-requests";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { outsidePurchaseMissingResolutionSchema } from "@/lib/validations/outside-purchase-missing-resolution";

export type SetOutsidePurchaseMissingResolutionState = {
  ok: boolean;
  message?: string;
};

export async function setOutsidePurchaseMissingResolutionAction(
  raw: unknown,
): Promise<SetOutsidePurchaseMissingResolutionState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "You must be signed in." };

  const parsed = outsidePurchaseMissingResolutionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  try {
    const ok = await setOutsidePurchaseMissingResolutionForOwner({
      clerkUserId: userId,
      itemRequestId: parsed.data.itemRequestId,
      resolved: parsed.data.resolved,
    });
    if (!ok) {
      return { ok: false, message: "Could not update. Refresh and try again." };
    }

    revalidateDashboardAddItem();
    revalidatePath("/dashboard/items");
    revalidatePath("/dashboard");
    revalidatePath("/admin/item-requests", "layout");

    return {
      ok: true,
      message:
        parsed.data.resolved ?
          "Marked as resolved."
        : "Marked as unresolved.",
    };
  } catch (e) {
    if (isMissingItemRequestReceiptImageColumnError(e)) {
      return {
        ok: false,
        message:
          "This action needs a database update (run db:push) before it can be used.",
      };
    }
    const msg = e instanceof Error ? e.message : "Could not update.";
    return { ok: false, message: msg };
  }
}
