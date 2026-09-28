import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { outboundShippingCompanyRates } from "@/db/schema";
import {
  ensureBarrelOutboundShippingChargesSchema,
  ensureOutboundShippingCompanyRatesTable,
} from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { isMissingBarrelOutboundShippingChargesTableError } from "@/lib/db-column-missing";
import {
  isOutboundShippingCompanyRateTableKind,
  outboundShippingCompanyKey,
  outboundShippingRateRowKey,
  type OutboundShippingCompanyRateRow,
  type OutboundShippingCompanyRateTableKind,
} from "@/lib/barrel-outbound-shipping-charge";

function mapRate(
  row: typeof outboundShippingCompanyRates.$inferSelect,
): OutboundShippingCompanyRateRow | null {
  if (!isOutboundShippingCompanyRateTableKind(row.tableKind)) return null;
  return {
    id: row.id,
    companyName: row.companyName,
    companyKey: row.companyKey,
    tableKind: row.tableKind,
    rowLabel: row.rowLabel,
    costOneCents: row.costOneCents,
    costTwoPlusCents: row.costTwoPlusCents,
    sortIndex: row.sortIndex,
  };
}

async function readyRatesTable(): Promise<boolean> {
  await ensureBarrelOutboundShippingChargesSchema();
  try {
    await ensureOutboundShippingCompanyRatesTable();
    return true;
  } catch (e) {
    if (isMissingBarrelOutboundShippingChargesTableError(e)) {
      return false;
    }
    throw e;
  }
}

export async function listOutboundShippingCompanyRates(): Promise<
  OutboundShippingCompanyRateRow[]
> {
  if (!(await readyRatesTable())) return [];
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(outboundShippingCompanyRates)
      .orderBy(
        asc(outboundShippingCompanyRates.companyName),
        asc(outboundShippingCompanyRates.tableKind),
        asc(outboundShippingCompanyRates.sortIndex),
        asc(outboundShippingCompanyRates.rowLabel),
      );
    return rows
      .map(mapRate)
      .filter((row): row is OutboundShippingCompanyRateRow => row != null);
  } catch (e) {
    if (isMissingBarrelOutboundShippingChargesTableError(e)) {
      return [];
    }
    throw e;
  }
}

export async function addOutboundShippingCompanyRate(input: {
  companyName: string;
  tableKind: OutboundShippingCompanyRateTableKind;
  rowLabel: string;
  costOneCents: number;
  costTwoPlusCents: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!(await readyRatesTable())) {
    return { ok: false, message: "Could not save company pricing." };
  }
  const db = getDb();
  const companyName = input.companyName.trim();
  const rowLabel = input.rowLabel.trim();
  const companyKey = outboundShippingCompanyKey(companyName);
  const rowKey = outboundShippingRateRowKey(rowLabel);
  const existing = await db
    .select({
      sortIndex: outboundShippingCompanyRates.sortIndex,
    })
    .from(outboundShippingCompanyRates)
    .where(
      and(
        eq(outboundShippingCompanyRates.companyKey, companyKey),
        eq(outboundShippingCompanyRates.tableKind, input.tableKind),
      ),
    )
    .orderBy(asc(outboundShippingCompanyRates.sortIndex));
  const nextSort =
    existing.length > 0
      ? Math.max(...existing.map((row) => row.sortIndex)) + 1
      : 0;

  try {
    await db.insert(outboundShippingCompanyRates).values({
      companyName,
      companyKey,
      tableKind: input.tableKind,
      rowLabel,
      rowKey,
      costOneCents: input.costOneCents,
      costTwoPlusCents: input.costTwoPlusCents,
      sortIndex: nextSort,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(message)) {
      return {
        ok: false,
        message: "That pricing row already exists for this company.",
      };
    }
    throw e;
  }
  return { ok: true };
}

export async function updateOutboundShippingCompanyRate(input: {
  id: string;
  rowLabel: string;
  costOneCents: number;
  costTwoPlusCents: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!(await readyRatesTable())) {
    return { ok: false, message: "Could not update company pricing." };
  }
  const db = getDb();
  const rowLabel = input.rowLabel.trim();
  try {
    const [updated] = await db
      .update(outboundShippingCompanyRates)
      .set({
        rowLabel,
        rowKey: outboundShippingRateRowKey(rowLabel),
        costOneCents: input.costOneCents,
        costTwoPlusCents: input.costTwoPlusCents,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(outboundShippingCompanyRates.id, input.id))
      .returning({ id: outboundShippingCompanyRates.id });
    if (!updated) {
      return { ok: false, message: "Pricing row not found." };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(message)) {
      return {
        ok: false,
        message: "That pricing row already exists for this company.",
      };
    }
    throw e;
  }
  return { ok: true };
}

export async function deleteOutboundShippingCompanyRate(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!(await readyRatesTable())) {
    return { ok: false, message: "Could not remove company pricing." };
  }
  const db = getDb();
  const [deleted] = await db
    .delete(outboundShippingCompanyRates)
    .where(eq(outboundShippingCompanyRates.id, id))
    .returning({ id: outboundShippingCompanyRates.id });
  if (!deleted) {
    return { ok: false, message: "Pricing row not found." };
  }
  return { ok: true };
}

/** Kingdom Kleanerz local courier zones from the parish rate card (USD). */
const KINGDOM_KLEANERZ_COURIER_ZONES: {
  rowLabel: string;
  costOneCents: number;
  costTwoPlusCents: number;
}[] = [
  { rowLabel: "St. Catherine", costOneCents: 8092, costTwoPlusCents: 1603 },
  { rowLabel: "St. Andrew", costOneCents: 11538, costTwoPlusCents: 1923 },
  { rowLabel: "Kingston", costOneCents: 10023, costTwoPlusCents: 2024 },
  { rowLabel: "Clarendon", costOneCents: 15103, costTwoPlusCents: 2244 },
  { rowLabel: "Mandeville", costOneCents: 19231, costTwoPlusCents: 2564 },
  { rowLabel: "Manchester", costOneCents: 19231, costTwoPlusCents: 2564 },
  { rowLabel: "St. Thomas", costOneCents: 19231, costTwoPlusCents: 2564 },
  { rowLabel: "St. Ann", costOneCents: 21154, costTwoPlusCents: 2564 },
  { rowLabel: "St. Mary", costOneCents: 24359, costTwoPlusCents: 2885 },
  { rowLabel: "Portland", costOneCents: 26923, costTwoPlusCents: 3205 },
  { rowLabel: "St. Elizabeth", costOneCents: 28846, costTwoPlusCents: 3205 },
  { rowLabel: "Westmoreland", costOneCents: 30769, costTwoPlusCents: 3205 },
  { rowLabel: "St. James", costOneCents: 32051, costTwoPlusCents: 3205 },
  { rowLabel: "Hanover", costOneCents: 35256, costTwoPlusCents: 3205 },
  { rowLabel: "Trelawny", costOneCents: 22046, costTwoPlusCents: 3205 },
];

export async function seedKingdomKleanerzCourierZones(): Promise<void> {
  if (!(await readyRatesTable())) return;
  const db = getDb();
  const companyName = "Kingdom Kleanerz";
  const companyKey = outboundShippingCompanyKey(companyName);
  try {
    for (const [sortIndex, zone] of KINGDOM_KLEANERZ_COURIER_ZONES.entries()) {
      const rowKey = outboundShippingRateRowKey(zone.rowLabel);
      await db
        .insert(outboundShippingCompanyRates)
        .values({
          companyName,
          companyKey,
          tableKind: "zone",
          rowLabel: zone.rowLabel,
          rowKey,
          costOneCents: zone.costOneCents,
          costTwoPlusCents: zone.costTwoPlusCents,
          sortIndex,
        })
        .onConflictDoUpdate({
          target: [
            outboundShippingCompanyRates.companyKey,
            outboundShippingCompanyRates.tableKind,
            outboundShippingCompanyRates.rowKey,
          ],
          set: {
            companyName,
            rowLabel: zone.rowLabel,
            costOneCents: zone.costOneCents,
            costTwoPlusCents: zone.costTwoPlusCents,
            sortIndex,
            updatedAt: new Date().toISOString(),
          },
        });
    }
  } catch (e) {
    console.error("[seedKingdomKleanerzCourierZones]", e);
  }
}
