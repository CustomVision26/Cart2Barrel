import "server-only";

import { and, asc, eq, inArray, isNull, notInArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  barrelOutboundShippingChargeLines,
  barrelOutboundShippingCharges,
  barrelOutboundShippingPartners,
  barrels,
  outboundShippingCompanyRateLinks,
} from "@/db/schema";
import { ensureOutboundShippingCompanyRateLinksTable } from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import {
  addOutboundShippingPartner,
  getPrimaryOutboundShippingPartner,
} from "@/data/barrel-outbound-shipping-partners";
import type { BarrelOutboundShippingChargeKind } from "@/lib/barrel-outbound-shipping-charge";
import {
  isBarrelOutboundShippingChargeKind,
  outboundShippingCompanyKey,
  parseOutboundCompanyRateKinds,
  serializeOutboundCompanyRateKinds,
} from "@/lib/barrel-outbound-shipping-charge";
import { isMissingBarrelOutboundShippingChargesTableError } from "@/lib/db-column-missing";

export type OutboundShippingCompanyRateLinkRow = {
  clerkUserId: string;
  companyKey: string;
  chargeKind: BarrelOutboundShippingChargeKind;
  barrelId: string;
};

export type CompanyRateLinkGroup = {
  companyKey: string;
  chargeKind: BarrelOutboundShippingChargeKind;
  barrelIds: string[];
};

export async function listOutboundShippingCompanyRateLinksForUser(
  clerkUserId: string,
): Promise<OutboundShippingCompanyRateLinkRow[]> {
  try {
    await ensureOutboundShippingCompanyRateLinksTable();
  } catch (e) {
    console.error("[listOutboundShippingCompanyRateLinksForUser] ensure", e);
    return [];
  }
  const db = getDb();
  try {
    const rows = await db
      .select({
        clerkUserId: outboundShippingCompanyRateLinks.clerkUserId,
        companyKey: outboundShippingCompanyRateLinks.companyKey,
        chargeKind: outboundShippingCompanyRateLinks.chargeKind,
        barrelId: outboundShippingCompanyRateLinks.barrelId,
      })
      .from(outboundShippingCompanyRateLinks)
      .where(eq(outboundShippingCompanyRateLinks.clerkUserId, clerkUserId));
    return rows.filter((row) =>
      isBarrelOutboundShippingChargeKind(row.chargeKind),
    ) as OutboundShippingCompanyRateLinkRow[];
  } catch (e) {
    if (isMissingBarrelOutboundShippingChargesTableError(e)) {
      return [];
    }
    throw e;
  }
}

export function groupCompanyRateLinks(
  rows: readonly OutboundShippingCompanyRateLinkRow[],
): CompanyRateLinkGroup[] {
  const map = new Map<string, CompanyRateLinkGroup>();
  for (const row of rows) {
    const key = `${row.companyKey}::${row.chargeKind}`;
    const group = map.get(key);
    if (group) {
      if (!group.barrelIds.includes(row.barrelId)) {
        group.barrelIds.push(row.barrelId);
      }
    } else {
      map.set(key, {
        companyKey: row.companyKey,
        chargeKind: row.chargeKind,
        barrelIds: [row.barrelId],
      });
    }
  }
  return [...map.values()];
}

export function linkedBarrelIdsForCompanyKind(
  groups: readonly CompanyRateLinkGroup[],
  companyKey: string,
  chargeKind: BarrelOutboundShippingChargeKind,
): string[] {
  return (
    groups.find(
      (group) =>
        group.companyKey === companyKey && group.chargeKind === chargeKind,
    )?.barrelIds ?? []
  );
}

export async function linkedUnpaidBarrelIdsForCompanyKind(input: {
  clerkUserId: string;
  companyKey: string;
  chargeKind: BarrelOutboundShippingChargeKind;
}): Promise<string[]> {
  const companyKey = outboundShippingCompanyKey(input.companyKey);
  if (!companyKey) return [];
  const links = await listOutboundShippingCompanyRateLinksForUser(
    input.clerkUserId,
  );
  const linkedIds = [
    ...new Set(
      links
        .filter(
          (row) =>
            row.companyKey === companyKey && row.chargeKind === input.chargeKind,
        )
        .map((row) => row.barrelId),
    ),
  ];
  if (linkedIds.length < 2) return [];
  return unpaidBarrelIdsForKind(
    input.clerkUserId,
    linkedIds,
    input.chargeKind,
  );
}

async function unpaidBarrelIdsForKind(
  clerkUserId: string,
  barrelIds: string[],
  chargeKind: BarrelOutboundShippingChargeKind,
): Promise<string[]> {
  if (barrelIds.length === 0) return [];
  const db = getDb();
  const charges = await db
    .select({
      barrelId: barrelOutboundShippingCharges.barrelId,
      paidAt: barrelOutboundShippingCharges.paidAt,
    })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, clerkUserId),
        eq(barrelOutboundShippingCharges.chargeKind, chargeKind),
        inArray(barrelOutboundShippingCharges.barrelId, barrelIds),
      ),
    );
  const paid = new Set(
    charges.filter((row) => row.paidAt).map((row) => row.barrelId),
  );
  return barrelIds.filter((id) => !paid.has(id));
}

export function rateCardContainerCount(linkedUnpaidBarrelIds: string[]): number {
  return linkedUnpaidBarrelIds.length >= 2 ? linkedUnpaidBarrelIds.length : 1;
}

export async function expandChargeIdsWithCompanyRateLinks(input: {
  clerkUserId: string;
  chargeIds: string[];
}): Promise<string[]> {
  if (input.chargeIds.length === 0) return [];
  const db = getDb();
  const charges = await db
    .select({
      id: barrelOutboundShippingCharges.id,
      barrelId: barrelOutboundShippingCharges.barrelId,
      chargeKind: barrelOutboundShippingCharges.chargeKind,
      partnerName: barrelOutboundShippingCharges.partnerName,
      paidAt: barrelOutboundShippingCharges.paidAt,
    })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, input.clerkUserId),
        inArray(barrelOutboundShippingCharges.id, input.chargeIds),
      ),
    );
  const extraIds = new Set(input.chargeIds);
  for (const charge of charges) {
    if (!isBarrelOutboundShippingChargeKind(charge.chargeKind)) continue;
    const companyKey = outboundShippingCompanyKey(charge.partnerName ?? "");
    if (!companyKey) continue;
    const linkedUnpaid = await linkedUnpaidBarrelIdsForCompanyKind({
      clerkUserId: input.clerkUserId,
      companyKey,
      chargeKind: charge.chargeKind,
    });
    if (linkedUnpaid.length < 2) continue;
    const siblings = await db
      .select({
        id: barrelOutboundShippingCharges.id,
        paidAt: barrelOutboundShippingCharges.paidAt,
      })
      .from(barrelOutboundShippingCharges)
      .where(
        and(
          eq(barrelOutboundShippingCharges.clerkUserId, input.clerkUserId),
          eq(barrelOutboundShippingCharges.chargeKind, charge.chargeKind),
          inArray(barrelOutboundShippingCharges.barrelId, linkedUnpaid),
        ),
      );
    for (const sibling of siblings) {
      if (!sibling.paidAt) extraIds.add(sibling.id);
    }
  }
  return [...extraIds];
}

async function applyCompanyRateCardToLinkedBarrels(input: {
  sourceBarrelId: string;
  clerkUserId: string;
  kinds: BarrelOutboundShippingChargeKind[];
  linkedBarrelIds: string[];
}): Promise<void> {
  const db = getDb();

  for (const kind of input.kinds) {
    const partner = await getPrimaryOutboundShippingPartner(
      input.sourceBarrelId,
      kind,
    );
    const [sourceCharge] = await db
      .select()
      .from(barrelOutboundShippingCharges)
      .where(
        and(
          eq(barrelOutboundShippingCharges.barrelId, input.sourceBarrelId),
          eq(barrelOutboundShippingCharges.chargeKind, kind),
        ),
      )
      .limit(1);
    const sourceLines =
      sourceCharge ?
        await db
          .select({
            label: barrelOutboundShippingChargeLines.label,
            amountCents: barrelOutboundShippingChargeLines.amountCents,
            sortIndex: barrelOutboundShippingChargeLines.sortIndex,
          })
          .from(barrelOutboundShippingChargeLines)
          .where(
            eq(barrelOutboundShippingChargeLines.chargeId, sourceCharge.id),
          )
          .orderBy(asc(barrelOutboundShippingChargeLines.sortIndex))
      : [];

    for (const destBarrelId of input.linkedBarrelIds) {
      if (destBarrelId === input.sourceBarrelId) continue;

      if (partner?.name.trim()) {
        await addOutboundShippingPartner({
          barrelId: destBarrelId,
          chargeKind: kind,
          name: partner.name,
          location: partner.location,
          address: partner.address,
          country: partner.country,
          phone: partner.phone,
          cashappId: partner.cashappId,
          cashappAccount: partner.cashappAccount,
          zelleId: partner.zelleId,
          zelleAccount: partner.zelleAccount,
          imageUrl: partner.imageUrl,
          isPrimary: true,
        });
      }

      const [existingCharge] = await db
        .select({ id: barrelOutboundShippingCharges.id })
        .from(barrelOutboundShippingCharges)
        .where(
          and(
            eq(barrelOutboundShippingCharges.barrelId, destBarrelId),
            eq(barrelOutboundShippingCharges.chargeKind, kind),
          ),
        )
        .limit(1);
      if (!existingCharge && (sourceCharge || partner?.name.trim())) {
        const [inserted] = await db
          .insert(barrelOutboundShippingCharges)
          .values({
            barrelId: destBarrelId,
            clerkUserId: input.clerkUserId,
            chargeKind: kind,
            partnerName: partner?.name ?? sourceCharge?.partnerName ?? null,
            partnerLocation:
              partner?.location ?? sourceCharge?.partnerLocation ?? null,
            partnerAddress:
              partner?.address ?? sourceCharge?.partnerAddress ?? null,
            partnerCountry:
              partner?.country ?? sourceCharge?.partnerCountry ?? null,
            partnerPhone: partner?.phone ?? sourceCharge?.partnerPhone ?? null,
            partnerCashappId:
              partner?.cashappId ?? sourceCharge?.partnerCashappId ?? null,
            partnerCashappAccount:
              partner?.cashappAccount ??
              sourceCharge?.partnerCashappAccount ??
              null,
            partnerZelleId:
              partner?.zelleId ?? sourceCharge?.partnerZelleId ?? null,
            partnerZelleAccount:
              partner?.zelleAccount ?? sourceCharge?.partnerZelleAccount ?? null,
            adminNote: sourceCharge?.adminNote ?? null,
            recordedByClerkUserId: sourceCharge?.recordedByClerkUserId ?? null,
          })
          .onConflictDoNothing({
            target: [
              barrelOutboundShippingCharges.barrelId,
              barrelOutboundShippingCharges.chargeKind,
            ],
          })
          .returning({ id: barrelOutboundShippingCharges.id });
        if (inserted?.id && sourceLines.length > 0) {
          await db.insert(barrelOutboundShippingChargeLines).values(
            sourceLines.map((line) => ({
              chargeId: inserted.id,
              label: line.label,
              amountCents: line.amountCents,
              sortIndex: line.sortIndex,
            })),
          );
        }
      }

      const [destBarrel] = await db
        .select({
          outboundCompanyRateKinds: barrels.outboundCompanyRateKinds,
        })
        .from(barrels)
        .where(eq(barrels.id, destBarrelId))
        .limit(1);
      const destKinds = parseOutboundCompanyRateKinds(
        destBarrel?.outboundCompanyRateKinds,
      );
      if (!destKinds.includes(kind)) {
        await db
          .update(barrels)
          .set({
            outboundCompanyRateKinds: serializeOutboundCompanyRateKinds([
              ...destKinds,
              kind,
            ]),
          })
          .where(eq(barrels.id, destBarrelId));
      }
    }
  }
}

export async function setOutboundShippingCompanyRateLinks(input: {
  sourceBarrelId: string;
  companyName: string;
  kinds: BarrelOutboundShippingChargeKind[];
  linkedBarrelIds: string[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureOutboundShippingCompanyRateLinksTable();
  const companyKey = outboundShippingCompanyKey(input.companyName);
  if (!companyKey) {
    return { ok: false, message: "Add a company first." };
  }
  const kinds = [
    ...new Set(input.kinds.filter(isBarrelOutboundShippingChargeKind)),
  ];
  if (kinds.length === 0) {
    return { ok: false, message: "Choose a charge type to link." };
  }

  const db = getDb();
  const [source] = await db
    .select({
      id: barrels.id,
      clerkUserId: barrels.clerkUserId,
      status: barrels.status,
    })
    .from(barrels)
    .where(eq(barrels.id, input.sourceBarrelId))
    .limit(1);
  if (!source) {
    return { ok: false, message: "Container not found." };
  }

  const requested = [
    ...new Set([input.sourceBarrelId, ...input.linkedBarrelIds]),
  ];
  const candidates = await db
    .select({
      id: barrels.id,
      clerkUserId: barrels.clerkUserId,
      status: barrels.status,
    })
    .from(barrels)
    .where(
      and(
        eq(barrels.clerkUserId, source.clerkUserId),
        inArray(barrels.id, requested),
        notInArray(barrels.status, ["shipped", "delivered"]),
      ),
    );
  if (candidates.length !== requested.length) {
    return {
      ok: false,
      message: "Only this customer's unpaid active containers can be linked.",
    };
  }

  const partnerRows =
    requested.length > 0
      ? await db
          .select({
            barrelId: barrelOutboundShippingPartners.barrelId,
            chargeKind: barrelOutboundShippingPartners.chargeKind,
            name: barrelOutboundShippingPartners.name,
            isPrimary: barrelOutboundShippingPartners.isPrimary,
          })
          .from(barrelOutboundShippingPartners)
          .where(
            and(
              inArray(barrelOutboundShippingPartners.barrelId, requested),
              inArray(barrelOutboundShippingPartners.chargeKind, kinds),
            ),
          )
      : [];
  const chargeRows =
    requested.length > 0
      ? await db
          .select({
            barrelId: barrelOutboundShippingCharges.barrelId,
            chargeKind: barrelOutboundShippingCharges.chargeKind,
            partnerName: barrelOutboundShippingCharges.partnerName,
            paidAt: barrelOutboundShippingCharges.paidAt,
          })
          .from(barrelOutboundShippingCharges)
          .where(
            and(
              eq(barrelOutboundShippingCharges.clerkUserId, source.clerkUserId),
              inArray(barrelOutboundShippingCharges.barrelId, requested),
              inArray(barrelOutboundShippingCharges.chargeKind, kinds),
            ),
          )
      : [];

  for (const kind of kinds) {
    for (const barrel of candidates) {
      const paid = chargeRows.some(
        (row) =>
          row.barrelId === barrel.id &&
          row.chargeKind === kind &&
          Boolean(row.paidAt),
      );
      if (paid) {
        return {
          ok: false,
          message:
            "Paid containers cannot be linked. Uncheck any container that already has this charge paid.",
        };
      }
    }
  }

  for (const barrel of candidates) {
    const canJoin = kinds.every((kind) => {
      const chargeName = chargeRows.find(
        (row) => row.barrelId === barrel.id && row.chargeKind === kind,
      )?.partnerName;
      const partners = partnerRows.filter(
        (row) => row.barrelId === barrel.id && row.chargeKind === kind,
      );
      const primary =
        partners.find((row) => row.isPrimary) ?? partners[0] ?? null;
      const assigned = outboundShippingCompanyKey(
        chargeName?.trim() || primary?.name || "",
      );
      return !assigned || assigned === companyKey;
    });
    if (!canJoin) {
      return {
        ok: false,
        message:
          "Link only unpaid containers that use this company, or that do not have a company for this charge yet.",
      };
    }
  }

  const uniqueLinked = requested.filter((id) =>
    candidates.some((barrel) => barrel.id === id),
  );

  try {
    for (const kind of kinds) {
      await db
        .delete(outboundShippingCompanyRateLinks)
        .where(
          and(
            eq(outboundShippingCompanyRateLinks.clerkUserId, source.clerkUserId),
            eq(outboundShippingCompanyRateLinks.companyKey, companyKey),
            eq(outboundShippingCompanyRateLinks.chargeKind, kind),
          ),
        );
      if (uniqueLinked.length < 2) continue;
      await db.insert(outboundShippingCompanyRateLinks).values(
        uniqueLinked.map((barrelId) => ({
          clerkUserId: source.clerkUserId,
          companyKey,
          chargeKind: kind,
          barrelId,
        })),
      );
    }
    if (uniqueLinked.length >= 2) {
      await applyCompanyRateCardToLinkedBarrels({
        sourceBarrelId: source.id,
        clerkUserId: source.clerkUserId,
        kinds,
        linkedBarrelIds: uniqueLinked,
      });
    }
  } catch (e) {
    if (isMissingBarrelOutboundShippingChargesTableError(e)) {
      return { ok: false, message: "Could not save container links yet." };
    }
    throw e;
  }

  return { ok: true };
}

export async function companyKeysByBarrelKind(input: {
  clerkUserId: string;
  barrelIds: string[];
  chargeKind: BarrelOutboundShippingChargeKind;
}): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (input.barrelIds.length === 0) return result;
  const db = getDb();
  const charges = await db
    .select({
      barrelId: barrelOutboundShippingCharges.barrelId,
      partnerName: barrelOutboundShippingCharges.partnerName,
    })
    .from(barrelOutboundShippingCharges)
    .where(
      and(
        eq(barrelOutboundShippingCharges.clerkUserId, input.clerkUserId),
        eq(barrelOutboundShippingCharges.chargeKind, input.chargeKind),
        inArray(barrelOutboundShippingCharges.barrelId, input.barrelIds),
        isNull(barrelOutboundShippingCharges.paidAt),
      ),
    );
  for (const charge of charges) {
    const key = outboundShippingCompanyKey(charge.partnerName ?? "");
    if (key) result.set(charge.barrelId, key);
  }
  return result;
}
