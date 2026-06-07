import { and, desc, eq, notInArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  itemRequests,
  profiles,
  type ItemRequest,
} from "@/db/schema";
import {
  itemRequestsRowLegacySelect,
  itemRequestsRowLegacySelectWithoutReceiptImage,
  itemRequestsRowSelectWithoutReceiptImage,
  mapItemRequestRowWithoutReceiptImage,
  mapLegacyItemRequestRow,
  runItemRequestSelectWithFallback,
} from "@/data/item-request-select-fallback";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";

export type OutsidePurchaseIntakeAdminRow = {
  request: ItemRequest;
  userFullName: string | null;
  userEmail: string | null;
};

export async function listOutsidePurchaseIntakesForAdmin(options?: {
  clerkUserId?: string | null;
  limit?: number;
}): Promise<OutsidePurchaseIntakeAdminRow[]> {
  const db = getDb();
  const limit = options?.limit ?? 100;

  const conditions = [
    eq(itemRequests.source, "outside_purchase"),
    notInArray(itemRequests.status, ["withdrawn", "rejected"]),
  ];
  if (options?.clerkUserId?.trim()) {
    conditions.push(eq(itemRequests.clerkUserId, options.clerkUserId.trim()));
  }

  const rows = await runItemRequestSelectWithFallback({
    full: () =>
      db
        .select({
          request: itemRequests,
          userFullName: profiles.fullName,
          userEmail: profiles.email,
        })
        .from(itemRequests)
        .innerJoin(profiles, eq(itemRequests.clerkUserId, profiles.clerkUserId))
        .where(and(...conditions))
        .orderBy(desc(itemRequests.createdAt))
        .limit(limit),
    withoutReceiptImage: async () => {
      const legacyRows = await db
        .select({
          request: itemRequestsRowSelectWithoutReceiptImage,
          userFullName: profiles.fullName,
          userEmail: profiles.email,
        })
        .from(itemRequests)
        .innerJoin(profiles, eq(itemRequests.clerkUserId, profiles.clerkUserId))
        .where(and(...conditions))
        .orderBy(desc(itemRequests.createdAt))
        .limit(limit);
      return legacyRows.map((row) => ({
        request: mapItemRequestRowWithoutReceiptImage(row.request),
        userFullName: row.userFullName,
        userEmail: row.userEmail,
      }));
    },
    legacy: async () => {
      const legacyRows = await db
        .select({
          ...itemRequestsRowLegacySelect,
          userFullName: profiles.fullName,
          userEmail: profiles.email,
        })
        .from(itemRequests)
        .innerJoin(profiles, eq(itemRequests.clerkUserId, profiles.clerkUserId))
        .where(and(...conditions))
        .orderBy(desc(itemRequests.createdAt))
        .limit(limit);
      return legacyRows.map((row) => ({
        request: mapLegacyItemRequestRow(row),
        userFullName: row.userFullName,
        userEmail: row.userEmail,
      }));
    },
    legacyWithoutReceiptImage: async () => {
      const legacyRows = await db
        .select({
          ...itemRequestsRowLegacySelectWithoutReceiptImage,
          userFullName: profiles.fullName,
          userEmail: profiles.email,
        })
        .from(itemRequests)
        .innerJoin(profiles, eq(itemRequests.clerkUserId, profiles.clerkUserId))
        .where(and(...conditions))
        .orderBy(desc(itemRequests.createdAt))
        .limit(limit);
      return legacyRows.map((row) => ({
        request: mapLegacyItemRequestRow(row),
        userFullName: row.userFullName,
        userEmail: row.userEmail,
      }));
    },
  });

  return rows.filter((r) => isOutsidePurchaseRequest(r.request));
}

export async function countOutsidePurchaseIntakesAwaitingPayment(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: itemRequests.id })
    .from(itemRequests)
    .where(
      and(
        eq(itemRequests.source, "outside_purchase"),
        eq(itemRequests.status, "quoted"),
      ),
    );
  return rows.filter((r) => r.id).length;
}
