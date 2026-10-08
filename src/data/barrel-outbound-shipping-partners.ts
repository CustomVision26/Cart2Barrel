import "server-only";

import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import {
  barrelOutboundShippingCharges,
  barrelOutboundShippingPartners,
  barrels,
} from "@/db/schema";
import {
  ensureBarrelOutboundShippingChargesSchema,
  ensureOutboundPartnerPublicPricingColumn,
} from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { isMissingBarrelOutboundShippingChargesTableError } from "@/lib/db-column-missing";
import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS,
  isBarrelOutboundShippingChargeKind,
  outboundChargeBundleHost,
  outboundShippingCompanyKey,
  outboundShippingCountryKey,
  parseOutboundChargeBundle,
  type BarrelOutboundShippingChargeKind,
  type OutboundShippingPartnerRecord,
} from "@/lib/barrel-outbound-shipping-charge";

function mapPartner(
  row: typeof barrelOutboundShippingPartners.$inferSelect,
): OutboundShippingPartnerRecord {
  return {
    id: row.id,
    barrelId: row.barrelId,
    chargeKind: isBarrelOutboundShippingChargeKind(row.chargeKind)
      ? row.chargeKind
      : "freight",
    name: row.name,
    location: row.location,
    address: row.address,
    country: row.country,
    phone: row.phone,
    cashappId: row.cashappId,
    cashappAccount: row.cashappAccount,
    zelleId: row.zelleId,
    zelleAccount: row.zelleAccount,
    imageUrl: row.imageUrl,
    isPrimary: row.isPrimary,
    customerNote: row.customerNote ?? null,
    publicPricingPublishedAt: row.publicPricingPublishedAt ?? null,
  };
}

function partnerNameKey(name: string): string {
  return name.trim().toLowerCase();
}

async function findCompanyImageUrl(
  chargeKind: BarrelOutboundShippingChargeKind,
  name: string,
): Promise<string | null> {
  const key = partnerNameKey(name);
  if (!key) return null;
  const db = getDb();
  const rows = await db
    .select({
      imageUrl: barrelOutboundShippingPartners.imageUrl,
      name: barrelOutboundShippingPartners.name,
    })
    .from(barrelOutboundShippingPartners)
    .where(eq(barrelOutboundShippingPartners.chargeKind, chargeKind))
    .orderBy(
      desc(barrelOutboundShippingPartners.isPrimary),
      desc(barrelOutboundShippingPartners.updatedAt),
    );
  const match = rows.find(
    (row) => partnerNameKey(row.name) === key && Boolean(row.imageUrl?.trim()),
  );
  return match?.imageUrl?.trim() || null;
}

async function findCompanyCustomerNote(
  name: string,
  country?: string | null,
): Promise<string | null> {
  const key = partnerNameKey(name);
  if (!key) return null;
  const destKey = outboundShippingCountryKey(country);
  const db = getDb();
  const rows = await db
    .select({
      customerNote: barrelOutboundShippingPartners.customerNote,
      name: barrelOutboundShippingPartners.name,
      country: barrelOutboundShippingPartners.country,
    })
    .from(barrelOutboundShippingPartners);
  const match = rows.find((row) => {
    if (partnerNameKey(row.name) !== key) return false;
    if (destKey && outboundShippingCountryKey(row.country) !== destKey) {
      return false;
    }
    return Boolean(row.customerNote?.trim());
  });
  return match?.customerNote?.trim() || null;
}

async function propagateCompanyProfile(input: {
  chargeKind: BarrelOutboundShippingChargeKind;
  previousName: string;
  name: string;
  location: string | null;
  address: string | null;
  country: string | null;
  phone: string | null;
  cashappId: string | null;
  cashappAccount: string | null;
  zelleId: string | null;
  zelleAccount: string | null;
  imageUrl: string | null;
}): Promise<void> {
  const keys = new Set(
    [partnerNameKey(input.previousName), partnerNameKey(input.name)].filter(
      Boolean,
    ),
  );
  if (keys.size === 0) return;
  const db = getDb();
  const destKey = outboundShippingCountryKey(input.country);
  const rows = await db
    .select({
      id: barrelOutboundShippingPartners.id,
      name: barrelOutboundShippingPartners.name,
      country: barrelOutboundShippingPartners.country,
    })
    .from(barrelOutboundShippingPartners)
    .where(eq(barrelOutboundShippingPartners.chargeKind, input.chargeKind));
  const ids = rows
    .filter(
      (row) =>
        keys.has(partnerNameKey(row.name)) &&
        outboundShippingCountryKey(row.country) === destKey,
    )
    .map((row) => row.id);
  if (ids.length === 0) return;
  await db
    .update(barrelOutboundShippingPartners)
    .set({
      name: input.name,
      location: input.chargeKind === "freight" ? null : input.location,
      address: input.address,
      country: input.country,
      phone: input.phone,
      cashappId: input.cashappId,
      cashappAccount: input.cashappAccount,
      zelleId: input.zelleId,
      zelleAccount: input.zelleAccount,
      imageUrl: input.imageUrl,
      updatedAt: new Date().toISOString(),
    })
    .where(inArray(barrelOutboundShippingPartners.id, ids));
}

async function propagateCompanyImageUrl(input: {
  chargeKind: BarrelOutboundShippingChargeKind;
  name: string;
  imageUrl: string | null;
}): Promise<void> {
  const key = partnerNameKey(input.name);
  if (!key) return;
  const db = getDb();
  const rows = await db
    .select({
      id: barrelOutboundShippingPartners.id,
      name: barrelOutboundShippingPartners.name,
    })
    .from(barrelOutboundShippingPartners)
    .where(eq(barrelOutboundShippingPartners.chargeKind, input.chargeKind));
  const ids = rows
    .filter((row) => partnerNameKey(row.name) === key)
    .map((row) => row.id);
  if (ids.length === 0) return;
  await db
    .update(barrelOutboundShippingPartners)
    .set({
      imageUrl: input.imageUrl,
      updatedAt: new Date().toISOString(),
    })
    .where(inArray(barrelOutboundShippingPartners.id, ids));
}

async function resolvePartnerImageUrl(input: {
  chargeKind: BarrelOutboundShippingChargeKind;
  name: string;
  imageUrl?: string | null;
}): Promise<string | null> {
  const provided = input.imageUrl?.trim() || null;
  if (provided) return provided;
  return findCompanyImageUrl(input.chargeKind, input.name);
}

function partnerCatalogKey(
  partner: Pick<OutboundShippingPartnerRecord, "chargeKind" | "name" | "country">,
): string {
  const dest = outboundShippingCountryKey(partner.country);
  return dest
    ? `${partner.chargeKind}:${partner.name.trim().toLowerCase()}:${dest}`
    : `${partner.chargeKind}:${partner.name.trim().toLowerCase()}`;
}

function partnerBarrelIdFilter(barrelId: string | null) {
  return barrelId
    ? eq(barrelOutboundShippingPartners.barrelId, barrelId)
    : isNull(barrelOutboundShippingPartners.barrelId);
}

async function maybeSyncPartnerOntoBarrel(
  barrelId: string | null,
  chargeKind: BarrelOutboundShippingChargeKind,
): Promise<void> {
  if (!barrelId) return;
  await syncPrimaryPartnerOntoCharge(barrelId, chargeKind);
  await syncBundleIfHostPartnerChanged(barrelId, chargeKind);
}

/** Unique companies already saved on any container, newest primary first. */
export async function listOutboundShippingPartnerCatalog(): Promise<
  OutboundShippingPartnerRecord[]
> {
  await ensureBarrelOutboundShippingChargesSchema();
  await ensureOutboundPartnerPublicPricingColumn();
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(barrelOutboundShippingPartners)
      .orderBy(
        desc(barrelOutboundShippingPartners.isPrimary),
        desc(barrelOutboundShippingPartners.updatedAt),
        asc(barrelOutboundShippingPartners.createdAt),
      );
    const seen = new Map<string, number>();
    const catalog: OutboundShippingPartnerRecord[] = [];
    for (const row of rows) {
      const mapped = mapPartner(row);
      const key = partnerCatalogKey(mapped);
      const existingIndex = seen.get(key);
      if (existingIndex != null) {
        const existing = catalog[existingIndex]!;
        const preferCatalog =
          mapped.barrelId == null && existing.barrelId != null;
        if (preferCatalog) {
          catalog[existingIndex] = {
            ...mapped,
            imageUrl: mapped.imageUrl || existing.imageUrl,
          };
        } else if (!existing.imageUrl && mapped.imageUrl) {
          catalog[existingIndex] = { ...existing, imageUrl: mapped.imageUrl };
        }
        continue;
      }
      seen.set(key, catalog.length);
      catalog.push(mapped);
    }
    return catalog;
  } catch (e) {
    if (isMissingBarrelOutboundShippingChargesTableError(e)) {
      return [];
    }
    throw e;
  }
}

export function mergePartnersWithCatalog(
  local: OutboundShippingPartnerRecord[],
  catalog: OutboundShippingPartnerRecord[],
): OutboundShippingPartnerRecord[] {
  const have = new Set(local.map(partnerCatalogKey));
  const extras = catalog
    .filter((partner) => !have.has(partnerCatalogKey(partner)))
    .map((partner) => ({ ...partner, isPrimary: false }));
  return [...local, ...extras];
}

export async function listOutboundShippingPartnersByBarrelIds(
  barrelIds: string[],
): Promise<Map<string, OutboundShippingPartnerRecord[]>> {
  const byBarrel = new Map<string, OutboundShippingPartnerRecord[]>();
  if (barrelIds.length === 0) return byBarrel;

  await ensureBarrelOutboundShippingChargesSchema();
  await ensureOutboundPartnerPublicPricingColumn();
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(barrelOutboundShippingPartners)
      .where(inArray(barrelOutboundShippingPartners.barrelId, barrelIds))
      .orderBy(
        desc(barrelOutboundShippingPartners.isPrimary),
        asc(barrelOutboundShippingPartners.createdAt),
      );
    for (const row of rows) {
      if (!row.barrelId) continue;
      const list = byBarrel.get(row.barrelId) ?? [];
      list.push(mapPartner(row));
      byBarrel.set(row.barrelId, list);
    }
  } catch (e) {
    if (!isMissingBarrelOutboundShippingChargesTableError(e)) {
      throw e;
    }
  }
  return byBarrel;
}

export async function getPrimaryOutboundShippingPartner(
  barrelId: string | null,
  chargeKind: BarrelOutboundShippingChargeKind,
): Promise<OutboundShippingPartnerRecord | null> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [primary] = await db
    .select()
    .from(barrelOutboundShippingPartners)
    .where(
      and(
        partnerBarrelIdFilter(barrelId),
        eq(barrelOutboundShippingPartners.chargeKind, chargeKind),
        eq(barrelOutboundShippingPartners.isPrimary, true),
      ),
    )
    .limit(1);
  if (primary) return mapPartner(primary);

  const [first] = await db
    .select()
    .from(barrelOutboundShippingPartners)
    .where(
      and(
        partnerBarrelIdFilter(barrelId),
        eq(barrelOutboundShippingPartners.chargeKind, chargeKind),
      ),
    )
    .orderBy(asc(barrelOutboundShippingPartners.createdAt))
    .limit(1);
  return first ? mapPartner(first) : null;
}

export async function copyPrimaryPartnerToChargeKind(input: {
  barrelId: string | null;
  fromKind: BarrelOutboundShippingChargeKind;
  toKind: BarrelOutboundShippingChargeKind;
}): Promise<void> {
  if (input.fromKind === input.toKind) return;
  const source = await getPrimaryOutboundShippingPartner(
    input.barrelId,
    input.fromKind,
  );
  if (!source?.name.trim()) return;
  await addOutboundShippingPartner({
    barrelId: input.barrelId,
    chargeKind: input.toKind,
    name: source.name,
    location: source.location,
    address: source.address,
    country: source.country,
    phone: source.phone,
    cashappId: source.cashappId,
    cashappAccount: source.cashappAccount,
    zelleId: source.zelleId,
    zelleAccount: source.zelleAccount,
    imageUrl: source.imageUrl,
    isPrimary: true,
  });
}

async function companyChargeKindsAtScope(
  barrelId: string | null,
  name: string,
  country?: string | null,
): Promise<BarrelOutboundShippingChargeKind[]> {
  const key = partnerNameKey(name);
  if (!key) return [];
  const destKey = outboundShippingCountryKey(country);
  const db = getDb();
  const rows = await db
    .select({
      chargeKind: barrelOutboundShippingPartners.chargeKind,
      name: barrelOutboundShippingPartners.name,
      country: barrelOutboundShippingPartners.country,
    })
    .from(barrelOutboundShippingPartners)
    .where(partnerBarrelIdFilter(barrelId));
  const found = new Set<BarrelOutboundShippingChargeKind>();
  for (const row of rows) {
    if (partnerNameKey(row.name) !== key) continue;
    if (outboundShippingCountryKey(row.country) !== destKey) continue;
    if (isBarrelOutboundShippingChargeKind(row.chargeKind)) {
      found.add(row.chargeKind);
    }
  }
  return BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS.filter((kind) => found.has(kind));
}

export async function removeCompanyFromOtherChargeKinds(input: {
  barrelId: string | null;
  name: string;
  keepKind: BarrelOutboundShippingChargeKind;
  country?: string | null;
}): Promise<void> {
  const key = partnerNameKey(input.name);
  if (!key) return;
  const destKey = outboundShippingCountryKey(input.country);
  const db = getDb();
  const rows = await db
    .select({
      id: barrelOutboundShippingPartners.id,
      name: barrelOutboundShippingPartners.name,
      chargeKind: barrelOutboundShippingPartners.chargeKind,
      country: barrelOutboundShippingPartners.country,
    })
    .from(barrelOutboundShippingPartners)
    .where(partnerBarrelIdFilter(input.barrelId));
  const ids = rows
    .filter(
      (row) =>
        partnerNameKey(row.name) === key &&
        outboundShippingCountryKey(row.country) === destKey &&
        row.chargeKind !== input.keepKind,
    )
    .map((row) => row.id);
  if (ids.length === 0) return;
  await db
    .delete(barrelOutboundShippingPartners)
    .where(inArray(barrelOutboundShippingPartners.id, ids));
}

/** Undo leftover global freight+broker clones on the company catalog. */
export async function clearStaleCatalogChargeBundleClones(): Promise<void> {
  const { getOutboundShippingCatalogDefaults, setCatalogChargeBundle } =
    await import("@/data/outbound-shipping-catalog-defaults");
  const defaults = await getOutboundShippingCatalogDefaults();
  const host = outboundChargeBundleHost(defaults.chargeBundle);
  if (!host) return;
  const db = getDb();
  const rows = await db
    .select({
      id: barrelOutboundShippingPartners.id,
      name: barrelOutboundShippingPartners.name,
      chargeKind: barrelOutboundShippingPartners.chargeKind,
    })
    .from(barrelOutboundShippingPartners);
  const hostNames = new Set(
    rows
      .filter((row) => row.chargeKind === host)
      .map((row) => partnerNameKey(row.name)),
  );
  const extraIds = rows
    .filter(
      (row) =>
        row.chargeKind !== host &&
        defaults.chargeBundle.includes(
          row.chargeKind as BarrelOutboundShippingChargeKind,
        ) &&
        hostNames.has(partnerNameKey(row.name)),
    )
    .map((row) => row.id);
  if (extraIds.length > 0) {
    await db
      .delete(barrelOutboundShippingPartners)
      .where(inArray(barrelOutboundShippingPartners.id, extraIds));
  }
  await setCatalogChargeBundle([]);
}

export async function syncBundlePartnersFromHost(
  barrelId: string | null,
  bundle: readonly BarrelOutboundShippingChargeKind[],
): Promise<void> {
  const host = outboundChargeBundleHost(bundle);
  if (!host) return;
  const source = await getPrimaryOutboundShippingPartner(barrelId, host);
  if (!source?.name.trim()) return;
  const existingKinds = await companyChargeKindsAtScope(
    barrelId,
    source.name,
    source.country,
  );
  const alreadyConsolidated = existingKinds.some(
    (kind) => kind !== host && bundle.includes(kind),
  );
  if (!alreadyConsolidated) return;
  for (const kind of bundle) {
    if (kind === host) continue;
    await copyPrimaryPartnerToChargeKind({
      barrelId,
      fromKind: host,
      toKind: kind,
    });
  }
}

async function syncBundleIfHostPartnerChanged(
  barrelId: string,
  chargeKind: BarrelOutboundShippingChargeKind,
): Promise<void> {
  const db = getDb();
  const [barrel] = await db
    .select({ outboundChargeBundle: barrels.outboundChargeBundle })
    .from(barrels)
    .where(eq(barrels.id, barrelId))
    .limit(1);
  const bundle = parseOutboundChargeBundle(barrel?.outboundChargeBundle);
  if (outboundChargeBundleHost(bundle) !== chargeKind) return;
  await syncBundlePartnersFromHost(barrelId, bundle);
}

async function syncPrimaryPartnerOntoCharge(
  barrelId: string,
  chargeKind: BarrelOutboundShippingChargeKind,
): Promise<void> {
  const db = getDb();
  const [charge] = await db
    .select({
      id: barrelOutboundShippingCharges.id,
      paidAt: barrelOutboundShippingCharges.paidAt,
    })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.barrelId, barrelId),
        eq(barrelOutboundShippingCharges.chargeKind, chargeKind),
      ),
    )
    .limit(1);
  if (!charge || charge.paidAt) return;

  const primary = await getPrimaryOutboundShippingPartner(barrelId, chargeKind);
  await db
    .update(barrelOutboundShippingCharges)
    .set({
      partnerName: primary?.name ?? null,
      partnerLocation: chargeKind === "freight" ? null : (primary?.location ?? null),
      partnerAddress: primary?.address ?? null,
      partnerCountry: chargeKind === "freight" ? null : (primary?.country ?? null),
      partnerPhone: primary?.phone ?? null,
      partnerCashappId: primary?.cashappId ?? null,
      partnerCashappAccount: primary?.cashappAccount ?? null,
      partnerZelleId: primary?.zelleId ?? null,
      partnerZelleAccount: primary?.zelleAccount ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(barrelOutboundShippingCharges.id, charge.id));
}

async function clearPrimaryForKind(
  barrelId: string | null,
  chargeKind: BarrelOutboundShippingChargeKind,
  country?: string | null,
): Promise<void> {
  const db = getDb();
  const destKey = outboundShippingCountryKey(country);
  const rows = await db
    .select({
      id: barrelOutboundShippingPartners.id,
      country: barrelOutboundShippingPartners.country,
    })
    .from(barrelOutboundShippingPartners)
    .where(
      and(
        partnerBarrelIdFilter(barrelId),
        eq(barrelOutboundShippingPartners.chargeKind, chargeKind),
      ),
    );
  const ids = rows
    .filter((row) => outboundShippingCountryKey(row.country) === destKey)
    .map((row) => row.id);
  if (ids.length === 0) return;
  await db
    .update(barrelOutboundShippingPartners)
    .set({ isPrimary: false, updatedAt: new Date().toISOString() })
    .where(inArray(barrelOutboundShippingPartners.id, ids));
}

export async function addOutboundShippingPartner(input: {
  barrelId: string | null;
  chargeKind: BarrelOutboundShippingChargeKind;
  name: string;
  location: string | null;
  address: string | null;
  country: string | null;
  phone: string | null;
  cashappId: string | null;
  cashappAccount: string | null;
  zelleId: string | null;
  zelleAccount: string | null;
  imageUrl?: string | null;
  isPrimary: boolean;
  keepOnlyThisKind?: boolean;
}): Promise<OutboundShippingPartnerRecord> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const existing = await db
    .select({ id: barrelOutboundShippingPartners.id })
    .from(barrelOutboundShippingPartners)
    .where(
      and(
        partnerBarrelIdFilter(input.barrelId),
        eq(barrelOutboundShippingPartners.chargeKind, input.chargeKind),
      ),
    );
  const sameNameCandidates = await db
    .select()
    .from(barrelOutboundShippingPartners)
    .where(
      and(
        partnerBarrelIdFilter(input.barrelId),
        eq(barrelOutboundShippingPartners.chargeKind, input.chargeKind),
        eq(barrelOutboundShippingPartners.name, input.name),
      ),
    );
  const destKey = outboundShippingCountryKey(input.country);
  const sameName =
    sameNameCandidates.find(
      (row) => outboundShippingCountryKey(row.country) === destKey,
    ) ?? null;
  const makePrimary = input.isPrimary || existing.length === 0 || Boolean(sameName?.isPrimary);
  const imageUrl = await resolvePartnerImageUrl({
    chargeKind: input.chargeKind,
    name: input.name,
    imageUrl: input.imageUrl,
  });
  if (makePrimary) {
    await clearPrimaryForKind(input.barrelId, input.chargeKind, input.country);
  }

  if (sameName) {
    const [updated] = await db
      .update(barrelOutboundShippingPartners)
      .set({
        location: input.location,
        address: input.address,
        country: input.country,
        phone: input.phone,
        cashappId: input.cashappId,
        cashappAccount: input.cashappAccount,
        zelleId: input.zelleId,
        zelleAccount: input.zelleAccount,
        imageUrl,
        isPrimary: makePrimary,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(barrelOutboundShippingPartners.id, sameName.id))
      .returning();
    if (!updated) {
      throw new Error("Could not update partner record.");
    }
    if (imageUrl) {
      await propagateCompanyImageUrl({
        chargeKind: input.chargeKind,
        name: input.name,
        imageUrl,
      });
    }
    await maybeSyncPartnerOntoBarrel(input.barrelId, input.chargeKind);
    if (input.keepOnlyThisKind) {
      await removeCompanyFromOtherChargeKinds({
        barrelId: input.barrelId,
        name: sameName.name,
        keepKind: input.chargeKind,
        country: sameName.country,
      });
    }
    return mapPartner(updated);
  }

  const [inserted] = await db
    .insert(barrelOutboundShippingPartners)
    .values({
      barrelId: input.barrelId,
      chargeKind: input.chargeKind,
      name: input.name,
      location: input.location,
      address: input.address,
      country: input.country,
      phone: input.phone,
      cashappId: input.cashappId,
      cashappAccount: input.cashappAccount,
      zelleId: input.zelleId,
      zelleAccount: input.zelleAccount,
      imageUrl,
      isPrimary: makePrimary,
      customerNote: await findCompanyCustomerNote(input.name, input.country),
    })
    .returning();
  if (!inserted) {
    throw new Error("Could not add partner record.");
  }
  if (imageUrl) {
    await propagateCompanyImageUrl({
      chargeKind: input.chargeKind,
      name: input.name,
      imageUrl,
    });
  }
  await maybeSyncPartnerOntoBarrel(input.barrelId, input.chargeKind);
  if (input.keepOnlyThisKind) {
    await removeCompanyFromOtherChargeKinds({
      barrelId: input.barrelId,
      name: input.name,
      keepKind: input.chargeKind,
      country: input.country,
    });
  }

  return mapPartner(inserted);
}

export async function applyCatalogPartnerToBarrel(input: {
  sourcePartnerId: string;
  barrelId: string;
}): Promise<
  { ok: true } | { ok: false; message: string }
> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [source] = await db
    .select()
    .from(barrelOutboundShippingPartners)
    .where(eq(barrelOutboundShippingPartners.id, input.sourcePartnerId))
    .limit(1);
  if (!source) {
    return { ok: false, message: "Company record not found." };
  }
  const kind = isBarrelOutboundShippingChargeKind(source.chargeKind)
    ? source.chargeKind
    : "freight";
  await addOutboundShippingPartner({
    barrelId: input.barrelId,
    chargeKind: kind,
    name: source.name,
    location: source.location,
    address: source.address,
    country: source.country,
    phone: source.phone,
    cashappId: source.cashappId,
    cashappAccount: source.cashappAccount,
    zelleId: source.zelleId,
    zelleAccount: source.zelleAccount,
    imageUrl: source.imageUrl,
    isPrimary: true,
  });
  return { ok: true };
}

export async function updateOutboundShippingPartner(input: {
  id: string;
  name: string;
  location: string | null;
  address: string | null;
  country: string | null;
  phone: string | null;
  cashappId: string | null;
  cashappAccount: string | null;
  zelleId: string | null;
  zelleAccount: string | null;
  imageUrl?: string | null;
  isPrimary: boolean;
  keepOnlyThisKind?: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(barrelOutboundShippingPartners)
    .where(eq(barrelOutboundShippingPartners.id, input.id))
    .limit(1);
  if (!row) {
    return { ok: false, message: "Record not found." };
  }
  const kind = isBarrelOutboundShippingChargeKind(row.chargeKind)
    ? row.chargeKind
    : "freight";
  const makePrimary = input.isPrimary || row.isPrimary;
  const imageUrl = input.imageUrl?.trim() || null;
  if (makePrimary) {
    await clearPrimaryForKind(row.barrelId, kind, input.country);
  }
  await db
    .update(barrelOutboundShippingPartners)
    .set({
      name: input.name,
      location: kind === "freight" ? null : input.location,
      address: input.address,
      country: input.country,
      phone: input.phone,
      cashappId: input.cashappId,
      cashappAccount: input.cashappAccount,
      zelleId: input.zelleId,
      zelleAccount: input.zelleAccount,
      imageUrl,
      isPrimary: makePrimary,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(barrelOutboundShippingPartners.id, input.id));
  await propagateCompanyProfile({
    chargeKind: kind,
    previousName: row.name,
    name: input.name,
    location: kind === "freight" ? null : input.location,
    address: input.address,
    country: input.country,
    phone: input.phone,
    cashappId: input.cashappId,
    cashappAccount: input.cashappAccount,
    zelleId: input.zelleId,
    zelleAccount: input.zelleAccount,
    imageUrl,
  });
  if (row.barrelId != null) {
    await addOutboundShippingPartner({
      barrelId: null,
      chargeKind: kind,
      name: input.name,
      location: kind === "freight" ? null : input.location,
      address: input.address,
      country: input.country,
      phone: input.phone,
      cashappId: input.cashappId,
      cashappAccount: input.cashappAccount,
      zelleId: input.zelleId,
      zelleAccount: input.zelleAccount,
      imageUrl,
      isPrimary: makePrimary,
      keepOnlyThisKind: input.keepOnlyThisKind,
    });
  }
  await maybeSyncPartnerOntoBarrel(row.barrelId, kind);
  if (input.keepOnlyThisKind) {
    await removeCompanyFromOtherChargeKinds({
      barrelId: row.barrelId,
      name: row.name,
      keepKind: kind,
      country: row.country,
    });
  }
  return { ok: true };
}

export async function setOutboundShippingPartnerPrimary(
  id: string,
  options?: { catalog?: boolean },
): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(barrelOutboundShippingPartners)
    .where(eq(barrelOutboundShippingPartners.id, id))
    .limit(1);
  if (!row) {
    return { ok: false, message: "Record not found." };
  }
  const kind = isBarrelOutboundShippingChargeKind(row.chargeKind)
    ? row.chargeKind
    : "freight";
  if (options?.catalog) {
    const catalog = await addOutboundShippingPartner({
      barrelId: null,
      chargeKind: kind,
      name: row.name,
      location: row.location,
      address: row.address,
      country: row.country,
      phone: row.phone,
      cashappId: row.cashappId,
      cashappAccount: row.cashappAccount,
      zelleId: row.zelleId,
      zelleAccount: row.zelleAccount,
      imageUrl: row.imageUrl,
      isPrimary: true,
    });
    await maybeSyncPartnerOntoBarrel(catalog.barrelId, kind);
    return { ok: true };
  }
  await clearPrimaryForKind(row.barrelId, kind, row.country);
  await db
    .update(barrelOutboundShippingPartners)
    .set({ isPrimary: true, updatedAt: new Date().toISOString() })
    .where(eq(barrelOutboundShippingPartners.id, id));
  await maybeSyncPartnerOntoBarrel(row.barrelId, kind);
  return { ok: true };
}

export async function deleteOutboundShippingPartner(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [row] = await db
    .select()
    .from(barrelOutboundShippingPartners)
    .where(eq(barrelOutboundShippingPartners.id, id))
    .limit(1);
  if (!row) {
    return { ok: false, message: "Record not found." };
  }
  const kind = isBarrelOutboundShippingChargeKind(row.chargeKind)
    ? row.chargeKind
    : "freight";
  const nameKey = partnerNameKey(row.name);
  const destKey = outboundShippingCountryKey(row.country);
  const scoped = await db
    .select({
      id: barrelOutboundShippingPartners.id,
      name: barrelOutboundShippingPartners.name,
      country: barrelOutboundShippingPartners.country,
    })
    .from(barrelOutboundShippingPartners)
    .where(partnerBarrelIdFilter(row.barrelId));
  const ids = scoped
    .filter(
      (item) =>
        partnerNameKey(item.name) === nameKey &&
        outboundShippingCountryKey(item.country) === destKey,
    )
    .map((item) => item.id);
  if (ids.length === 0) {
    return { ok: false, message: "Record not found." };
  }
  await db
    .delete(barrelOutboundShippingPartners)
    .where(inArray(barrelOutboundShippingPartners.id, ids));
  await maybeSyncPartnerOntoBarrel(row.barrelId, kind);
  return { ok: true };
}

/** Copy charge partner fields into the table when no partner rows exist yet. */
export async function backfillOutboundShippingPartnersFromCharges(
  barrelIds: string[],
): Promise<void> {
  if (barrelIds.length === 0) return;
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  try {
    const existing = await db
      .select({
        barrelId: barrelOutboundShippingPartners.barrelId,
        chargeKind: barrelOutboundShippingPartners.chargeKind,
      })
      .from(barrelOutboundShippingPartners)
      .where(inArray(barrelOutboundShippingPartners.barrelId, barrelIds));
    const have = new Set(
      existing.map((r) => `${r.barrelId}:${r.chargeKind}`),
    );

    const charges = await db
      .select()
      .from(barrelOutboundShippingCharges)
      .where(inArray(barrelOutboundShippingCharges.barrelId, barrelIds));

    for (const charge of charges) {
      const kind = isBarrelOutboundShippingChargeKind(charge.chargeKind)
        ? charge.chargeKind
        : "freight";
      if (have.has(`${charge.barrelId}:${kind}`)) continue;
      const name = charge.partnerName?.trim();
      if (!name) continue;
      await db.insert(barrelOutboundShippingPartners).values({
        barrelId: charge.barrelId,
        chargeKind: kind,
        name,
        location: charge.partnerLocation,
        address: charge.partnerAddress,
        country: charge.partnerCountry,
        phone: charge.partnerPhone,
        cashappId: charge.partnerCashappId,
        cashappAccount: charge.partnerCashappAccount,
        zelleId: charge.partnerZelleId,
        zelleAccount: charge.partnerZelleAccount,
        isPrimary: true,
      });
    }
  } catch (e) {
    if (!isMissingBarrelOutboundShippingChargesTableError(e)) {
      throw e;
    }
  }
}

export async function setOutboundShippingPartnerPublicPricing(input: {
  id: string;
  published: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureBarrelOutboundShippingChargesSchema();
  await ensureOutboundPartnerPublicPricingColumn();
  const db = getDb();
  try {
    const [row] = await db
      .select({ id: barrelOutboundShippingPartners.id })
      .from(barrelOutboundShippingPartners)
      .where(eq(barrelOutboundShippingPartners.id, input.id))
      .limit(1);
    if (!row) {
      return { ok: false, message: "Company record not found." };
    }
    await db
      .update(barrelOutboundShippingPartners)
      .set({
        publicPricingPublishedAt: input.published
          ? new Date().toISOString()
          : null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(barrelOutboundShippingPartners.id, input.id));
    return { ok: true };
  } catch (e) {
    if (isMissingBarrelOutboundShippingChargesTableError(e)) {
      return { ok: false, message: "Could not update public pricing yet." };
    }
    throw e;
  }
}

export async function setOutboundCompanyCustomerNote(input: {
  companyName: string;
  customerNote: string | null;
  country?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const companyKey = outboundShippingCompanyKey(input.companyName);
  if (!companyKey) {
    return { ok: false, message: "Add a company first." };
  }
  await ensureBarrelOutboundShippingChargesSchema();
  await ensureOutboundPartnerPublicPricingColumn();
  const db = getDb();
  const destKey = outboundShippingCountryKey(input.country);
  const rows = await db
    .select({
      id: barrelOutboundShippingPartners.id,
      name: barrelOutboundShippingPartners.name,
      country: barrelOutboundShippingPartners.country,
    })
    .from(barrelOutboundShippingPartners);
  const ids = rows
    .filter((row) => {
      if (outboundShippingCompanyKey(row.name) !== companyKey) return false;
      if (destKey && outboundShippingCountryKey(row.country) !== destKey) {
        return false;
      }
      return true;
    })
    .map((row) => row.id);
  if (ids.length === 0) {
    return { ok: false, message: "Add a company first." };
  }
  await db
    .update(barrelOutboundShippingPartners)
    .set({
      customerNote: input.customerNote?.trim() || null,
      updatedAt: new Date().toISOString(),
    })
    .where(inArray(barrelOutboundShippingPartners.id, ids));
  return { ok: true };
}
