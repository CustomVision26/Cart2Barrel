"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { submitShoppingListQuoteForOwner } from "@/data/shopping-list-quotes";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { submitShoppingListQuoteSchema } from "@/lib/validations/shopping-list-quote";

export type SubmitShoppingListQuoteState =
  | { ok: true; message: string; batchSessionId: string }
  | { ok: false; message: string };

export async function submitShoppingListQuoteAction(
  raw: unknown,
): Promise<SubmitShoppingListQuoteState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in to submit a list." };
  }

  const parsed = submitShoppingListQuoteSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return { ok: false, message: first ?? "Check the product rows and try again." };
  }

  try {
    const result = await submitShoppingListQuoteForOwner({
      clerkUserId: userId,
      input: parsed.data,
    });
    revalidatePath("/dashboard/items");
    revalidateDashboardAddItem();
    revalidatePath("/admin/overview");
    revalidatePath("/admin/item-requests", "layout");
    return {
      ok: true,
      message: "List sent to staff for a quote.",
      batchSessionId: result.batchSessionId,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not submit this list.";
    return { ok: false, message: msg };
  }
}
