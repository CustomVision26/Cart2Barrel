import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  profiles,
  supportMessages,
  supportTickets,
  type SupportMessage,
  type SupportTicket,
} from "@/db/schema";
import { isMissingSupportHubTablesError } from "@/lib/db-column-missing";
import {
  generateSupportTicketNumber,
  previewSupportMessage,
  ticketNeedsStaffAttention,
} from "@/lib/support-ticket";

export type SupportMessageRow = {
  id: string;
  ticketId: string;
  authorClerkUserId: string | null;
  authorRole: SupportMessage["authorRole"];
  body: string;
  createdAt: string;
};

export type SupportTicketSummary = {
  id: string;
  ticketNumber: string;
  subject: string;
  status: SupportTicket["status"];
  lastMessageAt: string;
  lastMessagePreview: string | null;
  createdAt: string;
  needsStaffAttention: boolean;
};

export type SupportTicketWithMessages = SupportTicketSummary & {
  messages: SupportMessageRow[];
};

export type AdminSupportInboxGroup = {
  clerkUserId: string;
  displayName: string;
  email: string | null;
  tickets: SupportTicketSummary[];
  unreadCount: number;
};

function mapTicketSummary(row: SupportTicket): SupportTicketSummary {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    subject: row.subject,
    status: row.status,
    lastMessageAt: row.lastMessageAt,
    lastMessagePreview: row.lastMessagePreview,
    createdAt: row.createdAt,
    needsStaffAttention: ticketNeedsStaffAttention(row.status),
  };
}

export async function countSupportTicketsNeedingStaff(): Promise<number> {
  try {
    const db = getDb();
    const rows = await db
      .select({ id: supportTickets.id })
      .from(supportTickets)
      .where(
        inArray(supportTickets.status, ["open", "awaiting_staff"]),
      );
    return rows.length;
  } catch (e) {
    if (isMissingSupportHubTablesError(e)) return 0;
    throw e;
  }
}

export async function listSupportTicketsForUser(
  clerkUserId: string,
): Promise<SupportTicketSummary[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.clerkUserId, clerkUserId))
    .orderBy(desc(supportTickets.lastMessageAt))
    .limit(50);

  return rows.map(mapTicketSummary);
}

export async function getSupportTicketWithMessagesForUser(params: {
  ticketId: string;
  clerkUserId: string;
}): Promise<SupportTicketWithMessages | null> {
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
    .from(supportMessages)
    .where(eq(supportMessages.ticketId, ticket.id))
    .orderBy(supportMessages.createdAt);

  return {
    ...mapTicketSummary(ticket),
    messages: messages.map((m) => ({
      id: m.id,
      ticketId: m.ticketId,
      authorClerkUserId: m.authorClerkUserId,
      authorRole: m.authorRole,
      body: m.body,
      createdAt: m.createdAt,
    })),
  };
}

export async function getSupportTicketWithMessagesForAdmin(
  ticketId: string,
): Promise<
  | (SupportTicketWithMessages & {
      clerkUserId: string;
      customerDisplayName: string;
      customerEmail: string | null;
    })
  | null
> {
  const db = getDb();
  const [row] = await db
    .select({
      ticket: supportTickets,
      fullName: profiles.fullName,
      email: profiles.email,
    })
    .from(supportTickets)
    .innerJoin(profiles, eq(supportTickets.clerkUserId, profiles.clerkUserId))
    .where(eq(supportTickets.id, ticketId))
    .limit(1);

  if (!row) return null;

  const messages = await db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.ticketId, ticketId))
    .orderBy(supportMessages.createdAt);

  const displayName =
    row.fullName?.trim() ||
    row.email?.trim() ||
    row.ticket.clerkUserId.slice(0, 12);

  return {
    ...mapTicketSummary(row.ticket),
    clerkUserId: row.ticket.clerkUserId,
    customerDisplayName: displayName,
    customerEmail: row.email,
    messages: messages.map((m) => ({
      id: m.id,
      ticketId: m.ticketId,
      authorClerkUserId: m.authorClerkUserId,
      authorRole: m.authorRole,
      body: m.body,
      createdAt: m.createdAt,
    })),
  };
}

export async function listAdminSupportInboxGroups(): Promise<
  AdminSupportInboxGroup[]
> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        ticket: supportTickets,
        fullName: profiles.fullName,
        email: profiles.email,
      })
      .from(supportTickets)
      .innerJoin(profiles, eq(supportTickets.clerkUserId, profiles.clerkUserId))
      .orderBy(desc(supportTickets.lastMessageAt))
      .limit(200);

    const groupMap = new Map<string, AdminSupportInboxGroup>();

    for (const row of rows) {
      const summary = mapTicketSummary(row.ticket);
      const displayName =
        row.fullName?.trim() ||
        row.email?.trim() ||
        row.ticket.clerkUserId.slice(0, 12);

      let group = groupMap.get(row.ticket.clerkUserId);
      if (!group) {
        group = {
          clerkUserId: row.ticket.clerkUserId,
          displayName,
          email: row.email,
          tickets: [],
          unreadCount: 0,
        };
        groupMap.set(row.ticket.clerkUserId, group);
      }
      group.tickets.push(summary);
      if (summary.needsStaffAttention) {
        group.unreadCount += 1;
      }
    }

    return [...groupMap.values()].sort((a, b) => {
      const aTime = a.tickets[0]?.lastMessageAt ?? "";
      const bTime = b.tickets[0]?.lastMessageAt ?? "";
      return bTime.localeCompare(aTime);
    });
  } catch (e) {
    if (isMissingSupportHubTablesError(e)) return [];
    throw e;
  }
}

export async function createSupportTicketWithMessage(params: {
  clerkUserId: string;
  subject: string;
  body: string;
}): Promise<{ ticketId: string; ticketNumber: string }> {
  const db = getDb();
  const now = new Date().toISOString();
  const ticketNumber = generateSupportTicketNumber();
  const preview = previewSupportMessage(params.body);

  const [ticket] = await db
    .insert(supportTickets)
    .values({
      ticketNumber,
      clerkUserId: params.clerkUserId,
      subject: params.subject,
      status: "open",
      lastMessageAt: now,
      lastMessagePreview: preview,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: supportTickets.id, ticketNumber: supportTickets.ticketNumber });

  if (!ticket) {
    throw new Error("Failed to create support ticket.");
  }

  await db.insert(supportMessages).values({
    ticketId: ticket.id,
    authorClerkUserId: params.clerkUserId,
    authorRole: "customer",
    body: params.body,
    createdAt: now,
  });

  return { ticketId: ticket.id, ticketNumber: ticket.ticketNumber };
}

export async function appendCustomerSupportMessage(params: {
  ticketId: string;
  clerkUserId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; reason: "not_found" | "closed" }> {
  const db = getDb();
  const now = new Date().toISOString();
  const preview = previewSupportMessage(params.body);

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

  if (!ticket) return { ok: false, reason: "not_found" };
  if (ticket.status === "closed") return { ok: false, reason: "closed" };

  await db.insert(supportMessages).values({
    ticketId: ticket.id,
    authorClerkUserId: params.clerkUserId,
    authorRole: "customer",
    body: params.body,
    createdAt: now,
  });

  const nextStatus =
    ticket.status === "resolved" ? "awaiting_staff" : "awaiting_staff";

  await db
    .update(supportTickets)
    .set({
      status: nextStatus,
      lastMessageAt: now,
      lastMessagePreview: preview,
      updatedAt: now,
      resolvedAt: null,
    })
    .where(eq(supportTickets.id, ticket.id));

  return { ok: true };
}

export async function appendStaffSupportMessage(params: {
  ticketId: string;
  staffClerkUserId: string;
  body: string;
  markResolved?: boolean;
}): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  const db = getDb();
  const now = new Date().toISOString();
  const preview = previewSupportMessage(params.body);

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, params.ticketId))
    .limit(1);

  if (!ticket) return { ok: false, reason: "not_found" };

  await db.insert(supportMessages).values({
    ticketId: ticket.id,
    authorClerkUserId: params.staffClerkUserId,
    authorRole: "staff",
    body: params.body,
    createdAt: now,
  });

  await db
    .update(supportTickets)
    .set({
      status: params.markResolved ? "resolved" : "awaiting_customer",
      lastMessageAt: now,
      lastMessagePreview: preview,
      updatedAt: now,
      resolvedAt: params.markResolved ? now : null,
    })
    .where(eq(supportTickets.id, ticket.id));

  return { ok: true };
}
