"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { itemRequests } from "@/db/schema";
import { insertItemRequestLineSnapshot } from "@/data/item-request-line-snapshots";
import { hostnameFromProductUrl } from "@/lib/site-name";
import { parseCreateItemRequestInput } from "@/lib/validations/item-request";

export type CreateItemRequestState = {
  ok: boolean;
  message?: string;
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
      note: parsed.data.note ?? null,
      siteName,
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

  revalidatePath("/dashboard/items");
  revalidatePath("/dashboard/items/new");
  revalidatePath("/dashboard");

  return { ok: true, message: "Item request submitted." };
}
