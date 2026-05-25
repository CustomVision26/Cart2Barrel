"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import {
  appendStaffSupportMessage,
  getSupportTicketWithMessagesForAdmin,
  listAdminSupportInboxGroups,
} from "@/data/support-tickets";
import { recordSupportTicketStaffReplyActivity } from "@/data/user-status-update-events";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { previewSupportMessage } from "@/lib/support-ticket";
import { adminReplySupportTicketSchema } from "@/lib/validations/support-ticket";

export type AdminSupportTicketActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function loadAdminSupportInboxAction() {
  const user = await currentUser();
  if (!isClerkAdmin(user)) return [];
  return listAdminSupportInboxGroups();
}

export async function loadAdminSupportTicketThreadAction(ticketId: string) {
  const user = await currentUser();
  if (!isClerkAdmin(user)) return null;
  return getSupportTicketWithMessagesForAdmin(ticketId);
}

export async function adminReplySupportTicketAction(
  raw: unknown,
): Promise<AdminSupportTicketActionState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminReplySupportTicketSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid reply.";
    return { ok: false, message: first };
  }

  const result = await appendStaffSupportMessage({
    ticketId: parsed.data.ticketId,
    staffClerkUserId: user!.id,
    body: parsed.data.body,
    markResolved: parsed.data.markResolved,
  });

  if (!result.ok) {
    return { ok: false, message: "Conversation not found." };
  }

  const thread = await getSupportTicketWithMessagesForAdmin(parsed.data.ticketId);
  if (thread) {
    await recordSupportTicketStaffReplyActivity({
      clerkUserId: thread.clerkUserId,
      ticketId: thread.id,
      ticketNumber: thread.ticketNumber,
      subject: thread.subject,
      preview: previewSupportMessage(parsed.data.body, 80),
    });
  }

  revalidatePath("/admin/support/inbox");
  revalidatePath(`/admin/support/inbox/${parsed.data.ticketId}`);
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");

  return {
    ok: true,
    message: parsed.data.markResolved ?
      "Reply sent and conversation marked resolved."
    : "Reply sent to the customer.",
  };
}
