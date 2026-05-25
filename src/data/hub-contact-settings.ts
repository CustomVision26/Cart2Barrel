import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { hubContactSettings, type HubContactSettings } from "@/db/schema";
import { isMissingSupportHubTablesError } from "@/lib/db-column-missing";
import { DEFAULT_HUB_CONTACT_PUBLIC } from "@/lib/hub-contact-defaults";

const HUB_KEY = "default" as const;

export type HubContactSettingsPublic = {
  supportEmail: string | null;
  supportPhone: string | null;
  whatsAppNumber: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  xUrl: string | null;
  tiktokUrl: string | null;
  businessHours: string | null;
  publicIntro: string | null;
};

function toPublic(row: HubContactSettings | undefined): HubContactSettingsPublic {
  return {
    supportEmail: row?.supportEmail ?? DEFAULT_HUB_CONTACT_PUBLIC.supportEmail,
    supportPhone: row?.supportPhone ?? DEFAULT_HUB_CONTACT_PUBLIC.supportPhone,
    whatsAppNumber:
      row?.whatsAppNumber ?? DEFAULT_HUB_CONTACT_PUBLIC.whatsAppNumber,
    instagramUrl: row?.instagramUrl ?? DEFAULT_HUB_CONTACT_PUBLIC.instagramUrl,
    facebookUrl: row?.facebookUrl ?? DEFAULT_HUB_CONTACT_PUBLIC.facebookUrl,
    xUrl: row?.xUrl ?? DEFAULT_HUB_CONTACT_PUBLIC.xUrl,
    tiktokUrl: row?.tiktokUrl ?? DEFAULT_HUB_CONTACT_PUBLIC.tiktokUrl,
    businessHours:
      row?.businessHours ?? DEFAULT_HUB_CONTACT_PUBLIC.businessHours,
    publicIntro: row?.publicIntro ?? DEFAULT_HUB_CONTACT_PUBLIC.publicIntro,
  };
}

export async function getHubContactSettingsForAdmin(): Promise<HubContactSettingsPublic> {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(hubContactSettings)
      .where(eq(hubContactSettings.singletonKey, HUB_KEY))
      .limit(1);
    return toPublic(row);
  } catch (e) {
    if (isMissingSupportHubTablesError(e)) {
      return { ...DEFAULT_HUB_CONTACT_PUBLIC };
    }
    throw e;
  }
}

export async function getHubContactSettingsPublic(): Promise<HubContactSettingsPublic> {
  return getHubContactSettingsForAdmin();
}

export async function upsertHubContactSettings(params: {
  values: HubContactSettingsPublic;
  updatedByClerkUserId: string;
}): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const [existing] = await db
    .select({ k: hubContactSettings.singletonKey })
    .from(hubContactSettings)
    .where(eq(hubContactSettings.singletonKey, HUB_KEY))
    .limit(1);

  const row = {
    ...params.values,
    updatedByClerkUserId: params.updatedByClerkUserId,
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(hubContactSettings)
      .set(row)
      .where(eq(hubContactSettings.singletonKey, HUB_KEY));
  } else {
    await db.insert(hubContactSettings).values({
      singletonKey: HUB_KEY,
      ...row,
    });
  }
}
