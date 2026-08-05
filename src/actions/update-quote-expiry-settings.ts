"use server";

import { revalidatePath } from "next/cache";

import { upsertQuoteExpirySettings } from "@/data/quote-expiry-settings";
import { getClerkSessionGate } from "@/lib/clerk-session";
import {
  formatQuoteExpiryWindowLabel,
  minutesFromDurationAmount,
} from "@/lib/quote-expiry";
import { updateQuoteExpirySettingsSchema } from "@/lib/validations/quote-expiry-settings";

export type UpdateQuoteExpirySettingsState =
  | { ok: true; message: string; expiryMinutes: number }
  | { ok: false; message: string };

export async function updateQuoteExpirySettingsAction(
  raw: unknown,
): Promise<UpdateQuoteExpirySettingsState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }
  if (!gate.isAdmin) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = updateQuoteExpirySettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Enter a duration from 1 minute to 90 days.",
    };
  }

  const expiryMinutes = minutesFromDurationAmount(
    parsed.data.amount,
    parsed.data.unit,
  );

  const saved = await upsertQuoteExpirySettings({
    expiryMinutes,
    updatedByClerkUserId: gate.userId,
  });

  revalidatePath("/admin/overview");
  revalidatePath("/dashboard/items/new/add-item", "layout");

  const windowLabel = formatQuoteExpiryWindowLabel(saved.expiryMinutes);
  return {
    ok: true,
    message: `Quote expiry published: ${windowLabel} after staff quotes a product (keeps estimates current when retailer prices change).`,
    expiryMinutes: saved.expiryMinutes,
  };
}
