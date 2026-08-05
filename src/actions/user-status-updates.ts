"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  markAllUserStatusUpdateEventsRead,
  markUserStatusUpdateEventsRead,
} from "@/data/user-status-update-events";
import { getDb } from "@/db";
import {
  orderItemMerchandiseReconciliations,
  userStatusUpdateEvents,
} from "@/db/schema";
import { getClerkSessionGate } from "@/lib/clerk-session";
import { DASHBOARD_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import { userStatusHrefForSupportTicket } from "@/lib/user-status-updates";

const markReadSchema = z.object({
  eventIds: z.array(z.string().uuid()).min(1).max(200),
});

const openEventSchema = z.object({
  eventId: z.string().uuid(),
});

export type UserStatusUpdateActionState = {
  ok: boolean;
  message?: string;
};

export type OpenUserStatusUpdateEventState =
  | { ok: true; href: string }
  | { ok: false; message: string };

/**
 * Mark one status update read and return the destination URL.
 * Purchase-price events always open Messages (support thread), never Order products.
 */
export async function openUserStatusUpdateEventAction(
  raw: unknown,
): Promise<OpenUserStatusUpdateEventState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = openEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid notification." };
  }

  const db = getDb();
  const [event] = await db
    .select({
      id: userStatusUpdateEvents.id,
      kind: userStatusUpdateEvents.kind,
      href: userStatusUpdateEvents.href,
      entityType: userStatusUpdateEvents.entityType,
      entityId: userStatusUpdateEvents.entityId,
    })
    .from(userStatusUpdateEvents)
    .where(
      and(
        eq(userStatusUpdateEvents.id, parsed.data.eventId),
        eq(userStatusUpdateEvents.clerkUserId, gate.userId),
      ),
    )
    .limit(1);

  if (!event) {
    return { ok: false, message: "Notification not found." };
  }

  await markUserStatusUpdateEventsRead({
    clerkUserId: gate.userId,
    eventIds: [event.id],
  });

  let href = event.href;

  if (event.kind === "merchandise_price_change") {
    if (href.includes("/dashboard/support/")) {
      return { ok: true, href };
    }
    if (event.entityType === "order_item") {
      try {
        const [recon] = await db
          .select({
            supportTicketId:
              orderItemMerchandiseReconciliations.supportTicketId,
          })
          .from(orderItemMerchandiseReconciliations)
          .where(
            and(
              sql`${orderItemMerchandiseReconciliations.orderItemId}::text = ${event.entityId}`,
              eq(
                orderItemMerchandiseReconciliations.clerkUserId,
                gate.userId,
              ),
            ),
          )
          .limit(1);
        if (recon?.supportTicketId) {
          href = userStatusHrefForSupportTicket(recon.supportTicketId);
          await db
            .update(userStatusUpdateEvents)
            .set({ href })
            .where(eq(userStatusUpdateEvents.id, event.id));
          return { ok: true, href };
        }
      } catch {
        // Fall through to Messages inbox.
      }
    }
    return { ok: true, href: DASHBOARD_SUPPORT_ROUTES.inbox };
  }

  return { ok: true, href };
}

export async function markUserStatusUpdateEventsReadAction(
  raw: unknown,
): Promise<UserStatusUpdateActionState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: "You must be signed in." };
  }

  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = markReadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid notification selection." };
  }

  await markUserStatusUpdateEventsRead({
    clerkUserId: userId,
    eventIds: parsed.data.eventIds,
  });

  return { ok: true };
}

export async function markAllUserStatusUpdateEventsReadAction(): Promise<UserStatusUpdateActionState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: "You must be signed in." };
  }

  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  await markAllUserStatusUpdateEventsRead(userId);
  return { ok: true };
}
