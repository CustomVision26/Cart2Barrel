import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  barrelOutboundShippingCharges,
  barrelOutboundShippingPartners,
} from "@/db/schema";
import { ensureBarrelOutboundShippingChargesSchema } from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { isMissingBarrelOutboundShippingChargesTableError } from "@/lib/db-column-missing";
import type {
  BarrelOutboundShippingChargeKind,
  OutboundShippingPartnerRecord,
} from "@/lib/barrel-outbound-shipping-charge";
import { isBarrelOutboundShippingChargeKind } from "@/lib/barrel-outbound-shipping-charge";

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
    isPrimary: row.isPrimary,
  };
}

function partnerCatalogKey(partner: Pick<OutboundShippingPartnerRecord, "chargeKind" | "name">): string {
  return `${partner.chargeKind}:${partner.name.trim().toLowerCase()}`;
}

/** Unique companies already saved on any container, newest primary first. */
export async function listOutboundShippingPartnerCatalog(): Promise<
  OutboundShippingPartnerRecord[]
> {
  await ensureBarrelOutboundShippingChargesSchema();
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
    const seen = new Set<string>();
    const catalog: OutboundShippingPartnerRecord[] = [];
    for (const row of rows) {
      const mapped = mapPartner(row);
      const key = partnerCatalogKey(mapped);
      if (seen.has(key)) continue;
      seen.add(key);
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
  barrelId: string,
  chargeKind: BarrelOutboundShippingChargeKind,
): Promise<OutboundShippingPartnerRecord | null> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const [primary] = await db
    .select()
    .from(barrelOutboundShippingPartners)
    .where(
      and(
        eq(barrelOutboundShippingPartners.barrelId, barrelId),
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
        eq(barrelOutboundShippingPartners.barrelId, barrelId),
        eq(barrelOutboundShippingPartners.chargeKind, chargeKind),
      ),
    )
    .orderBy(asc(barrelOutboundShippingPartners.createdAt))
    .limit(1);
  return first ? mapPartner(first) : null;
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
  barrelId: string,
  chargeKind: BarrelOutboundShippingChargeKind,
): Promise<void> {
  const db = getDb();
  await db
    .update(barrelOutboundShippingPartners)
    .set({ isPrimary: false, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(barrelOutboundShippingPartners.barrelId, barrelId),
        eq(barrelOutboundShippingPartners.chargeKind, chargeKind),
      ),
    );
}

export async function addOutboundShippingPartner(input: {
  barrelId: string;
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
  isPrimary: boolean;
}): Promise<OutboundShippingPartnerRecord> {
  await ensureBarrelOutboundShippingChargesSchema();
  const db = getDb();
  const existing = await db
    .select({ id: barrelOutboundShippingPartners.id })
    .from(barrelOutboundShippingPartners)
    .where(
      and(
        eq(barrelOutboundShippingPartners.barrelId, input.barrelId),
        eq(barrelOutboundShippingPartners.chargeKind, input.chargeKind),
      ),
    );
  const [sameName] = await db
    .select()
    .from(barrelOutboundShippingPartners)
    .where(
      and(
        eq(barrelOutboundShippingPartners.barrelId, input.barrelId),
        eq(barrelOutboundShippingPartners.chargeKind, input.chargeKind),
        eq(barrelOutboundShippingPartners.name, input.name),
      ),
    )
    .limit(1);
  const makePrimary = input.isPrimary || existing.length === 0 || Boolean(sameName?.isPrimary);
  if (makePrimary) {
    await clearPrimaryForKind(input.barrelId, input.chargeKind);
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
        isPrimary: makePrimary,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(barrelOutboundShippingPartners.id, sameName.id))
      .returning();
    if (!updated) {
      throw new Error("Could not update partner record.");
    }
    await syncPrimaryPartnerOntoCharge(input.barrelId, input.chargeKind);
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
      isPrimary: makePrimary,
    })
    .returning();
  if (!inserted) {
    throw new Error("Could not add partner record.");
  }
  await syncPrimaryPartnerOntoCharge(input.barrelId, input.chargeKind);

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
  isPrimary: boolean;
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
  if (makePrimary) {
    await clearPrimaryForKind(row.barrelId, kind);
  }
  await db
    .update(barrelOutboundShippingPartners)
    .set({
      name: input.name,
      location: kind === "freight" ? null : input.location,
      address: input.address,
      country: kind === "freight" ? null : input.country,
      phone: input.phone,
      cashappId: input.cashappId,
      cashappAccount: input.cashappAccount,
      zelleId: input.zelleId,
      zelleAccount: input.zelleAccount,
      isPrimary: makePrimary,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(barrelOutboundShippingPartners.id, input.id));
  await syncPrimaryPartnerOntoCharge(row.barrelId, kind);
  return { ok: true };
}

export async function setOutboundShippingPartnerPrimary(
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
  await clearPrimaryForKind(row.barrelId, kind);
  await db
    .update(barrelOutboundShippingPartners)
    .set({ isPrimary: true, updatedAt: new Date().toISOString() })
    .where(eq(barrelOutboundShippingPartners.id, id));
  await syncPrimaryPartnerOntoCharge(row.barrelId, kind);
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
  const wasPrimary = row.isPrimary;
  const kind = isBarrelOutboundShippingChargeKind(row.chargeKind)
    ? row.chargeKind
    : "freight";
  await db
    .delete(barrelOutboundShippingPartners)
    .where(eq(barrelOutboundShippingPartners.id, id));

  if (wasPrimary) {
    const [next] = await db
      .select()
      .from(barrelOutboundShippingPartners)
      .where(
        and(
          eq(barrelOutboundShippingPartners.barrelId, row.barrelId),
          eq(barrelOutboundShippingPartners.chargeKind, kind),
        ),
      )
      .orderBy(asc(barrelOutboundShippingPartners.createdAt))
      .limit(1);
    if (next) {
      await db
        .update(barrelOutboundShippingPartners)
        .set({ isPrimary: true, updatedAt: new Date().toISOString() })
        .where(eq(barrelOutboundShippingPartners.id, next.id));
    }
  }
  await syncPrimaryPartnerOntoCharge(row.barrelId, kind);
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
