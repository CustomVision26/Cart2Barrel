"use server";

import { revalidatePath } from "next/cache";

import {
  appendSupportTicketMessage,
  hideUserSupportTicket,
  insertSupportTicketWithMessage,
  loadUserSupportTicketDetail,
  restoreUserSupportTicket,
} from "@/data/support-tickets";
import {
  recordSupportTicketRepliedActivity,
  recordSupportTicketSubmittedActivity,
} from "@/data/admin-user-activity-events";
import { getClerkSessionGate } from "@/lib/clerk-session";
import { DASHBOARD_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import {
  createSupportTicketSchema,
  hideSupportTicketSchema,
  restoreSupportTicketSchema,
  supportTicketReplySchema,
} from "@/lib/validations/support";

export type SupportTicketActionState =
  | { ok: true; message: string; ticketId?: string }
  | { ok: false; message: string };

export async function createSupportTicketAction(
  raw: unknown,
): Promise<SupportTicketActionState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }

  const parsed = createSupportTicketSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid submission.";
    return { ok: false, message: first };
  }

  try {
    const { ticketId } = await insertSupportTicketWithMessage({
      clerkUserId: gate.userId,
      subject: parsed.data.subject,
      body: parsed.data.body,
      imageUrls: parsed.data.imageUrls,
      productLinks: parsed.data.productLinks,
      isFromStaff: false,
      senderClerkUserId: gate.userId,
    });

    await recordSupportTicketSubmittedActivity({
      customerClerkUserId: gate.userId,
      ticketId,
      subject: parsed.data.subject,
    });

    revalidatePath(DASHBOARD_SUPPORT_ROUTES.inbox);
    revalidatePath("/admin/support/inbox");
    revalidatePath("/admin", "layout");
    return {
      ok: true,
      message: "Your message was sent. We'll reply here and in notifications.",
      ticketId,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not submit your message.";
    return { ok: false, message: msg };
  }
}

export async function userReplySupportTicketAction(
  raw: unknown,
): Promise<SupportTicketActionState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }

  const parsed = supportTicketReplySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid reply.";
    return { ok: false, message: first };
  }

  try {
    const ticket = await loadUserSupportTicketDetail({
      clerkUserId: gate.userId,
      ticketId: parsed.data.ticketId,
    });
    if (!ticket) {
      return { ok: false, message: "Ticket not found." };
    }

    const result = await appendSupportTicketMessage({
      ticketId: parsed.data.ticketId,
      senderClerkUserId: gate.userId,
      isFromStaff: false,
      body: parsed.data.body,
      imageUrls: parsed.data.imageUrls,
      productLinks: parsed.data.productLinks,
      nextStatus: "awaiting_staff",
    });

    if (result.clerkUserId !== gate.userId) {
      return { ok: false, message: "Ticket not found." };
    }

    await recordSupportTicketRepliedActivity({
      customerClerkUserId: gate.userId,
      ticketId: parsed.data.ticketId,
      subject: result.subject,
      preview:
        parsed.data.body ||
        (parsed.data.imageUrls.length > 0
          ? "[Image attachment]"
          : "[Product link]"),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not send reply.";
    return { ok: false, message: msg };
  }

  revalidatePath(DASHBOARD_SUPPORT_ROUTES.inbox);
  revalidatePath(DASHBOARD_SUPPORT_ROUTES.ticket(parsed.data.ticketId));
  revalidatePath("/admin/support/inbox");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Message sent." };
}

export async function hideSupportTicketAction(
  raw: unknown,
): Promise<SupportTicketActionState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }
  const parsed = hideSupportTicketSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid ticket." };
  }
  const ok = await hideUserSupportTicket({
    clerkUserId: gate.userId,
    ticketId: parsed.data.ticketId,
  });
  if (!ok) {
    return { ok: false, message: "Could not remove this conversation." };
  }
  revalidatePath(DASHBOARD_SUPPORT_ROUTES.inbox);
  revalidatePath(DASHBOARD_SUPPORT_ROUTES.history);
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Moved to History." };
}

export async function restoreSupportTicketAction(
  raw: unknown,
): Promise<SupportTicketActionState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }
  const parsed = restoreSupportTicketSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid ticket." };
  }
  const ok = await restoreUserSupportTicket({
    clerkUserId: gate.userId,
    ticketId: parsed.data.ticketId,
  });
  if (!ok) {
    return { ok: false, message: "Could not restore this conversation." };
  }
  revalidatePath(DASHBOARD_SUPPORT_ROUTES.inbox);
  revalidatePath(DASHBOARD_SUPPORT_ROUTES.history);
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Restored to Messages." };
}
