"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import {
  getHubContactSettingsForAdmin,
  getHubContactSettingsPublic,
  upsertHubContactSettings,
} from "@/data/hub-contact-settings";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { updateHubContactSettingsSchema } from "@/lib/validations/hub-contact-settings";

export type HubContactActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function getHubContactSettingsPublicAction() {
  return getHubContactSettingsPublic();
}

export async function updateHubContactSettingsAction(
  raw: unknown,
): Promise<HubContactActionState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = updateHubContactSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid contact settings.";
    return { ok: false, message: first };
  }

  try {
    const v = parsed.data;
    await upsertHubContactSettings({
      values: {
        supportEmail: v.supportEmail ?? null,
        supportPhone: v.supportPhone ?? null,
        whatsAppNumber: v.whatsAppNumber ?? null,
        instagramUrl: v.instagramUrl ?? null,
        facebookUrl: v.facebookUrl ?? null,
        xUrl: v.xUrl ?? null,
        tiktokUrl: v.tiktokUrl ?? null,
        businessHours: v.businessHours ?? null,
        publicIntro: v.publicIntro ?? null,
      },
      updatedByClerkUserId: user!.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save contact settings.";
    return { ok: false, message: msg };
  }

  revalidatePath("/admin/support/contact");
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/");

  return { ok: true, message: "Hub contact details saved." };
}

export async function loadHubContactSettingsForAdminAction() {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return null;
  }
  return getHubContactSettingsForAdmin();
}
