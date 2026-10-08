import "server-only";

import { desc, isNotNull } from "drizzle-orm";

import { getDb } from "@/db";
import { barrelOutboundShippingPartners } from "@/db/schema";
import {
  ensureBarrelOutboundShippingChargesSchema,
  ensureOutboundPartnerPublicPricingColumn,
} from "@/data/ensure-barrel-outbound-shipping-charges-schema";
import { listOutboundShippingCompanyRates } from "@/data/outbound-shipping-company-rates";
import { isMissingBarrelOutboundShippingChargesTableError } from "@/lib/db-column-missing";
import {
  BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS,
  isBarrelOutboundShippingChargeKind,
  outboundShippingCompanyKey,
  outboundShippingPartnerOfferingKey,
  outboundShippingRateMatchesOffering,
  outboundShippingRateTableKindsForTabs,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  publicCompanyServiceLabel,
  publicCompanyVendorHeadings,
  type PublicOutboundCompanyPricingCard,
} from "@/lib/public-outbound-company-pricing";

export type { PublicOutboundCompanyPricingCard };

function pickDisplayPartner<
  T extends {
    barrelId: string | null;
    isPrimary: boolean;
    imageUrl: string | null;
    publicPricingPublishedAt: string | null;
  },
>(rows: T[]): T {
  return [...rows].sort((a, b) => {
    const catalog = Number(a.barrelId != null) - Number(b.barrelId != null);
    if (catalog !== 0) return catalog;
    const primary = Number(b.isPrimary) - Number(a.isPrimary);
    if (primary !== 0) return primary;
    const image =
      Number(Boolean(b.imageUrl?.trim())) - Number(Boolean(a.imageUrl?.trim()));
    if (image !== 0) return image;
    return (b.publicPricingPublishedAt ?? "").localeCompare(
      a.publicPricingPublishedAt ?? "",
    );
  })[0]!;
}

/** Public How it works pricing cards. Intentionally unauthenticated. */
export async function listPublicOutboundCompanyPricing(): Promise<
  PublicOutboundCompanyPricingCard[]
> {
  await ensureBarrelOutboundShippingChargesSchema();
  await ensureOutboundPartnerPublicPricingColumn();
  const db = getDb();
  let partners: (typeof barrelOutboundShippingPartners.$inferSelect)[] = [];
  try {
    partners = await db
      .select()
      .from(barrelOutboundShippingPartners)
      .where(isNotNull(barrelOutboundShippingPartners.publicPricingPublishedAt))
      .orderBy(desc(barrelOutboundShippingPartners.publicPricingPublishedAt));
  } catch (e) {
    if (isMissingBarrelOutboundShippingChargesTableError(e)) {
      return [];
    }
    throw e;
  }

  const rates = await listOutboundShippingCompanyRates().catch(() => []);
  const grouped = new Map<string, typeof partners>();
  for (const row of partners) {
    const key = outboundShippingPartnerOfferingKey(row.name, row.country);
    if (!outboundShippingCompanyKey(row.name)) continue;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const cards: PublicOutboundCompanyPricingCard[] = [];
  for (const [companyKey, rows] of grouped) {
    const display = pickDisplayPartner(rows);
    const customerNote =
      rows
        .map((row) => row.customerNote?.trim())
        .find((note) => Boolean(note)) || null;
    const publishedKinds = new Set(
      rows
        .map((row) => row.chargeKind)
        .filter(isBarrelOutboundShippingChargeKind),
    );
    const kinds = BARREL_OUTBOUND_SHIPPING_CHARGE_KINDS.filter((kind) =>
      publishedKinds.has(kind),
    );
    if (kinds.length === 0) continue;
    const headings = publicCompanyVendorHeadings(kinds);
    if (headings.length === 0) continue;
    const tableKinds = outboundShippingRateTableKindsForTabs(kinds);
    const companyRates = rates.filter((row) =>
      outboundShippingRateMatchesOffering(
        row,
        display.name,
        display.country,
      ),
    );
    const rateTables = tableKinds
      .map((tableKind) => ({
        tableKind,
        rows: companyRates
          .filter(
            (row) =>
              row.tableKind === tableKind && row.tableKind !== "transport",
          )
          .map((row) => ({
            rowLabel: row.rowLabel,
            destination: row.destination,
            costOneCents: row.costOneCents,
            costTwoPlusCents: row.costTwoPlusCents,
          })),
      }))
      .filter((table) => table.rows.length > 0);
    const pickupRates = companyRates
      .filter((row) => row.tableKind === "transport")
      .map((row) => ({
        rowLabel: row.rowLabel,
        costOneCents: row.costOneCents,
        costTwoPlusCents: row.costTwoPlusCents,
      }));

    cards.push({
      companyKey,
      companyName: display.name.trim(),
      heading: headings[0]!,
      serviceLabel: publicCompanyServiceLabel(kinds),
      kinds,
      country: display.country?.trim() || null,
      location: display.location?.trim() || null,
      address: display.address?.trim() || null,
      phone: display.phone?.trim() || null,
      imageUrl: display.imageUrl?.trim() || null,
      customerNote,
      rateTables,
      pickupRates,
    });
  }

  cards.sort((a, b) => {
    if (a.heading !== b.heading) return a.heading === "in-us" ? -1 : 1;
    const name = a.companyName.localeCompare(b.companyName);
    if (name !== 0) return name;
    return (a.country ?? "").localeCompare(b.country ?? "");
  });
  return cards;
}
