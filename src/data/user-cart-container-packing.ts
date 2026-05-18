import { eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  containerOfferings,
  userCartContainerPackingFees,
  userContainerCartLines,
} from "@/db/schema";
import {
  computeContainerPackingFeeBreakdown,
  withDefaultContainerPackingRates,
  type ContainerPackingFeeBreakdown,
  type ContainerPackingRates,
} from "@/lib/container-packing-fee";

export type AppliedCartContainerPackingFees = {
  clerkUserId: string;
  barrelCount: number;
  binCount: number;
  barrelPackingFeeCents: number;
  binPackingFeeCents: number;
  totalPackingFeeCents: number;
  updatedAt: string;
};

export async function getAppliedCartContainerPackingFees(
  clerkUserId: string,
): Promise<AppliedCartContainerPackingFees | null> {
  const db = getDb();
  try {
    const [row] = await db
      .select()
      .from(userCartContainerPackingFees)
      .where(eq(userCartContainerPackingFees.clerkUserId, clerkUserId))
      .limit(1);
    if (!row) return null;
    return {
      clerkUserId: row.clerkUserId,
      barrelCount: row.barrelCount,
      binCount: row.binCount,
      barrelPackingFeeCents: row.barrelPackingFeeCents,
      binPackingFeeCents: row.binPackingFeeCents,
      totalPackingFeeCents: row.totalPackingFeeCents,
      updatedAt: row.updatedAt,
    };
  } catch {
    return null;
  }
}

/** Sum barrel/bin quantities in container cart for many users. */
export async function getContainerCartCountsByUserIds(
  clerkUserIds: string[],
): Promise<Map<string, { barrelCount: number; binCount: number }>> {
  const out = new Map<string, { barrelCount: number; binCount: number }>();
  if (clerkUserIds.length === 0) return out;

  const db = getDb();
  try {
    const rows = await db
      .select({
        clerkUserId: userContainerCartLines.clerkUserId,
        quantity: userContainerCartLines.quantity,
        kind: containerOfferings.kind,
      })
      .from(userContainerCartLines)
      .innerJoin(
        containerOfferings,
        eq(userContainerCartLines.containerOfferingId, containerOfferings.id),
      )
      .where(inArray(userContainerCartLines.clerkUserId, clerkUserIds));

    for (const r of rows) {
      if (r.quantity <= 0) continue;
      const cur = out.get(r.clerkUserId) ?? { barrelCount: 0, binCount: 0 };
      if (r.kind === "barrel") cur.barrelCount += r.quantity;
      else if (r.kind === "bin") cur.binCount += r.quantity;
      out.set(r.clerkUserId, cur);
    }
  } catch {
    // table missing or join error
  }
  return out;
}

export async function upsertAppliedCartContainerPackingFees(params: {
  clerkUserId: string;
  breakdown: ContainerPackingFeeBreakdown;
  appliedByClerkUserId: string;
}): Promise<void> {
  const db = getDb();
  const b = params.breakdown;
  await db
    .insert(userCartContainerPackingFees)
    .values({
      clerkUserId: params.clerkUserId,
      barrelCount: b.barrelCount,
      binCount: b.binCount,
      barrelPackingFeeCents: b.barrelPackingFeeCents,
      binPackingFeeCents: b.binPackingFeeCents,
      totalPackingFeeCents: b.totalPackingFeeCents,
      appliedByClerkUserId: params.appliedByClerkUserId,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: userCartContainerPackingFees.clerkUserId,
      set: {
        barrelCount: b.barrelCount,
        binCount: b.binCount,
        barrelPackingFeeCents: b.barrelPackingFeeCents,
        binPackingFeeCents: b.binPackingFeeCents,
        totalPackingFeeCents: b.totalPackingFeeCents,
        appliedByClerkUserId: params.appliedByClerkUserId,
        updatedAt: sql`now()`,
      },
    });
}

/**
 * Packing breakdown for cart/checkout: uses staff-applied snapshot when cart counts
 * match; otherwise computes live from rates (customer package or global).
 */
export async function resolveContainerPackingForUserCart(
  clerkUserId: string,
  barrelCount: number,
  binCount: number,
  rates: ContainerPackingRates,
): Promise<ContainerPackingFeeBreakdown> {
  const effectiveRates = withDefaultContainerPackingRates(rates);
  const live = computeContainerPackingFeeBreakdown(
    barrelCount,
    binCount,
    effectiveRates,
  );
  const applied = await getAppliedCartContainerPackingFees(clerkUserId);
  if (
    applied &&
    applied.barrelCount === live.barrelCount &&
    applied.binCount === live.binCount &&
    (live.barrelCount > 0 || live.binCount > 0) &&
    applied.totalPackingFeeCents > 0
  ) {
    return {
      barrelCount: applied.barrelCount,
      binCount: applied.binCount,
      barrelPackingFeeCents: applied.barrelPackingFeeCents,
      binPackingFeeCents: applied.binPackingFeeCents,
      totalPackingFeeCents: applied.totalPackingFeeCents,
    };
  }
  return live;
}
