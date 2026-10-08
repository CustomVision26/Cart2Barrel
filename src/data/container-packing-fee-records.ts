import "server-only";

import { and, desc, eq, isNotNull } from "drizzle-orm";

import { getDb } from "@/db";
import {
  containerPackingFeeRecords,
  merchantPackingFeeSettings,
} from "@/db/schema";
import { ensureContainerPackingFeeRecordsSchema } from "@/data/ensure-container-packing-fee-records-schema";
import { isMissingContainerPackingFeeRecordsTableError } from "@/lib/db-column-missing";
import type {
  ContainerPackingFeeRecord,
  ContainerPackingRates,
} from "@/lib/container-packing-fee";
import {
  parseCargoBoxPackingSize,
  type CargoBoxPackingSize,
} from "@/lib/validations/container-offering";

export type { ContainerPackingFeeRecord };

function packingKind(
  kind: string,
): "barrel" | "bin" | "cargo_box" | null {
  if (kind === "barrel" || kind === "bin" || kind === "cargo_box") return kind;
  return null;
}

function mapRecord(
  row: typeof containerPackingFeeRecords.$inferSelect,
): ContainerPackingFeeRecord | null {
  const kind = packingKind(row.containerKind);
  if (!kind) return null;
  const size =
    kind === "cargo_box" ? parseCargoBoxPackingSize(row.cargoBoxSize) : null;
  if (kind === "cargo_box" && !size) return null;
  return {
    id: row.id,
    containerKind: kind,
    cargoBoxSize: size,
    singleFeeCents: Math.max(0, row.singleFeeCents),
    multiFeeCents: Math.max(0, row.multiFeeCents),
    publishedAt: row.publishedAt ?? null,
    updatedAt: row.updatedAt,
  };
}

function sizeKey(size: CargoBoxPackingSize | null | undefined): string {
  return size ?? "";
}

export async function listContainerPackingFeeRecords(): Promise<
  ContainerPackingFeeRecord[]
> {
  await ensureContainerPackingFeeRecordsSchema();
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(containerPackingFeeRecords)
      .orderBy(
        desc(containerPackingFeeRecords.publishedAt),
        desc(containerPackingFeeRecords.updatedAt),
      );
    return rows
      .map(mapRecord)
      .filter((row): row is ContainerPackingFeeRecord => row != null);
  } catch (e) {
    if (isMissingContainerPackingFeeRecordsTableError(e)) return [];
    throw e;
  }
}

export async function listPublishedContainerPackingFeeRecords(): Promise<
  ContainerPackingFeeRecord[]
> {
  await ensureContainerPackingFeeRecordsSchema();
  const db = getDb();
  try {
    const rows = await db
      .select()
      .from(containerPackingFeeRecords)
      .where(isNotNull(containerPackingFeeRecords.publishedAt))
      .orderBy(desc(containerPackingFeeRecords.updatedAt));
    return rows
      .map(mapRecord)
      .filter((row): row is ContainerPackingFeeRecord => row != null);
  } catch (e) {
    if (isMissingContainerPackingFeeRecordsTableError(e)) return [];
    throw e;
  }
}

export function applyPackingFeeRecordsToRates(
  base: ContainerPackingRates,
  records: readonly ContainerPackingFeeRecord[],
): ContainerPackingRates {
  const next: ContainerPackingRates = {
    ...base,
    cargoBoxRates: { ...(base.cargoBoxRates ?? {}) },
  };
  for (const row of records) {
    if (row.containerKind === "barrel") {
      next.singleBarrelPackingFeeCents = row.singleFeeCents;
      next.multiBarrelPackingPerUnitCents = row.multiFeeCents;
    } else if (row.containerKind === "bin") {
      next.singleBinPackingFeeCents = row.singleFeeCents;
      next.multiBinPackingPerUnitCents = row.multiFeeCents;
    } else if (row.cargoBoxSize) {
      next.cargoBoxRates = {
        ...next.cargoBoxRates,
        [row.cargoBoxSize]: {
          singlePackingFeeCents: row.singleFeeCents,
          multiPackingPerUnitCents: row.multiFeeCents,
        },
      };
    }
  }
  return next;
}

async function syncSingletonFromBarrelBin(input: {
  containerKind: "barrel" | "bin";
  singleFeeCents: number;
  multiFeeCents: number;
}): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select({ k: merchantPackingFeeSettings.singletonKey })
    .from(merchantPackingFeeSettings)
    .where(eq(merchantPackingFeeSettings.singletonKey, "default"))
    .limit(1);
  const patch =
    input.containerKind === "barrel" ?
      {
        barrelShippingFeeCents: input.singleFeeCents,
        multiBarrelPackingPerUnitCents: input.multiFeeCents,
        updatedAt: new Date().toISOString(),
      }
    : {
        binShippingFeeCents: input.singleFeeCents,
        multiBinPackingPerUnitCents: input.multiFeeCents,
        updatedAt: new Date().toISOString(),
      };
  if (existing) {
    await db
      .update(merchantPackingFeeSettings)
      .set(patch)
      .where(eq(merchantPackingFeeSettings.singletonKey, "default"));
    return;
  }
  await db.insert(merchantPackingFeeSettings).values({
    singletonKey: "default",
    packingFeePerLineCents: 0,
    barrelShippingFeeCents:
      input.containerKind === "barrel" ? input.singleFeeCents : 10_000,
    multiBarrelPackingPerUnitCents:
      input.containerKind === "barrel" ? input.multiFeeCents : 8_000,
    binShippingFeeCents:
      input.containerKind === "bin" ? input.singleFeeCents : 5_500,
    multiBinPackingPerUnitCents:
      input.containerKind === "bin" ? input.multiFeeCents : 4_500,
  });
}

export async function createContainerPackingFeeRecord(input: {
  containerKind: "barrel" | "bin" | "cargo_box";
  cargoBoxSize?: CargoBoxPackingSize | null;
  singleFeeCents: number;
  multiFeeCents: number;
}): Promise<
  | { ok: true; id: string }
  | { ok: false; message: string }
> {
  await ensureContainerPackingFeeRecordsSchema();
  const db = getDb();
  const cargoBoxSize =
    input.containerKind === "cargo_box" ? sizeKey(input.cargoBoxSize) : "";
  if (input.containerKind === "cargo_box" && !cargoBoxSize) {
    return { ok: false, message: "Select cargo box size E, EH, or D." };
  }
  try {
    const [existing] = await db
      .select({ id: containerPackingFeeRecords.id })
      .from(containerPackingFeeRecords)
      .where(
        and(
          eq(containerPackingFeeRecords.containerKind, input.containerKind),
          eq(containerPackingFeeRecords.cargoBoxSize, cargoBoxSize),
        ),
      )
      .limit(1);
    if (existing) {
      return {
        ok: false,
        message:
          "A packing fee for this container type already exists. Edit that record.",
      };
    }
    const [row] = await db
      .insert(containerPackingFeeRecords)
      .values({
        containerKind: input.containerKind,
        cargoBoxSize,
        singleFeeCents: input.singleFeeCents,
        multiFeeCents: input.multiFeeCents,
        publishedAt: null,
        updatedAt: new Date().toISOString(),
      })
      .returning({ id: containerPackingFeeRecords.id });
    if (!row) {
      return { ok: false, message: "Could not save packing fee." };
    }
    if (input.containerKind === "barrel" || input.containerKind === "bin") {
      await syncSingletonFromBarrelBin({
        containerKind: input.containerKind,
        singleFeeCents: input.singleFeeCents,
        multiFeeCents: input.multiFeeCents,
      });
    }
    return { ok: true, id: row.id };
  } catch (e) {
    if (isMissingContainerPackingFeeRecordsTableError(e)) {
      return { ok: false, message: "Could not create packing fee yet." };
    }
    const msg = e instanceof Error ? e.message : "";
    if (msg.toLowerCase().includes("unique") || msg.includes("23505")) {
      return {
        ok: false,
        message:
          "A packing fee for this container type already exists. Edit that record.",
      };
    }
    throw e;
  }
}

export async function updateContainerPackingFeeRecord(input: {
  id: string;
  singleFeeCents: number;
  multiFeeCents: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureContainerPackingFeeRecordsSchema();
  const db = getDb();
  try {
    const [row] = await db
      .select()
      .from(containerPackingFeeRecords)
      .where(eq(containerPackingFeeRecords.id, input.id))
      .limit(1);
    if (!row) return { ok: false, message: "Packing fee not found." };
    await db
      .update(containerPackingFeeRecords)
      .set({
        singleFeeCents: input.singleFeeCents,
        multiFeeCents: input.multiFeeCents,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(containerPackingFeeRecords.id, input.id));
    const kind = packingKind(row.containerKind);
    if (kind === "barrel" || kind === "bin") {
      await syncSingletonFromBarrelBin({
        containerKind: kind,
        singleFeeCents: input.singleFeeCents,
        multiFeeCents: input.multiFeeCents,
      });
    }
    return { ok: true };
  } catch (e) {
    if (isMissingContainerPackingFeeRecordsTableError(e)) {
      return { ok: false, message: "Could not update packing fee yet." };
    }
    throw e;
  }
}

export async function setContainerPackingFeePublished(input: {
  id: string;
  published: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureContainerPackingFeeRecordsSchema();
  const db = getDb();
  try {
    const [row] = await db
      .select({ id: containerPackingFeeRecords.id })
      .from(containerPackingFeeRecords)
      .where(eq(containerPackingFeeRecords.id, input.id))
      .limit(1);
    if (!row) return { ok: false, message: "Packing fee not found." };
    await db
      .update(containerPackingFeeRecords)
      .set({
        publishedAt: input.published ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(containerPackingFeeRecords.id, input.id));
    return { ok: true };
  } catch (e) {
    if (isMissingContainerPackingFeeRecordsTableError(e)) {
      return { ok: false, message: "Could not update publish state yet." };
    }
    throw e;
  }
}

export async function deleteContainerPackingFeeRecord(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureContainerPackingFeeRecordsSchema();
  const db = getDb();
  try {
    const deleted = await db
      .delete(containerPackingFeeRecords)
      .where(eq(containerPackingFeeRecords.id, id))
      .returning({ id: containerPackingFeeRecords.id });
    if (deleted.length === 0) {
      return { ok: false, message: "Packing fee not found." };
    }
    return { ok: true };
  } catch (e) {
    if (isMissingContainerPackingFeeRecordsTableError(e)) {
      return { ok: false, message: "Could not delete packing fee yet." };
    }
    throw e;
  }
}
