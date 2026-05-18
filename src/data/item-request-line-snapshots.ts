import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  itemRequests,
  itemRequestLineSnapshots,
  type ItemRequest,
  type ItemRequestLineSnapshot,
} from "@/db/schema";
import { isUndefinedColumnError } from "@/lib/db-column-missing";
import { isClerkAdmin } from "@/lib/is-clerk-admin";

import type { User } from "@clerk/nextjs/server";

/**
 * Columns when `batch_quote_session_id` / `audit_memo` are not migrated (`0012` not applied).
 */
const itemRequestLineSnapshotsLegacyNoBatchAudit = {
  id: itemRequestLineSnapshots.id,
  itemRequestId: itemRequestLineSnapshots.itemRequestId,
  itemQuoteId: itemRequestLineSnapshots.itemQuoteId,
  phase: itemRequestLineSnapshots.phase,
  productUrl: itemRequestLineSnapshots.productUrl,
  productName: itemRequestLineSnapshots.productName,
  productSize: itemRequestLineSnapshots.productSize,
  productColor: itemRequestLineSnapshots.productColor,
  quantity: itemRequestLineSnapshots.quantity,
  note: itemRequestLineSnapshots.note,
  productImageUrl: itemRequestLineSnapshots.productImageUrl,
  siteName: itemRequestLineSnapshots.siteName,
  createdAt: itemRequestLineSnapshots.createdAt,
} as const;

/** Columns before snapshots had `site_name` (`0008`). */
const itemRequestLineSnapshotsLegacyMinimal = {
  id: itemRequestLineSnapshots.id,
  itemRequestId: itemRequestLineSnapshots.itemRequestId,
  itemQuoteId: itemRequestLineSnapshots.itemQuoteId,
  phase: itemRequestLineSnapshots.phase,
  productUrl: itemRequestLineSnapshots.productUrl,
  productName: itemRequestLineSnapshots.productName,
  productSize: itemRequestLineSnapshots.productSize,
  productColor: itemRequestLineSnapshots.productColor,
  quantity: itemRequestLineSnapshots.quantity,
  note: itemRequestLineSnapshots.note,
  productImageUrl: itemRequestLineSnapshots.productImageUrl,
  createdAt: itemRequestLineSnapshots.createdAt,
} as const;

function isWideSnapshotLegacyColumnError(e: unknown): boolean {
  return (
    isUndefinedColumnError(e, "batch_quote_session_id") ||
    isUndefinedColumnError(e, "audit_memo")
  );
}

async function querySnapshotsRowsForRequestIdsOrdered(
  itemRequestDbIds: string[]
): Promise<ItemRequestLineSnapshot[]> {
  const db = getDb();
  try {
    return await db
      .select()
      .from(itemRequestLineSnapshots)
      .where(inArray(itemRequestLineSnapshots.itemRequestId, itemRequestDbIds))
      .orderBy(asc(itemRequestLineSnapshots.createdAt));
  } catch (e) {
    if (!isWideSnapshotLegacyColumnError(e)) throw e;
    try {
      const rows = await db
        .select(itemRequestLineSnapshotsLegacyNoBatchAudit)
        .from(itemRequestLineSnapshots)
        .where(inArray(itemRequestLineSnapshots.itemRequestId, itemRequestDbIds))
        .orderBy(asc(itemRequestLineSnapshots.createdAt));
      return rows.map((r) => ({
        ...r,
        batchQuoteSessionId: null,
        auditMemo: null,
      }));
    } catch (e2) {
      if (!isUndefinedColumnError(e2, "site_name")) throw e2;
      const rows = await db
        .select(itemRequestLineSnapshotsLegacyMinimal)
        .from(itemRequestLineSnapshots)
        .where(inArray(itemRequestLineSnapshots.itemRequestId, itemRequestDbIds))
        .orderBy(asc(itemRequestLineSnapshots.createdAt));
      return rows.map((r) => ({
        ...r,
        siteName: null,
        batchQuoteSessionId: null,
        auditMemo: null,
      }));
    }
  }
}

export type ItemRequestLineSnapshotPayload = Pick<
  ItemRequest,
  | "productUrl"
  | "productName"
  | "productSize"
  | "productColor"
  | "quantity"
  | "note"
  | "productImageUrl"
  | "siteName"
>;

export function lineSnapshotPayloadFromItemRequest(
  r: ItemRequestLineSnapshotPayload
): ItemRequestLineSnapshotPayload {
  return {
    productUrl: r.productUrl,
    productName: r.productName,
    productSize: r.productSize,
    productColor: r.productColor,
    quantity: r.quantity,
    note: r.note,
    productImageUrl: r.productImageUrl,
    siteName: r.siteName,
  };
}

export async function insertItemRequestLineSnapshot(params: {
  itemRequestId: string;
  phase: ItemRequestLineSnapshot["phase"];
  itemQuoteId?: string | null;
  batchQuoteSessionId?: string | null;
  auditMemo?: string | null;
  line: ItemRequestLineSnapshotPayload;
}): Promise<void> {
  const db = getDb();
  const line = params.line;
  await db.insert(itemRequestLineSnapshots).values({
    itemRequestId: params.itemRequestId,
    phase: params.phase,
    itemQuoteId: params.itemQuoteId ?? null,
    batchQuoteSessionId: params.batchQuoteSessionId ?? null,
    auditMemo: params.auditMemo ?? null,
    productUrl: line.productUrl,
    productName: line.productName,
    productSize: line.productSize,
    productColor: line.productColor,
    quantity: line.quantity,
    note: line.note,
    productImageUrl: line.productImageUrl,
    siteName: line.siteName,
  });
}

function isMissingLineSnapshotsRelationError(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const code = "code" in e ? String((e as { code: unknown }).code) : "";
  if (code === "42P01") return true;
  const message =
    "message" in e && typeof (e as { message: unknown }).message === "string"
      ? (e as { message: string }).message
      : e instanceof Error
        ? e.message
        : "";
  return (
    message.includes("item_request_line_snapshots") &&
    message.toLowerCase().includes("does not exist")
  );
}

/**
 * Audit rows for ops UI. Returns [] if the caller is not an admin or ids is empty.
 * If the snapshots table is missing (migrations not applied), returns [] so the admin
 * page still loads; check logs and run `drizzle-kit migrate` or `drizzle-kit push`.
 */
export async function listItemRequestLineSnapshotsByRequestIds(
  clerkUser: User | null,
  itemRequestIds: string[],
  isAdmin?: boolean,
): Promise<ItemRequestLineSnapshot[]> {
  const admin = isAdmin ?? isClerkAdmin(clerkUser);
  if (!admin || itemRequestIds.length === 0) {
    return [];
  }

  try {
    return await querySnapshotsRowsForRequestIdsOrdered(itemRequestIds);
  } catch (e) {
    if (isMissingLineSnapshotsRelationError(e)) {
      console.warn(
        "[Cart2Barrel] item_request_line_snapshots is missing. Apply DB schema (drizzle-kit migrate or push)."
      );
      return [];
    }
    throw e;
  }
}

export function groupItemRequestLineSnapshotsByRequestId(
  rows: ItemRequestLineSnapshot[]
): Map<string, ItemRequestLineSnapshot[]> {
  const map = new Map<string, ItemRequestLineSnapshot[]>();
  for (const row of rows) {
    const list = map.get(row.itemRequestId);
    if (list) list.push(row);
    else map.set(row.itemRequestId, [row]);
  }
  return map;
}

/**
 * Audit rows for the signed-in owner. Only snapshots whose item_request belongs to
 * `clerkUserId` are returned.
 */
export async function listItemRequestLineSnapshotsForOwnerByRequestIds(
  clerkUserId: string,
  itemRequestIds: string[]
): Promise<ItemRequestLineSnapshot[]> {
  if (itemRequestIds.length === 0) return [];

  try {
    const db = getDb();
    const owned = await db
      .select({ id: itemRequests.id })
      .from(itemRequests)
      .where(
        and(
          eq(itemRequests.clerkUserId, clerkUserId),
          inArray(itemRequests.id, itemRequestIds)
        )
      );
    const ids = owned.map((r) => r.id);
    if (ids.length === 0) return [];

    return await querySnapshotsRowsForRequestIdsOrdered(ids);
  } catch (e) {
    if (isMissingLineSnapshotsRelationError(e)) {
      console.warn(
        "[Cart2Barrel] item_request_line_snapshots is missing. Apply DB schema (drizzle-kit migrate or push)."
      );
      return [];
    }
    throw e;
  }
}
