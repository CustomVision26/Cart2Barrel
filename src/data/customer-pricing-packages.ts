import { clerkClient } from "@clerk/nextjs/server";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { getDb } from "@/db";
import {
  clerkPublicMetadataRole,
  isClerkStaffRole,
} from "@/lib/is-clerk-admin";
import {
  customerPricingPackages,
  profiles,
  userCartContainerPackingFees,
  type CustomerPricingPackage,
} from "@/db/schema";
import type { MerchantServiceTierRow } from "@/lib/admin-markup";
import { getContainerCartCountsByUserIds } from "@/data/user-cart-container-packing";
import {
  computeContainerPackingFeeBreakdown,
  DEFAULT_CONTAINER_PACKING_RATES,
  type ContainerPackingRates,
} from "@/lib/container-packing-fee";

export type CustomerPricingPackageSnapshot = {
  clerkUserId: string;
  label: string | null;
  packingFeePerLineCents: number;
  containerPackingRates: ContainerPackingRates;
  serviceTiers: MerchantServiceTierRow[] | null;
};

export type AdminProfileAccountKind = "admin" | "customer";

export type AdminProfilePickerRow = {
  clerkUserId: string;
  displayName: string;
  email: string | null;
  hasCustomPackage: boolean;
  accountKind: AdminProfileAccountKind;
};

const CLERK_USER_LOOKUP_CHUNK = 20;

async function staffClerkUserIdsFromClerk(
  clerkUserIds: string[],
): Promise<Set<string>> {
  const staff = new Set<string>();
  if (clerkUserIds.length === 0) {
    return staff;
  }

  try {
    const client = await clerkClient();
    for (let i = 0; i < clerkUserIds.length; i += CLERK_USER_LOOKUP_CHUNK) {
      const chunk = clerkUserIds.slice(i, i + CLERK_USER_LOOKUP_CHUNK);
      const results = await Promise.all(
        chunk.map(async (id) => {
          try {
            const user = await client.users.getUser(id);
            return { id, role: clerkPublicMetadataRole(user.publicMetadata) };
          } catch {
            return { id, role: undefined };
          }
        }),
      );
      for (const row of results) {
        if (isClerkStaffRole(row.role)) {
          staff.add(row.id);
        }
      }
    }
  } catch {
    return staff;
  }

  return staff;
}

export type CustomerPricingPackageListRow = {
  clerkUserId: string;
  displayName: string;
  email: string | null;
  label: string | null;
  packingFeePerLineCents: number;
  singleBarrelPackingFeeCents: number;
  multiBarrelPackingPerUnitCents: number;
  singleBinPackingFeeCents: number;
  multiBinPackingPerUnitCents: number;
  hasCustomServiceTiers: boolean;
  updatedAt: string;
  cartBarrelCount: number;
  cartBinCount: number;
  cartPackingPreviewCents: number;
  packingAppliedToCartAt: string | null;
  appliedCartPackingCents: number | null;
};

/** All saved per-customer packages for admin list view. */
export async function listCustomerPricingPackagesForAdmin(): Promise<
  CustomerPricingPackageListRow[]
> {
  const db = getDb();
  try {
    const rows = await db
      .select({
        pkg: customerPricingPackages,
        fullName: profiles.fullName,
        email: profiles.email,
      })
      .from(customerPricingPackages)
      .innerJoin(
        profiles,
        eq(customerPricingPackages.clerkUserId, profiles.clerkUserId),
      )
      .orderBy(desc(customerPricingPackages.updatedAt));

    const userIds = rows.map((r) => r.pkg.clerkUserId);
    const cartCounts = await getContainerCartCountsByUserIds(userIds);

    let appliedRows: {
      clerkUserId: string;
      totalPackingFeeCents: number;
      updatedAt: string;
      barrelCount: number;
      binCount: number;
    }[] = [];
    try {
      appliedRows = await db
        .select({
          clerkUserId: userCartContainerPackingFees.clerkUserId,
          totalPackingFeeCents: userCartContainerPackingFees.totalPackingFeeCents,
          updatedAt: userCartContainerPackingFees.updatedAt,
          barrelCount: userCartContainerPackingFees.barrelCount,
          binCount: userCartContainerPackingFees.binCount,
        })
        .from(userCartContainerPackingFees)
        .where(inArray(userCartContainerPackingFees.clerkUserId, userIds));
    } catch {
      appliedRows = [];
    }
    const appliedByUser = new Map(appliedRows.map((r) => [r.clerkUserId, r]));

    return rows.map(({ pkg, fullName, email }) => {
      const name = fullName?.trim();
      const emailTrim = email?.trim() || null;
      const tiers = pkg.serviceTiersJson;
      const rates = rowToContainerRates(pkg);
      const counts = cartCounts.get(pkg.clerkUserId) ?? {
        barrelCount: 0,
        binCount: 0,
      };
      const preview = computeContainerPackingFeeBreakdown(
        counts.barrelCount,
        counts.binCount,
        rates,
      );
      const applied = appliedByUser.get(pkg.clerkUserId);
      const countsMatchApplied =
        applied &&
        applied.barrelCount === counts.barrelCount &&
        applied.binCount === counts.binCount;
      return {
        clerkUserId: pkg.clerkUserId,
        displayName: name || emailTrim || pkg.clerkUserId,
        email: emailTrim,
        label: pkg.label?.trim() || null,
        packingFeePerLineCents: Math.max(0, pkg.packingFeePerLineCents),
        singleBarrelPackingFeeCents: Math.max(0, pkg.singleBarrelPackingFeeCents),
        multiBarrelPackingPerUnitCents: Math.max(
          0,
          pkg.multiBarrelPackingPerUnitCents,
        ),
        singleBinPackingFeeCents: Math.max(0, pkg.singleBinPackingFeeCents),
        multiBinPackingPerUnitCents: Math.max(0, pkg.multiBinPackingPerUnitCents),
        hasCustomServiceTiers: Array.isArray(tiers) && tiers.length > 0,
        updatedAt: pkg.updatedAt,
        cartBarrelCount: counts.barrelCount,
        cartBinCount: counts.binCount,
        cartPackingPreviewCents: preview.totalPackingFeeCents,
        packingAppliedToCartAt:
          countsMatchApplied ? applied.updatedAt : null,
        appliedCartPackingCents:
          countsMatchApplied ? applied.totalPackingFeeCents : null,
      };
    });
  } catch {
    return [];
  }
}

function rowToContainerRates(
  row: Pick<
    CustomerPricingPackage,
    | "singleBarrelPackingFeeCents"
    | "multiBarrelPackingPerUnitCents"
    | "singleBinPackingFeeCents"
    | "multiBinPackingPerUnitCents"
  >,
): ContainerPackingRates {
  return {
    singleBarrelPackingFeeCents: Math.max(0, row.singleBarrelPackingFeeCents),
    multiBarrelPackingPerUnitCents: Math.max(
      0,
      row.multiBarrelPackingPerUnitCents,
    ),
    singleBinPackingFeeCents: Math.max(0, row.singleBinPackingFeeCents),
    multiBinPackingPerUnitCents: Math.max(0, row.multiBinPackingPerUnitCents),
  };
}

function rowToSnapshot(row: CustomerPricingPackage): CustomerPricingPackageSnapshot {
  const tiers = row.serviceTiersJson;
  return {
    clerkUserId: row.clerkUserId,
    label: row.label?.trim() || null,
    packingFeePerLineCents: Math.max(0, row.packingFeePerLineCents),
    containerPackingRates: rowToContainerRates(row),
    serviceTiers:
      Array.isArray(tiers) && tiers.length > 0 ?
        tiers.map((t) => ({
          maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
          feePerUnitCents: t.feePerUnitCents,
        }))
      : null,
  };
}

export async function getCustomerPricingPackage(
  clerkUserId: string,
): Promise<CustomerPricingPackageSnapshot | null> {
  const db = getDb();
  try {
    const [row] = await db
      .select()
      .from(customerPricingPackages)
      .where(eq(customerPricingPackages.clerkUserId, clerkUserId))
      .limit(1);
    return row ? rowToSnapshot(row) : null;
  } catch {
    return null;
  }
}

async function listProfilesForAdminPickerUncached(): Promise<AdminProfilePickerRow[]> {
  const db = getDb();
  try {
    const rows = await db
      .select({
        clerkUserId: profiles.clerkUserId,
        fullName: profiles.fullName,
        email: profiles.email,
        packageUserId: customerPricingPackages.clerkUserId,
      })
      .from(profiles)
      .leftJoin(
        customerPricingPackages,
        eq(profiles.clerkUserId, customerPricingPackages.clerkUserId),
      )
      .orderBy(desc(profiles.updatedAt), asc(profiles.fullName));

    const mapped = rows.map((r) => {
      const name = r.fullName?.trim();
      const email = r.email?.trim() || null;
      const displayName = name || email || r.clerkUserId;
      return {
        clerkUserId: r.clerkUserId,
        displayName,
        email,
        hasCustomPackage: Boolean(r.packageUserId),
      };
    });
    return attachAccountKinds(mapped);
  } catch {
    const rows = await db
      .select({
        clerkUserId: profiles.clerkUserId,
        fullName: profiles.fullName,
        email: profiles.email,
      })
      .from(profiles)
      .orderBy(desc(profiles.updatedAt), asc(profiles.fullName));

    const mapped = rows.map((r) => {
      const name = r.fullName?.trim();
      const email = r.email?.trim() || null;
      return {
        clerkUserId: r.clerkUserId,
        displayName: name || email || r.clerkUserId,
        email,
        hasCustomPackage: false,
      };
    });
    return attachAccountKinds(mapped);
  }
}

/** Profiles for admin customer-package picker (newest activity first). Cached 5 min. */
export async function listProfilesForAdminPicker(): Promise<AdminProfilePickerRow[]> {
  return unstable_cache(
    listProfilesForAdminPickerUncached,
    ["admin-profile-picker"],
    { revalidate: 300, tags: ["admin-profile-picker"] },
  )();
}

async function attachAccountKinds(
  rows: Omit<AdminProfilePickerRow, "accountKind">[],
): Promise<AdminProfilePickerRow[]> {
  const staffIds = await staffClerkUserIdsFromClerk(
    rows.map((r) => r.clerkUserId),
  );
  return rows.map((r) => ({
    ...r,
    accountKind: staffIds.has(r.clerkUserId) ? "admin" : "customer",
  }));
}

export async function upsertCustomerPricingPackage(params: {
  clerkUserId: string;
  label: string | null;
  packingFeePerLineCents: number;
  containerPackingRates: ContainerPackingRates;
  serviceTiers: MerchantServiceTierRow[] | null;
  updatedByClerkUserId: string;
}): Promise<void> {
  const db = getDb();
  const r = params.containerPackingRates;
  const sortedTiers =
    params.serviceTiers ?
      [...params.serviceTiers].sort(
        (a, b) => a.maxUnitPriceInclusiveCents - b.maxUnitPriceInclusiveCents,
      )
    : null;

  await db
    .insert(customerPricingPackages)
    .values({
      clerkUserId: params.clerkUserId,
      label: params.label,
      packingFeePerLineCents: params.packingFeePerLineCents,
      singleBarrelPackingFeeCents: r.singleBarrelPackingFeeCents,
      multiBarrelPackingPerUnitCents: r.multiBarrelPackingPerUnitCents,
      singleBinPackingFeeCents: r.singleBinPackingFeeCents,
      multiBinPackingPerUnitCents: r.multiBinPackingPerUnitCents,
      serviceTiersJson: sortedTiers,
      updatedByClerkUserId: params.updatedByClerkUserId,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: customerPricingPackages.clerkUserId,
      set: {
        label: params.label,
        packingFeePerLineCents: params.packingFeePerLineCents,
        singleBarrelPackingFeeCents: r.singleBarrelPackingFeeCents,
        multiBarrelPackingPerUnitCents: r.multiBarrelPackingPerUnitCents,
        singleBinPackingFeeCents: r.singleBinPackingFeeCents,
        multiBinPackingPerUnitCents: r.multiBinPackingPerUnitCents,
        serviceTiersJson: sortedTiers,
        updatedByClerkUserId: params.updatedByClerkUserId,
        updatedAt: sql`now()`,
      },
    });
}

export async function deleteCustomerPricingPackage(
  clerkUserId: string,
): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(customerPricingPackages)
    .where(eq(customerPricingPackages.clerkUserId, clerkUserId))
    .returning({ clerkUserId: customerPricingPackages.clerkUserId });
  return deleted.length > 0;
}

export function customerPackageToContainerRates(
  pkg: CustomerPricingPackageSnapshot,
): ContainerPackingRates {
  return pkg.containerPackingRates ?? { ...DEFAULT_CONTAINER_PACKING_RATES };
}
