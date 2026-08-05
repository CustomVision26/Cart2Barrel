"use server";

import { revalidatePath } from "next/cache";

import {
  deleteCustomerQuoteExpirySettings,
  upsertCustomerQuoteExpirySettings,
} from "@/data/quote-expiry-settings";
import { getProfileByClerkId } from "@/data/profiles";
import { getClerkSessionGate } from "@/lib/clerk-session";
import {
  formatQuoteExpiryWindowLabel,
  minutesFromDurationAmount,
} from "@/lib/quote-expiry";
import {
  deleteCustomerQuoteExpirySettingsSchema,
  upsertCustomerQuoteExpirySettingsSchema,
} from "@/lib/validations/quote-expiry-settings";

export type CustomerQuoteExpiryActionState =
  | { ok: true; message: string; expiryMinutes?: number }
  | { ok: false; message: string };

function revalidateQuoteExpirySurfaces(clerkUserId: string) {
  revalidatePath("/admin/overview");
  revalidatePath("/dashboard/items/new/add-item", "layout");
  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard/items");
  void clerkUserId;
}

export async function upsertCustomerQuoteExpirySettingsAction(
  raw: unknown,
): Promise<CustomerQuoteExpiryActionState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }
  if (!gate.isAdmin) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = upsertCustomerQuoteExpirySettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Enter a duration from 1 minute to 90 days.",
    };
  }

  const profile = await getProfileByClerkId(parsed.data.clerkUserId);
  if (!profile) {
    return { ok: false, message: "Customer profile not found." };
  }

  const expiryMinutes = minutesFromDurationAmount(
    parsed.data.amount,
    parsed.data.unit,
  );

  try {
    const saved = await upsertCustomerQuoteExpirySettings({
      clerkUserId: parsed.data.clerkUserId,
      expiryMinutes,
      updatedByClerkUserId: gate.userId,
    });
    revalidateQuoteExpirySurfaces(parsed.data.clerkUserId);
    const windowLabel = formatQuoteExpiryWindowLabel(saved.expiryMinutes);
    return {
      ok: true,
      message: `Customer override published: ${windowLabel} for this shopper’s quoted products.`,
      expiryMinutes: saved.expiryMinutes,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save override.";
    return {
      ok: false,
      message:
        msg.includes("customer_quote_expiry_settings") ?
          "Database is missing customer quote expiry tables. Run `npm run db:ensure-quote-expiry` or `npm run db:push`."
        : msg,
    };
  }
}

export async function deleteCustomerQuoteExpirySettingsAction(
  raw: unknown,
): Promise<CustomerQuoteExpiryActionState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }
  if (!gate.isAdmin) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = deleteCustomerQuoteExpirySettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid customer." };
  }

  try {
    const removed = await deleteCustomerQuoteExpirySettings(
      parsed.data.clerkUserId,
    );
    if (!removed) {
      return { ok: false, message: "No override found for that customer." };
    }
    revalidateQuoteExpirySurfaces(parsed.data.clerkUserId);
    return {
      ok: true,
      message:
        "Customer override removed. This shopper’s quotes use the hub default again.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not remove override.";
    return { ok: false, message: msg };
  }
}
