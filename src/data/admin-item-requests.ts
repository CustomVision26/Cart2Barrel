import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { getDb } from "@/db";
import { itemQuotes, itemRequests, profiles } from "@/db/schema";
import {
  itemRequestsRowLegacySelect,
  itemRequestsRowLegacySelectWithoutReceiptImage,
  itemRequestsRowSelectWithoutReceiptImage,
  mapItemRequestRowWithoutReceiptImage,
  mapLegacyItemRequestRow,
  runItemRequestSelectWithFallback,
} from "@/data/item-request-select-fallback";
import { isClerkAdmin } from "@/lib/is-clerk-admin";

import type { User } from "@clerk/nextjs/server";

export type AdminRequestQueueKind = "new" | "resend" | "quoted";

export type AdminItemRequestWithUserRow = {
  request: typeof itemRequests.$inferSelect;
  userFullName: string | null;
  userEmail: string | null;
  /** For active-queue rows: how this item appears to ops. */
  queueKind: AdminRequestQueueKind;
};

/**
 * All item requests with submitter profile (newest first).
 * Returns [] if the session user is not a Clerk admin.
 */
export async function listItemRequestsWithProfileForAdmin(
  clerkUser: User | null,
  isAdmin?: boolean,
): Promise<AdminItemRequestWithUserRow[]> {
  const admin = isAdmin ?? isClerkAdmin(clerkUser);
  if (!admin) {
    return [];
  }

  const db = getDb();

  async function hydrateQueueKinds(
    rows: Array<{
      request: (typeof itemRequests.$inferSelect);
      userFullName: string | null;
      userEmail: string | null;
    }>,
  ): Promise<AdminItemRequestWithUserRow[]> {
    const ids = rows.map((r) => r.request.id);
    const voidedRequestIds = new Set<string>();
    if (ids.length > 0) {
      const voidedRows = await db
        .select({ itemRequestId: itemQuotes.itemRequestId })
        .from(itemQuotes)
        .where(
          and(
            inArray(itemQuotes.itemRequestId, ids),
            isNotNull(itemQuotes.voidedAt)
          )
        );
      for (const v of voidedRows) {
        voidedRequestIds.add(v.itemRequestId);
      }
    }

    return rows.map((r) => {
      const queueKind: AdminRequestQueueKind =
        r.request.status === "quoted"
          ? "quoted"
          : voidedRequestIds.has(r.request.id)
            ? "resend"
            : "new";
      return {
        request: r.request,
        userFullName: r.userFullName,
        userEmail: r.userEmail,
        queueKind,
      };
    });
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
        .orderBy(desc(itemRequests.createdAt)),
    withoutReceiptImage: async () => {
      const legacyRows = await db
        .select({
          request: itemRequestsRowSelectWithoutReceiptImage,
          userFullName: profiles.fullName,
          userEmail: profiles.email,
        })
        .from(itemRequests)
        .innerJoin(profiles, eq(itemRequests.clerkUserId, profiles.clerkUserId))
        .orderBy(desc(itemRequests.createdAt));
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
        .orderBy(desc(itemRequests.createdAt));
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
        .orderBy(desc(itemRequests.createdAt));
      return legacyRows.map((row) => ({
        request: mapLegacyItemRequestRow(row),
        userFullName: row.userFullName,
        userEmail: row.userEmail,
      }));
    },
  });

  return hydrateQueueKinds(rows);
}
