"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { submitStarterBundleQuoteForOwner } from "@/data/shopping-list-quotes";
import type { PublishedStarterBundleDetail } from "@/data/starter-bundles";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";
import { STARTER_BUNDLES_ROUTES } from "@/lib/starter-bundles";
import { submitStarterBundleQuoteSchema } from "@/lib/validations/starter-bundle";

export type SubmitStarterBundleQuoteState =
  | { ok: true; message: string; batchSessionId: string }
  | {
      ok: false;
      code?: "stale" | "archived" | "missing";
      message: string;
      bundle?: PublishedStarterBundleDetail;
    };

export async function submitStarterBundleQuoteAction(
  raw: unknown,
): Promise<SubmitStarterBundleQuoteState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in to request an estimate." };
  }

  const parsed = submitStarterBundleQuoteSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return { ok: false, message: first ?? "Check this bundle and try again." };
  }

  try {
    const result = await submitStarterBundleQuoteForOwner({
      clerkUserId: userId,
      input: parsed.data,
    });
    if (!result.ok) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
        ...(result.code === "stale" ? { bundle: result.bundle } : {}),
      };
    }
    revalidatePath("/dashboard/items");
    revalidateDashboardAddItem();
    revalidatePath("/admin/overview");
    revalidatePath("/admin/item-requests", "layout");
    revalidatePath(STARTER_BUNDLES_ROUTES.listing);
    return {
      ok: true,
      message: "Bundle sent to staff for a quote.",
      batchSessionId: result.batchSessionId,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not submit this bundle.";
    return { ok: false, message: msg };
  }
}
