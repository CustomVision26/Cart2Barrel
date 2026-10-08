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
  outboundShippingRateCompanyKey,
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
    destination: row.destination?.trim() || null,
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
    console.error("[listOutboundShippingCompanyRates]", e);
    return [];
  }
}

function rateWriteErrorMessage(e: unknown, fallback: string): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/unique|duplicate/i.test(message)) {
    return "That pricing row already exists for this company.";
  }
  console.error("[outboundShippingCompanyRate]", e);
  return fallback;
}

export async function addOutboundShippingCompanyRate(input: {
  companyName: string;
  destinationCountry?: string | null;
  tableKind: OutboundShippingCompanyRateTableKind;
  rowLabel: string;
  destination?: string | null;
  costOneCents: number;
  costTwoPlusCents: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (!(await readyRatesTable())) {
      return { ok: false, message: "Could not save company pricing." };
    }
    const db = getDb();
    const companyName = input.companyName.trim();
    const rowLabel = input.rowLabel.trim();
    const destination =
      input.tableKind === "container"
        ? input.destination?.trim() || input.destinationCountry?.trim() || null
        : null;
    const companyKey = outboundShippingRateCompanyKey(
      companyName,
      input.destinationCountry,
    );
    const rowKey = outboundShippingRateRowKey(rowLabel, destination);
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
    const maxSort = existing.reduce((max, row) => {
      const n = Number(row.sortIndex);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, -1);

    await db.insert(outboundShippingCompanyRates).values({
      companyName,
      companyKey,
      tableKind: input.tableKind,
      rowLabel,
      rowKey,
      destination,
      costOneCents: input.costOneCents,
      costTwoPlusCents: input.costTwoPlusCents,
      sortIndex: maxSort + 1,
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: rateWriteErrorMessage(e, "Could not save company pricing."),
    };
  }
}

export async function updateOutboundShippingCompanyRate(input: {
  id: string;
  companyName?: string;
  destinationCountry?: string | null;
  rowLabel: string;
  destination?: string | null;
  costOneCents: number;
  costTwoPlusCents: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    if (!(await readyRatesTable())) {
      return { ok: false, message: "Could not update company pricing." };
    }
    const db = getDb();
    const rowLabel = input.rowLabel.trim();
    const destination = input.destination?.trim() || null;
    const offeringKey =
      input.companyName?.trim()
        ? outboundShippingRateCompanyKey(
            input.companyName,
            input.destinationCountry,
          )
        : null;
    const [updated] = await db
      .update(outboundShippingCompanyRates)
      .set({
        ...(offeringKey ? { companyKey: offeringKey } : {}),
        rowLabel,
        rowKey: outboundShippingRateRowKey(rowLabel, destination),
        destination,
        costOneCents: input.costOneCents,
        costTwoPlusCents: input.costTwoPlusCents,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(outboundShippingCompanyRates.id, input.id))
      .returning({ id: outboundShippingCompanyRates.id });
    if (!updated) {
      return { ok: false, message: "Pricing row not found." };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: rateWriteErrorMessage(e, "Could not update company pricing."),
    };
  }
}

export async function deleteOutboundShippingCompanyRate(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
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
  } catch (e) {
    return {
      ok: false,
      message: rateWriteErrorMessage(e, "Could not remove company pricing."),
    };
  }
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
