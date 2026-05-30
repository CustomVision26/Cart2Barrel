import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
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

export type SupportTicketSummary = {
  id: string;
  subject: string;
  status: SupportTicketStatus;
  lastMessageAt: string;
  createdAt: string;
  messagePreview: string | null;
  unreadFromStaff: boolean;
};

export type SupportTicketMessageRow = {
  id: string;
  senderClerkUserId: string;
  isFromStaff: boolean;
  body: string;
  imageUrls: string[];
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

function messagePreview(body: string, imageUrls?: string[] | null): string {
  const trimmed = body.trim();
  if (trimmed.length > 0) {
    if (trimmed.length <= 120) return trimmed;
    return `${trimmed.slice(0, 117)}…`;
  }
  const images = normalizeSupportTicketImageUrls(imageUrls);
  if (images.length > 0) {
    return images.length === 1 ? "[Image attachment]" : `[${images.length} images]`;
  }
  return "";
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

function toSummary(
  ticket: SupportTicket,
  latest: SupportTicketMessage | undefined,
): SupportTicketSummary {
  return {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    lastMessageAt: ticket.lastMessageAt,
    createdAt: ticket.createdAt,
    messagePreview: latest ? messagePreview(latest.body, latest.imageUrls) : null,
    unreadFromStaff:
      latest != null &&
      latest.isFromStaff &&
      ticket.status !== "closed" &&
      ticket.status !== "resolved",
  };
}

export async function listUserSupportTickets(
  clerkUserId: string,
): Promise<SupportTicketSummary[]> {
  const db = getDb();
  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.clerkUserId, clerkUserId))
    .orderBy(desc(supportTickets.lastMessageAt))
    .limit(100);

  const latestMap = await latestMessageByTicketIds(tickets.map((t) => t.id));
  return tickets.map((t) => toSummary(t, latestMap.get(t.id)));
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
    messages: messages.map((m) => ({
      id: m.id,
      senderClerkUserId: m.senderClerkUserId,
      isFromStaff: m.isFromStaff,
      body: m.body,
      imageUrls: normalizeSupportTicketImageUrls(m.imageUrls),
      createdAt: m.createdAt,
    })),
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
    messages: messages.map((m) => ({
      id: m.id,
      senderClerkUserId: m.senderClerkUserId,
      isFromStaff: m.isFromStaff,
      body: m.body,
      imageUrls: normalizeSupportTicketImageUrls(m.imageUrls),
      createdAt: m.createdAt,
    })),
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
}): Promise<{ ticketId: string; messageId: string }> {
  const db = getDb();
  const now = new Date().toISOString();
  const imageUrls = normalizeSupportTicketImageUrls(params.imageUrls);

  const preview = messagePreview(params.body, imageUrls);

  const [ticket] = await db
    .insert(supportTickets)
    .values({
      ticketNumber: generateTicketNumber(),
      clerkUserId: params.clerkUserId,
      subject: params.subject,
      status: "awaiting_staff",
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
  nextStatus?: SupportTicketStatus;
}): Promise<{ messageId: string; clerkUserId: string; subject: string }> {
  const db = getDb();
  const now = new Date().toISOString();
  const imageUrls = normalizeSupportTicketImageUrls(params.imageUrls);

  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, params.ticketId))
    .limit(1);

  if (!ticket) {
    throw new Error("Ticket not found.");
  }

  const preview = messagePreview(params.body, imageUrls);

  const [message] = await db
    .insert(supportTicketMessages)
    .values({
      ticketId: params.ticketId,
      senderClerkUserId: params.senderClerkUserId,
      isFromStaff: params.isFromStaff,
      body: params.body,
      imageUrls: imageUrls.length > 0 ? imageUrls : null,
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
