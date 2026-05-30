"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";

import {
  appendSupportTicketMessage,
  updateSupportTicketStatus,
} from "@/data/support-tickets";
import { recordSupportReplyActivity } from "@/data/user-status-update-events";
import { ADMIN_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  adminSupportTicketStatusSchema,
  supportTicketReplySchema,
} from "@/lib/validations/support";

export type AdminSupportActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function adminReplySupportTicketAction(
  raw: unknown,
): Promise<AdminSupportActionState> {
  const user = await currentUser();
  if (!isClerkAdmin(user) || !user) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = supportTicketReplySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid reply.";
    return { ok: false, message: first };
  }

  try {
    const result = await appendSupportTicketMessage({
      ticketId: parsed.data.ticketId,
      senderClerkUserId: user.id,
      isFromStaff: true,
      body: parsed.data.body,
      imageUrls: parsed.data.imageUrls,
      nextStatus: "awaiting_customer",
    });

    await recordSupportReplyActivity({
      clerkUserId: result.clerkUserId,
      ticketId: parsed.data.ticketId,
      subject: result.subject,
      preview: parsed.data.body || "[Image attachment]",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not send reply.";
    return { ok: false, message: msg };
  }

  revalidatePath(ADMIN_SUPPORT_ROUTES.inbox);
  revalidatePath(ADMIN_SUPPORT_ROUTES.ticket(parsed.data.ticketId));
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Reply sent." };
}

export async function adminUpdateSupportTicketStatusAction(
  raw: unknown,
): Promise<AdminSupportActionState> {
  const user = await currentUser();
  if (!isClerkAdmin(user) || !user) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminSupportTicketStatusSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid status.";
    return { ok: false, message: first };
  }

  try {
    await updateSupportTicketStatus({
      ticketId: parsed.data.ticketId,
      status: parsed.data.status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not update status.";
    return { ok: false, message: msg };
  }

  revalidatePath(ADMIN_SUPPORT_ROUTES.inbox);
  revalidatePath(ADMIN_SUPPORT_ROUTES.ticket(parsed.data.ticketId));
  return { ok: true, message: "Ticket status updated." };
}
