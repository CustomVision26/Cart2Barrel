"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";

import { upsertHubContactSettings } from "@/data/hub-contact-settings";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { updateHubContactSettingsSchema } from "@/lib/validations/support";

export type UpdateHubContactSettingsState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function updateHubContactSettingsAction(
  raw: unknown,
): Promise<UpdateHubContactSettingsState> {
  const user = await currentUser();
  if (!isClerkAdmin(user) || !user) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = updateHubContactSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid contact settings.";
    return { ok: false, message: first };
  }

  const d = parsed.data;
  try {
    await upsertHubContactSettings({
      supportEmail: d.supportEmail.trim() || null,
      supportPhone: d.supportPhone.trim() || null,
      whatsappNumber: d.whatsappNumber.trim() || null,
      instagramUrl: d.instagramUrl.trim() || null,
      facebookUrl: d.facebookUrl.trim() || null,
      xUrl: d.xUrl.trim() || null,
      tiktokUrl: d.tiktokUrl.trim() || null,
      publicIntro: d.publicIntro.trim() || null,
      businessHours: d.businessHours.trim() || null,
      updatedByClerkUserId: user.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save contact settings.";
    return { ok: false, message: msg };
  }

  revalidatePath("/admin/support/contact");
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Hub contact settings saved." };
}
