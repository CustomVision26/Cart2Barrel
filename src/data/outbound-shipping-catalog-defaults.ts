import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { outboundShippingCatalogDefaults } from "@/db/schema";
import {
  ensureBarrelOutboundShippingChargesSchema,
  ensureOutboundShippingCatalogDefaultsTable,
} from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { isMissingBarrelOutboundShippingChargesTableError } from "@/lib/db-column-missing";
import {
  parseOutboundChargeBundle,
  parseOutboundCompanyRateKinds,
  serializeOutboundChargeBundle,
  serializeOutboundCompanyRateKinds,
  type BarrelOutboundShippingChargeKind,
} from "@/lib/barrel-outbound-shipping-charge";

const SINGLETON_KEY = "default";

export type OutboundShippingCatalogDefaults = {
  chargeBundle: BarrelOutboundShippingChargeKind[];
  companyRateKinds: BarrelOutboundShippingChargeKind[];
};

const EMPTY: OutboundShippingCatalogDefaults = {
  chargeBundle: [],
  companyRateKinds: [],
};

async function readyCatalogDefaultsTable(): Promise<boolean> {
  await ensureBarrelOutboundShippingChargesSchema();
  try {
    await ensureOutboundShippingCatalogDefaultsTable();
    return true;
  } catch (e) {
    if (isMissingBarrelOutboundShippingChargesTableError(e)) {
      return false;
    }
    throw e;
  }
}

export async function getOutboundShippingCatalogDefaults(): Promise<OutboundShippingCatalogDefaults> {
  if (!(await readyCatalogDefaultsTable())) return EMPTY;
  const db = getDb();
  try {
    const [row] = await db
      .select()
      .from(outboundShippingCatalogDefaults)
      .where(eq(outboundShippingCatalogDefaults.singletonKey, SINGLETON_KEY))
      .limit(1);
    if (!row) return EMPTY;
    return {
      chargeBundle: parseOutboundChargeBundle(row.chargeBundle),
      companyRateKinds: parseOutboundCompanyRateKinds(row.companyRateKinds),
    };
  } catch (e) {
    if (isMissingBarrelOutboundShippingChargesTableError(e)) {
      return EMPTY;
    }
    throw e;
  }
}

export async function setCatalogChargeBundle(
  kinds: readonly BarrelOutboundShippingChargeKind[],
): Promise<void> {
  if (!(await readyCatalogDefaultsTable())) return;
  const db = getDb();
  const chargeBundle = serializeOutboundChargeBundle(kinds);
  const now = new Date().toISOString();
  await db
    .insert(outboundShippingCatalogDefaults)
    .values({
      singletonKey: SINGLETON_KEY,
      chargeBundle,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: outboundShippingCatalogDefaults.singletonKey,
      set: {
        chargeBundle,
        updatedAt: now,
      },
    });
}

export async function setCatalogCompanyRateKinds(
  kinds: readonly BarrelOutboundShippingChargeKind[],
): Promise<void> {
  if (!(await readyCatalogDefaultsTable())) return;
  const db = getDb();
  const companyRateKinds = serializeOutboundCompanyRateKinds(kinds);
  const now = new Date().toISOString();
  await db
    .insert(outboundShippingCatalogDefaults)
    .values({
      singletonKey: SINGLETON_KEY,
      companyRateKinds,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: outboundShippingCatalogDefaults.singletonKey,
      set: {
        companyRateKinds,
        updatedAt: now,
      },
    });
}
