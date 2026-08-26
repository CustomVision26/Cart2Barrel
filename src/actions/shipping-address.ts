"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  deleteShippingAddressForUser,
  setPrimaryShippingAddressForUser,
  upsertShippingContactAddress,
} from "@/data/addresses";
import { getOrCreateProfile } from "@/data/profiles";
import {
  parseShippingContactAddressFormSubmission,
  resolveShippingAfterSaveRedirect,
} from "@/lib/validations/shipping-address-payload";

export type SaveShippingAddressState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function revalidateShippingPaths(): void {
  revalidatePath("/");
  revalidatePath("/onboarding");
  revalidatePath("/settings/delivery");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/shipping/profile");
  revalidatePath("/dashboard/shipping/address");
  revalidatePath("/dashboard/cart");
}

function fieldErrorsFromZod(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path[0];
    if (typeof path === "string") {
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(issue.message);
    }
  }
  return fieldErrors;
}

/** Saves recipient contact and street lines as one address record. */
export async function saveShippingAddressAction(
  _prev: SaveShippingAddressState,
  rawInput: unknown,
): Promise<SaveShippingAddressState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in to save your address." };
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;
  await getOrCreateProfile(userId, email);

  const parsed = parseShippingContactAddressFormSubmission(rawInput);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  try {
    await upsertShippingContactAddress({
      clerkUserId: userId,
      data: parsed.data,
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not save shipping address.",
    };
  }

  revalidateShippingPaths();
  redirect(resolveShippingAfterSaveRedirect(rawInput));
}

const addressIdSchema = z.object({
  id: z.string().uuid(),
});

export async function setPrimaryShippingAddressAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }
  const parsed = addressIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid address." };
  }
  const ok = await setPrimaryShippingAddressForUser(userId, parsed.data.id);
  if (!ok) {
    return { ok: false, message: "Address not found." };
  }
  revalidateShippingPaths();
  return { ok: true };
}

export async function deleteShippingAddressAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }
  const parsed = addressIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid address." };
  }
  const result = await deleteShippingAddressForUser(userId, parsed.data.id);
  if (!result.ok) return result;
  revalidateShippingPaths();
  return { ok: true };
}
