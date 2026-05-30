import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  hubContactSettings,
  type HubContactSetting,
  type HubSocialLink,
} from "@/db/schema";

const HUB_KEY = "default";

export type HubContactPublic = {
  supportEmail: string | null;
  supportPhone: string | null;
  whatsappNumber: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  xUrl: string | null;
  tiktokUrl: string | null;
  publicIntro: string | null;
  businessHours: string | null;
  socialLinks: HubSocialLink[];
};

export const EMPTY_HUB_CONTACT: HubContactPublic = {
  supportEmail: null,
  supportPhone: null,
  whatsappNumber: null,
  instagramUrl: null,
  facebookUrl: null,
  xUrl: null,
  tiktokUrl: null,
  publicIntro: null,
  businessHours: null,
  socialLinks: [],
};

function optionalUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function buildSocialLinks(row: HubContactSetting): HubSocialLink[] {
  const links: HubSocialLink[] = [];
  if (row.instagramUrl?.trim()) {
    links.push({ label: "Instagram", url: row.instagramUrl.trim() });
  }
  if (row.facebookUrl?.trim()) {
    links.push({ label: "Facebook", url: row.facebookUrl.trim() });
  }
  if (row.xUrl?.trim()) {
    links.push({ label: "X", url: row.xUrl.trim() });
  }
  if (row.tiktokUrl?.trim()) {
    links.push({ label: "TikTok", url: row.tiktokUrl.trim() });
  }
  if (row.whatsappNumber?.trim()) {
    const digits = row.whatsappNumber.replace(/\D/g, "");
    links.push({
      label: "WhatsApp",
      url: digits ? `https://wa.me/${digits}` : row.whatsappNumber.trim(),
    });
  }
  return links;
}

function mapHubRow(row: HubContactSetting | undefined): HubContactPublic {
  if (!row) return EMPTY_HUB_CONTACT;
  return {
    supportEmail: row.supportEmail?.trim() || null,
    supportPhone: row.supportPhone?.trim() || null,
    whatsappNumber: row.whatsappNumber?.trim() || null,
    instagramUrl: optionalUrl(row.instagramUrl),
    facebookUrl: optionalUrl(row.facebookUrl),
    xUrl: optionalUrl(row.xUrl),
    tiktokUrl: optionalUrl(row.tiktokUrl),
    publicIntro: row.publicIntro?.trim() || null,
    businessHours: row.businessHours?.trim() || null,
    socialLinks: buildSocialLinks(row),
  };
}

export async function loadHubContactSettings(): Promise<HubContactPublic> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(hubContactSettings)
    .where(eq(hubContactSettings.singletonKey, HUB_KEY))
    .limit(1);
  return mapHubRow(row);
}

export async function upsertHubContactSettings(params: {
  supportEmail: string | null;
  supportPhone: string | null;
  whatsappNumber: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  xUrl: string | null;
  tiktokUrl: string | null;
  publicIntro: string | null;
  businessHours: string | null;
  updatedByClerkUserId: string;
}): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select({ k: hubContactSettings.singletonKey })
    .from(hubContactSettings)
    .where(eq(hubContactSettings.singletonKey, HUB_KEY))
    .limit(1);

  const values = {
    supportEmail: params.supportEmail,
    supportPhone: params.supportPhone,
    whatsappNumber: params.whatsappNumber,
    instagramUrl: params.instagramUrl,
    facebookUrl: params.facebookUrl,
    xUrl: params.xUrl,
    tiktokUrl: params.tiktokUrl,
    publicIntro: params.publicIntro,
    businessHours: params.businessHours,
    updatedByClerkUserId: params.updatedByClerkUserId,
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    await db
      .update(hubContactSettings)
      .set(values)
      .where(eq(hubContactSettings.singletonKey, HUB_KEY));
  } else {
    await db.insert(hubContactSettings).values({
      singletonKey: HUB_KEY,
      ...values,
    });
  }
}
