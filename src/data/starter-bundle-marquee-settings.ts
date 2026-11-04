import "server-only";

import { eq } from "drizzle-orm";

import { ensureStarterBundleMarqueeSettingsSchema } from "@/data/ensure-starter-bundles-schema";
import { getDb } from "@/db";
import { starterBundleMarqueeSettings } from "@/db/schema";
import { isMissingStarterBundleMarqueeSettingsTableError } from "@/lib/db-column-missing";

const SINGLETON_KEY = "default";

/** Public Home read: whether the Starter Bundles marquee is published. */
export async function isStarterBundleMarqueePublished(): Promise<boolean> {
  const ready = await ensureStarterBundleMarqueeSettingsSchema();
  if (!ready) return false;
  try {
    const db = getDb();
    const [row] = await db
      .select({ published: starterBundleMarqueeSettings.published })
      .from(starterBundleMarqueeSettings)
      .where(eq(starterBundleMarqueeSettings.singletonKey, SINGLETON_KEY))
      .limit(1);
    return row?.published === true;
  } catch (error) {
    if (isMissingStarterBundleMarqueeSettingsTableError(error)) return false;
    throw error;
  }
}

export async function setStarterBundleMarqueePublished(params: {
  clerkUserId: string;
  published: boolean;
}): Promise<{ published: boolean }> {
  const ready = await ensureStarterBundleMarqueeSettingsSchema();
  if (!ready) {
    throw new Error("Could not update the Home marquee setting.");
  }
  const db = getDb();
  const now = new Date().toISOString();
  const [existing] = await db
    .select({ singletonKey: starterBundleMarqueeSettings.singletonKey })
    .from(starterBundleMarqueeSettings)
    .where(eq(starterBundleMarqueeSettings.singletonKey, SINGLETON_KEY))
    .limit(1);
  if (existing) {
    await db
      .update(starterBundleMarqueeSettings)
      .set({
        published: params.published,
        updatedByClerkUserId: params.clerkUserId,
        updatedAt: now,
      })
      .where(eq(starterBundleMarqueeSettings.singletonKey, SINGLETON_KEY));
  } else {
    await db.insert(starterBundleMarqueeSettings).values({
      singletonKey: SINGLETON_KEY,
      published: params.published,
      updatedByClerkUserId: params.clerkUserId,
      updatedAt: now,
    });
  }
  return { published: params.published };
}
