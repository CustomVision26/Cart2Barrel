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
