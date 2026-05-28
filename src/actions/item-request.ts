"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { itemRequests } from "@/db/schema";
import { insertItemRequestLineSnapshot } from "@/data/item-request-line-snapshots";
import { recordItemRequestSubmittedActivity } from "@/data/admin-user-activity-events";
import { formatUsd } from "@/lib/admin-markup";
import { parseUsdToCents } from "@/lib/admin-pricing-form-utils";
import { hostnameFromProductUrl } from "@/lib/site-name";
import { parseCreateItemRequestInput } from "@/lib/validations/item-request";
import { revalidateDashboardAddItem } from "@/lib/revalidate-dashboard-add-item";

export type CreateItemRequestState = {
  ok: boolean;
  message?: string;
  /** Present after a successful create — used to attach an optional product photo upload. */
  itemRequestId?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function createItemRequestAction(
  raw: unknown
): Promise<CreateItemRequestState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in to submit a request." };
  }

  const parsed = parseCreateItemRequestInput(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string") {
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
    }
    return { ok: false, fieldErrors };
  }

  const siteName =
    parsed.data.siteName?.trim() ||
    hostnameFromProductUrl(parsed.data.productUrl) ||
    null;

  const noteParts: string[] = [];
  if (parsed.data.customerUnitPriceUsd) {
    const unitCents = parseUsdToCents(parsed.data.customerUnitPriceUsd);
    if (unitCents > 0) {
      noteParts.push(
        `Customer-reported retailer unit price: ${formatUsd(unitCents)} (qty ${parsed.data.quantity}).`,
      );
    }
  }
  if (parsed.data.note?.trim()) {
    noteParts.push(parsed.data.note.trim());
  }
  const combinedNote = noteParts.length > 0 ? noteParts.join("\n\n") : null;

  const db = getDb();
  const [created] = await db
    .insert(itemRequests)
    .values({
      clerkUserId: userId,
      productUrl: parsed.data.productUrl,
      productName: parsed.data.productName ?? null,
      productSize: parsed.data.productSize ?? null,
      productColor: parsed.data.productColor ?? null,
      quantity: parsed.data.quantity,
      note: combinedNote,
      siteName,
      productImageUrl: parsed.data.productImageUrl?.trim() || null,
    })
    .returning();

  if (!created) {
    return { ok: false, message: "Could not save your request." };
  }

  await insertItemRequestLineSnapshot({
    itemRequestId: created.id,
    phase: "customer_submission",
    line: {
      productUrl: created.productUrl,
      productName: created.productName,
      productSize: created.productSize,
      productColor: created.productColor,
      quantity: created.quantity,
      note: created.note,
      productImageUrl: created.productImageUrl,
      siteName: created.siteName,
    },
  });

  await recordItemRequestSubmittedActivity({
    customerClerkUserId: userId,
    itemRequestId: created.id,
    productName: created.productName,
    siteName: created.siteName,
  });

  revalidatePath("/dashboard/items");
  revalidateDashboardAddItem();
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: "Item request submitted.",
    itemRequestId: created.id,
  };
}
