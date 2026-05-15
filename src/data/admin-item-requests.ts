import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { getDb } from "@/db";
import { itemQuotes, itemRequests, profiles } from "@/db/schema";
import {
  itemRequestsRowLegacySelect,
} from "@/data/item-requests";
import { isMissingBatchQuoteSessionIdColumnError } from "@/lib/db-column-missing";
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
  clerkUser: User | null
): Promise<AdminItemRequestWithUserRow[]> {
  if (!isClerkAdmin(clerkUser)) {
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

  try {
    const rows = await db
      .select({
        request: itemRequests,
        userFullName: profiles.fullName,
        userEmail: profiles.email,
      })
      .from(itemRequests)
      .innerJoin(profiles, eq(itemRequests.clerkUserId, profiles.clerkUserId))
      .orderBy(desc(itemRequests.createdAt));

    return hydrateQueueKinds(rows);
  } catch (e) {
    if (!isMissingBatchQuoteSessionIdColumnError(e)) throw e;
    const rows = await db
      .select({
        ...itemRequestsRowLegacySelect,
        userFullName: profiles.fullName,
        userEmail: profiles.email,
      })
      .from(itemRequests)
      .innerJoin(profiles, eq(itemRequests.clerkUserId, profiles.clerkUserId))
      .orderBy(desc(itemRequests.createdAt));

    return hydrateQueueKinds(
      rows.map((row) => ({
        request: {
          id: row.id,
          clerkUserId: row.clerkUserId,
          productUrl: row.productUrl,
          productName: row.productName,
          productSize: row.productSize,
          productColor: row.productColor,
          quantity: row.quantity,
          note: row.note,
          productImageUrl: row.productImageUrl,
          siteName: row.siteName,
          status: row.status,
          createdAt: row.createdAt,
          batchQuoteSessionId: null,
        },
        userFullName: row.userFullName,
        userEmail: row.userEmail,
      }))
    );
  }
}
