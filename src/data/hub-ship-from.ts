import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { hubShipFromSettings } from "@/db/schema";
import { ensureHubStockSchemaEnums } from "@/data/ensure-hub-stock-schema";
import { usStateToAbbreviation } from "@/lib/us-states";

const HUB_KEY = "default";

export type HubShipFromAddress = {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

function envFallback(): HubShipFromAddress {
  return {
    name: process.env.HUB_SHIP_FROM_NAME?.trim() ?? "",
    phone: process.env.HUB_SHIP_FROM_PHONE?.trim() ?? "",
    line1: process.env.HUB_SHIP_FROM_LINE1?.trim() ?? "",
    line2: process.env.HUB_SHIP_FROM_LINE2?.trim() ?? "",
    city: process.env.HUB_SHIP_FROM_CITY?.trim() ?? "",
    state: process.env.HUB_SHIP_FROM_STATE?.trim() ?? "",
    postalCode: process.env.HUB_SHIP_FROM_ZIP?.trim() ?? "",
    country: process.env.HUB_SHIP_FROM_COUNTRY?.trim() || "United States",
  };
}

export async function loadHubShipFromSettings(): Promise<HubShipFromAddress> {
  const fallback = envFallback();
  try {
    await ensureHubStockSchemaEnums();
    const db = getDb();
    const [row] = await db
      .select()
      .from(hubShipFromSettings)
      .where(eq(hubShipFromSettings.singletonKey, HUB_KEY))
      .limit(1);
    if (!row) return fallback;
    return {
      name: row.name?.trim() || fallback.name,
      phone: row.phone?.trim() || fallback.phone,
      line1: row.line1?.trim() || fallback.line1,
      line2: row.line2?.trim() || fallback.line2,
      city: row.city?.trim() || fallback.city,
      state: row.state?.trim() || fallback.state,
      postalCode: row.postalCode?.trim() || fallback.postalCode,
      country: row.country?.trim() || fallback.country || "United States",
    };
  } catch {
    return fallback;
  }
}

export function isHubShipFromComplete(address: HubShipFromAddress): boolean {
  return Boolean(
    address.name.trim() &&
      address.line1.trim() &&
      address.city.trim() &&
      address.state.trim() &&
      address.postalCode.trim() &&
      usStateToAbbreviation(address.state) &&
      /^\d{5}(?:-\d{4})?$/.test(address.postalCode.trim()),
  );
}

export async function upsertHubShipFromSettings(input: {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  updatedByClerkUserId: string;
}): Promise<void> {
  await ensureHubStockSchemaEnums();
  const db = getDb();
  const now = new Date().toISOString();
  const values = {
    name: input.name,
    phone: input.phone,
    line1: input.line1,
    line2: input.line2 || null,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    country: "United States",
    updatedByClerkUserId: input.updatedByClerkUserId,
    updatedAt: now,
  };
  const [existing] = await db
    .select({ k: hubShipFromSettings.singletonKey })
    .from(hubShipFromSettings)
    .where(eq(hubShipFromSettings.singletonKey, HUB_KEY))
    .limit(1);
  if (existing) {
    await db
      .update(hubShipFromSettings)
      .set(values)
      .where(eq(hubShipFromSettings.singletonKey, HUB_KEY));
    return;
  }
  await db.insert(hubShipFromSettings).values({
    singletonKey: HUB_KEY,
    ...values,
  });
}
