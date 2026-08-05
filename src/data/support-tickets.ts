import "server-only";

import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  notInArray,
  or,
  sql,
} from "drizzle-orm";

import { getDb } from "@/db";
import {
  orderItemMerchandiseReconciliations,
  profiles,
  supportTicketMessages,
  supportTickets,
  type SupportTicket,
  type SupportTicketMessage,
  type SupportTicketStatus,
} from "@/db/schema";

import {
  normalizeSupportTicketImageUrls,
} from "@/lib/support-ticket-images";
import { normalizeSupportTicketProductLinks } from "@/lib/support-ticket-product-links";
import type {
  SupportInboxFilter,
  SupportInboxQueryInput,
} from "@/lib/support-inbox-params";

export type SupportTicketSummary = {
  id: string;
  subject: string;
  status: SupportTicketStatus;
  lastMessageAt: string;
  createdAt: string;
  messagePreview: string | null;
  unreadFromStaff: boolean;
  isRead: boolean;
  isRemoved: boolean;
};

export type SupportTicketMessageRow = {
  id: string;
  senderClerkUserId: string;
  isFromStaff: boolean;
  body: string;
  imageUrls: string[];
  productLinks: string[];
  createdAt: string;
};

export type SupportTicketDetail = {
  id: string;
  clerkUserId: string;
  subject: string;
  status: SupportTicketStatus;
  lastMessageAt: string;
  createdAt: string;
  messages: SupportTicketMessageRow[];
};

export type AdminSupportUserGroup = {
  clerkUserId: string;
  displayName: string;
  email: string | null;
  openTicketCount: number;
  tickets: SupportTicketSummary[];
};

function messagePreview(
  body: string,
  imageUrls?: string[] | null,
  productLinks?: string[] | null,
): string {
  const trimmed = body.trim();
  if (trimmed.length > 0) {
    if (trimmed.length <= 120) return trimmed;
    return `${trimmed.slice(0, 117)}…`;
  }
  const images = normalizeSupportTicketImageUrls(imageUrls);
  if (images.length > 0) {
    return images.length === 1 ? "[Image attachment]" : `[${images.length} images]`;
  }
  const links = normalizeSupportTicketProductLinks(productLinks);
  if (links.length > 0) {
    return links.length === 1 ? "[Product link]" : `[${links.length} product links]`;
  }
  return "";
}

function mapMessageRow(m: SupportTicketMessage): SupportTicketMessageRow {
  return {
    id: m.id,
    senderClerkUserId: m.senderClerkUserId,
    isFromStaff: m.isFromStaff,
    body: m.body,
    imageUrls: normalizeSupportTicketImageUrls(m.imageUrls),
    productLinks: normalizeSupportTicketProductLinks(m.productLinks),
    createdAt: m.createdAt,
  };
}

function generateTicketNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `C2B-${date}-${suffix}`;
}

async function latestMessageByTicketIds(
  ticketIds: string[],
): Promise<Map<string, SupportTicketMessage>> {
  if (ticketIds.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select()
    .from(supportTicketMessages)
    .where(inArray(supportTicketMessages.ticketId, ticketIds))
    .orderBy(desc(supportTicketMessages.createdAt));

  const map = new Map<string, SupportTicketMessage>();
  for (const row of rows) {
    if (!map.has(row.ticketId)) {
      map.set(row.ticketId, row);
    }
  }
  return map;
}

function isUnreadFromStaff(
  ticket: SupportTicket,
  latest: SupportTicketMessage | undefined,
): boolean {
  if (!latest?.isFromStaff) return false;
  if (ticket.status === "closed" || ticket.status === "resolved") return false;
  const lastRead = ticket.customerLastReadAt;
  if (!lastRead) return true;
  return new Date(latest.createdAt).getTime() > new Date(lastRead).getTime();
}

function toSummary(
  ticket: SupportTicket,
  latest: SupportTicketMessage | undefined,
): SupportTicketSummary {
  const unreadFromStaff = isUnreadFromStaff(ticket, latest);
  return {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    lastMessageAt: ticket.lastMessageAt,
    createdAt: ticket.createdAt,
    messagePreview: latest
      ? messagePreview(latest.body, latest.imageUrls, latest.productLinks)
      : null,
    unreadFromStaff,
    isRead: !unreadFromStaff,
    isRemoved: ticket.customerHiddenAt != null,
  };
}

export async function listUserSupportTickets(
  clerkUserId: string,
): Promise<SupportTicketSummary[]> {
  const db = getDb();
  const tickets = await db
    .select()
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.clerkUserId, clerkUserId),
        isNull(supportTickets.customerHiddenAt),
      ),
    )
    .orderBy(desc(supportTickets.lastMessageAt))
    .limit(100);

  const latestMap = await latestMessageByTicketIds(tickets.map((t) => t.id));
  return tickets.map((t) => toSummary(t, latestMap.get(t.id)));
}

export type UserSupportTicketsPage = {
  tickets: SupportTicketSummary[];
  total: number;
  page: number;
  pageSize: number;
};

function supportInboxFilterCondition(
  filter: SupportInboxFilter,
  latestStaffUnreadSql: ReturnType<typeof sql>,
) {
  switch (filter) {
    case "unread":
      return latestStaffUnreadSql;
    case "read":
      return sql`NOT (${latestStaffUnreadSql})`;
    case "awaiting_customer":
    case "awaiting_staff":
    case "open":
    case "resolved":
    case "closed":
      return eq(supportTickets.status, filter);
    default:
      return undefined;
  }
}

export async function listUserSupportTicketsPage(params: {
  clerkUserId: string;
  mode: "inbox" | "history";
  query: SupportInboxQueryInput;
}): Promise<UserSupportTicketsPage> {
  const db = getDb();
  const { q, page, ps, filter } = params.query;
  const offset = (page - 1) * ps;

  const hiddenClause =
    params.mode === "history" ?
      isNotNull(supportTickets.customerHiddenAt)
    : isNull(supportTickets.customerHiddenAt);

  const searchClause =
    q.length > 0 ?
      or(
        ilike(supportTickets.subject, `%${q}%`),
        ilike(supportTickets.lastMessagePreview, `%${q}%`),
        ilike(supportTickets.ticketNumber, `%${q}%`),
      )
    : undefined;

  // Unread = latest message is from staff and newer than customerLastReadAt (or never read).
  const unreadSql = sql`
    EXISTS (
      SELECT 1 FROM support_ticket_messages m
      WHERE m.ticket_id = ${supportTickets.id}
        AND m.is_from_staff = true
        AND m.created_at = (
          SELECT MAX(m2.created_at) FROM support_ticket_messages m2
          WHERE m2.ticket_id = ${supportTickets.id}
        )
        AND ${supportTickets.status} NOT IN ('closed', 'resolved')
        AND (
          ${supportTickets.customerLastReadAt} IS NULL
          OR m.created_at > ${supportTickets.customerLastReadAt}
        )
    )
  `;

  const filterClause = supportInboxFilterCondition(filter, unreadSql);

  const whereClause = and(
    eq(supportTickets.clerkUserId, params.clerkUserId),
    hiddenClause,
    searchClause,
    filterClause,
  );

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(supportTickets)
    .where(whereClause);

  const tickets = await db
    .select()
    .from(supportTickets)
    .where(whereClause)
    .orderBy(desc(supportTickets.lastMessageAt))
    .limit(ps)
    .offset(offset);

  const latestMap = await latestMessageByTicketIds(tickets.map((t) => t.id));
  return {
    tickets: tickets.map((t) => toSummary(t, latestMap.get(t.id))),
    total: countRow?.count ?? 0,
    page,
    pageSize: ps,
  };
}

/** Unread hub replies in the active (non-removed) inbox — Messages nav badge. */
export async function countUserUnreadSupportTickets(
  clerkUserId: string,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.clerkUserId, clerkUserId),
        isNull(supportTickets.customerHiddenAt),
        sql`
          EXISTS (
            SELECT 1 FROM support_ticket_messages m
            WHERE m.ticket_id = ${supportTickets.id}
              AND m.is_from_staff = true
              AND m.created_at = (
                SELECT MAX(m2.created_at) FROM support_ticket_messages m2
                WHERE m2.ticket_id = ${supportTickets.id}
              )
              AND ${supportTickets.status} NOT IN ('closed', 'resolved')
              AND (
                ${supportTickets.customerLastReadAt} IS NULL
                OR m.created_at > ${supportTickets.customerLastReadAt}
              )
          )
        `,
      ),
    );
  return row?.count ?? 0;
}

export async function markUserSupportTicketRead(params: {
  clerkUserId: string;
  ticketId: string;
}): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .update(supportTickets)
    .set({ customerLastReadAt: now, updatedAt: now })
    .where(
      and(
        eq(supportTickets.id, params.ticketId),
        eq(supportTickets.clerkUserId, params.clerkUserId),
      ),
    );
}

export async function hideUserSupportTicket(params: {
  clerkUserId: string;
  ticketId: string;
}): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  const [updated] = await db
    .update(supportTickets)
    .set({ customerHiddenAt: now, updatedAt: now })
    .where(
      and(
        eq(supportTickets.id, params.ticketId),
        eq(supportTickets.clerkUserId, params.clerkUserId),
        isNull(supportTickets.customerHiddenAt),
      ),
    )
    .returning({ id: supportTickets.id });
  return Boolean(updated);
}

export async function restoreUserSupportTicket(params: {
  clerkUserId: string;
  ticketId: string;
}): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  const [updated] = await db
    .update(supportTickets)
    .set({ customerHiddenAt: null, updatedAt: now })
    .where(
      and(
        eq(supportTickets.id, params.ticketId),
        eq(supportTickets.clerkUserId, params.clerkUserId),
        isNotNull(supportTickets.customerHiddenAt),
      ),
    )
    .returning({ id: supportTickets.id });
  return Boolean(updated);
}

export async function loadUserSupportTicketDetail(params: {
  clerkUserId: string;
  ticketId: string;
}): Promise<SupportTicketDetail | null> {
  const db = getDb();
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.id, params.ticketId),
        eq(supportTickets.clerkUserId, params.clerkUserId),
      ),
    )
    .limit(1);

  if (!ticket) return null;

  const messages = await db
    .select()
    .from(supportTicketMessages)
    .where(eq(supportTicketMessages.ticketId, ticket.id))
    .orderBy(supportTicketMessages.createdAt);

  return {
    id: ticket.id,
    clerkUserId: ticket.clerkUserId,
    subject: ticket.subject,
    status: ticket.status,
    lastMessageAt: ticket.lastMessageAt,
    createdAt: ticket.createdAt,
    messages: messages.map(mapMessageRow),
  };
}

export async function loadAdminSupportInboxGroups(): Promise<
  AdminSupportUserGroup[]
> {
  const db = getDb();
  const tickets = await db
    .select({
      ticket: supportTickets,
      displayName: profiles.fullName,
      email: profiles.email,
    })
    .from(supportTickets)
    .innerJoin(profiles, eq(supportTickets.clerkUserId, profiles.clerkUserId))
    .orderBy(desc(supportTickets.lastMessageAt))
    .limit(500);

  const latestMap = await latestMessageByTicketIds(
    tickets.map((r) => r.ticket.id),
  );

  const byUser = new Map<string, AdminSupportUserGroup>();

  for (const row of tickets) {
    const summary = toSummary(row.ticket, latestMap.get(row.ticket.id));
    const existing = byUser.get(row.ticket.clerkUserId);
    if (existing) {
      existing.tickets.push(summary);
      if (row.ticket.status === "open" || row.ticket.status === "awaiting_staff") {
        existing.openTicketCount += 1;
      }
    } else {
      byUser.set(row.ticket.clerkUserId, {
        clerkUserId: row.ticket.clerkUserId,
        displayName: row.displayName?.trim() || "Customer",
        email: row.email,
        openTicketCount:
          row.ticket.status === "open" || row.ticket.status === "awaiting_staff"
            ? 1
            : 0,
        tickets: [summary],
      });
    }
  }

  return [...byUser.values()];
}

/**
 * Resolve the live purchase-price dialogue for a specific scope (one standalone
 * product, or every line in one batch). Never reuses another batch/single
 * thread for the same customer — only tickets already linked to `orderItemIds`,
 * and never tickets that are also linked to lines outside that scope.
 */
export async function resolveMerchandisePriceDialogueTicket(params: {
  clerkUserId: string;
  preferredTicketId?: string | null;
  /** Order lines in this reconciliation scope (batch siblings or one single). */
  orderItemIds: string[];
}): Promise<SupportTicketDetail | null> {
  const scopeOrderItemIds = Array.from(
    new Set(params.orderItemIds.map((id) => id.trim()).filter(Boolean)),
  );
  if (scopeOrderItemIds.length === 0) return null;

  const db = getDb();
  const scopeIdSet = new Set(scopeOrderItemIds);
  let candidateTicketIds: string[] = [];

  try {
    const scopeRows = await db
      .select({
        supportTicketId: orderItemMerchandiseReconciliations.supportTicketId,
      })
      .from(orderItemMerchandiseReconciliations)
      .where(
        and(
          eq(
            orderItemMerchandiseReconciliations.clerkUserId,
            params.clerkUserId,
          ),
          inArray(
            orderItemMerchandiseReconciliations.orderItemId,
            scopeOrderItemIds,
          ),
        ),
      );

    const linkedFromScope = Array.from(
      new Set(
        scopeRows
          .map((r) => r.supportTicketId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (linkedFromScope.length === 0) return null;

    // Drop tickets also attached to lines outside this batch/single scope
    // (fixes older rows that shared one dialogue across the whole order).
    const ticketOwners = await db
      .select({
        supportTicketId: orderItemMerchandiseReconciliations.supportTicketId,
        orderItemId: orderItemMerchandiseReconciliations.orderItemId,
      })
      .from(orderItemMerchandiseReconciliations)
      .where(
        and(
          eq(
            orderItemMerchandiseReconciliations.clerkUserId,
            params.clerkUserId,
          ),
          inArray(
            orderItemMerchandiseReconciliations.supportTicketId,
            linkedFromScope,
          ),
        ),
      );

    const ownersByTicket = new Map<string, string[]>();
    for (const row of ticketOwners) {
      const ticketId = row.supportTicketId?.trim();
      if (!ticketId) continue;
      const list = ownersByTicket.get(ticketId) ?? [];
      list.push(row.orderItemId);
      ownersByTicket.set(ticketId, list);
    }

    const isSingleScope = scopeOrderItemIds.length === 1;
    candidateTicketIds = linkedFromScope.filter((ticketId) => {
      const owners = ownersByTicket.get(ticketId) ?? [];
      const inScopeOwners = owners.filter((id) => scopeIdSet.has(id));
      if (inScopeOwners.length === 0) return false;
      // Standalone product: never reuse a ticket shared with other lines.
      if (isSingleScope) {
        return owners.length === 1 && scopeIdSet.has(owners[0]!);
      }
      // Batch: keep the batch thread even if a standalone line was wrongly
      // linked earlier — those outsiders are detached below.
      return true;
    });

    // Detach standalone (or other out-of-scope) lines from batch tickets.
    if (!isSingleScope && candidateTicketIds.length > 0) {
      await db
        .update(orderItemMerchandiseReconciliations)
        .set({ supportTicketId: null, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(
              orderItemMerchandiseReconciliations.clerkUserId,
              params.clerkUserId,
            ),
            inArray(
              orderItemMerchandiseReconciliations.supportTicketId,
              candidateTicketIds,
            ),
            notInArray(
              orderItemMerchandiseReconciliations.orderItemId,
              scopeOrderItemIds,
            ),
          ),
        );
    }

    // Standalone was incorrectly sharing a batch (or other) thread — unlink so
    // the next notify opens a new product-only dialogue.
    if (isSingleScope && candidateTicketIds.length === 0 && linkedFromScope.length > 0) {
      await db
        .update(orderItemMerchandiseReconciliations)
        .set({ supportTicketId: null, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(
              orderItemMerchandiseReconciliations.clerkUserId,
              params.clerkUserId,
            ),
            inArray(
              orderItemMerchandiseReconciliations.orderItemId,
              scopeOrderItemIds,
            ),
            inArray(
              orderItemMerchandiseReconciliations.supportTicketId,
              linkedFromScope,
            ),
          ),
        );
    }
  } catch {
    return null;
  }

  const preferred = params.preferredTicketId?.trim() || null;
  if (candidateTicketIds.length === 0) return null;

  const tickets = await db
    .select()
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.clerkUserId, params.clerkUserId),
        inArray(supportTickets.id, candidateTicketIds),
      ),
    )
    .orderBy(desc(supportTickets.lastMessageAt));

  if (tickets.length === 0) return null;

  const details: SupportTicketDetail[] = [];
  for (const t of tickets) {
    const messages = await db
      .select()
      .from(supportTicketMessages)
      .where(eq(supportTicketMessages.ticketId, t.id))
      .orderBy(supportTicketMessages.createdAt);
    details.push({
      id: t.id,
      clerkUserId: t.clerkUserId,
      subject: t.subject,
      status: t.status,
      lastMessageAt: t.lastMessageAt,
      createdAt: t.createdAt,
      messages: messages.map(mapMessageRow),
    });
  }

  const withDecision = details.find((d) =>
    d.messages.some(
      (m) => !m.isFromStaff && m.body.includes("Customer decision:"),
    ),
  );
  if (withDecision) return withDecision;

  if (preferred) {
    const preferredDetail = details.find((d) => d.id === preferred);
    if (preferredDetail) return preferredDetail;
  }

  return details[0] ?? null;
}

export async function loadAdminSupportTicketDetail(
  ticketId: string,
): Promise<
  (SupportTicketDetail & {
    customerDisplayName: string;
    customerEmail: string | null;
  }) | null
> {
  const db = getDb();
  const [row] = await db
    .select({
      ticket: supportTickets,
      displayName: profiles.fullName,
      email: profiles.email,
    })
    .from(supportTickets)
    .innerJoin(profiles, eq(supportTickets.clerkUserId, profiles.clerkUserId))
    .where(eq(supportTickets.id, ticketId))
    .limit(1);

  if (!row) return null;

  const messages = await db
    .select()
    .from(supportTicketMessages)
    .where(eq(supportTicketMessages.ticketId, row.ticket.id))
    .orderBy(supportTicketMessages.createdAt);

  return {
    id: row.ticket.id,
    clerkUserId: row.ticket.clerkUserId,
    subject: row.ticket.subject,
    status: row.ticket.status,
    lastMessageAt: row.ticket.lastMessageAt,
    createdAt: row.ticket.createdAt,
    customerDisplayName: row.displayName?.trim() || "Customer",
    customerEmail: row.email,
    messages: messages.map(mapMessageRow),
  };
}

export async function countOpenSupportTickets(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(supportTickets)
    .where(
      sql`${supportTickets.status} IN ('open', 'awaiting_staff', 'awaiting_customer')`,
    );
  return row?.count ?? 0;
}

export async function insertSupportTicketWithMessage(params: {
  clerkUserId: string;
  subject: string;
  body: string;
  isFromStaff: boolean;
  senderClerkUserId: string;
  imageUrls?: string[];
  productLinks?: string[];
  /** Defaults to awaiting_staff (customer-opened). Staff-opened chats use awaiting_customer. */
  status?: SupportTicketStatus;
}): Promise<{ ticketId: string; messageId: string }> {
  const db = getDb();
  const now = new Date().toISOString();
  const imageUrls = normalizeSupportTicketImageUrls(params.imageUrls);
  const productLinks = normalizeSupportTicketProductLinks(params.productLinks);

  const preview = messagePreview(params.body, imageUrls, productLinks);

  const [ticket] = await db
    .insert(supportTickets)
    .values({
      ticketNumber: generateTicketNumber(),
      clerkUserId: params.clerkUserId,
      subject: params.subject,
      status: params.status ?? "awaiting_staff",
      lastMessageAt: now,
      lastMessagePreview: preview,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: supportTickets.id });

  if (!ticket) {
    throw new Error("Could not create support ticket.");
  }

  const [message] = await db
    .insert(supportTicketMessages)
    .values({
      ticketId: ticket.id,
      senderClerkUserId: params.senderClerkUserId,
      isFromStaff: params.isFromStaff,
      body: params.body,
      imageUrls: imageUrls.length > 0 ? imageUrls : null,
      productLinks: productLinks.length > 0 ? productLinks : null,
    })
    .returning({ id: supportTicketMessages.id });

  if (!message) {
    throw new Error("Could not create support message.");
  }

  return { ticketId: ticket.id, messageId: message.id };
}

export async function appendSupportTicketMessage(params: {
  ticketId: string;
  senderClerkUserId: string;
  isFromStaff: boolean;
  body: string;
  imageUrls?: string[];
  productLinks?: string[];
  nextStatus?: SupportTicketStatus;
}): Promise<{ messageId: string; clerkUserId: string; subject: string }> {
  const db = getDb();
  const now = new Date().toISOString();
  const imageUrls = normalizeSupportTicketImageUrls(params.imageUrls);
  const productLinks = normalizeSupportTicketProductLinks(params.productLinks);

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, params.ticketId))
    .limit(1);

  if (!ticket) {
    throw new Error("Ticket not found.");
  }

  const preview = messagePreview(params.body, imageUrls, productLinks);

  const [message] = await db
    .insert(supportTicketMessages)
    .values({
      ticketId: params.ticketId,
      senderClerkUserId: params.senderClerkUserId,
      isFromStaff: params.isFromStaff,
      body: params.body,
      imageUrls: imageUrls.length > 0 ? imageUrls : null,
      productLinks: productLinks.length > 0 ? productLinks : null,
    })
    .returning({ id: supportTicketMessages.id });

  if (!message) {
    throw new Error("Could not save message.");
  }

  await db
    .update(supportTickets)
    .set({
      lastMessageAt: now,
      lastMessagePreview: preview,
      updatedAt: now,
      ...(params.nextStatus ? { status: params.nextStatus } : {}),
      ...(params.nextStatus === "resolved" || params.nextStatus === "closed"
        ? { resolvedAt: now }
        : {}),
    })
    .where(eq(supportTickets.id, params.ticketId));

  return {
    messageId: message.id,
    clerkUserId: ticket.clerkUserId,
    subject: ticket.subject,
  };
}

export async function updateSupportTicketStatus(params: {
  ticketId: string;
  status: SupportTicketStatus;
}): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .update(supportTickets)
    .set({
      status: params.status,
      updatedAt: now,
      ...(params.status === "resolved" || params.status === "closed"
        ? { resolvedAt: now }
        : { resolvedAt: null }),
    })
    .where(eq(supportTickets.id, params.ticketId));
}
