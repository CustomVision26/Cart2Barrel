"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import {
  recordSupportTicketCustomerReplyActivity,
  recordSupportTicketSubmittedActivity,
} from "@/data/admin-user-activity-events";
import {
  appendCustomerSupportMessage,
  createSupportTicketWithMessage,
  getSupportTicketWithMessagesForUser,
  listSupportTicketsForUser,
} from "@/data/support-tickets";
import { previewSupportMessage } from "@/lib/support-ticket";
import {
  replySupportTicketSchema,
  submitSupportTicketSchema,
  supportTicketIdSchema,
} from "@/lib/validations/support-ticket";

export type SupportTicketActionState =
  | { ok: true; message: string; ticketId?: string }
  | { ok: false; message: string };

export async function submitSupportTicketAction(
  raw: unknown,
): Promise<SupportTicketActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to contact support." };
  }

  const parsed = submitSupportTicketSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid message.";
    return { ok: false, message: first };
  }

  try {
    const { ticketId, ticketNumber } = await createSupportTicketWithMessage({
      clerkUserId: userId,
      subject: parsed.data.subject,
      body: parsed.data.body,
    });

    await recordSupportTicketSubmittedActivity({
      customerClerkUserId: userId,
      ticketId,
      ticketNumber,
      subject: parsed.data.subject,
    });

    revalidatePath("/admin/support/inbox");
    revalidatePath("/admin", "layout");
    revalidatePath("/dashboard", "layout");

    return {
      ok: true,
      message: `Message sent (${ticketNumber}). The hub will reply soon.`,
      ticketId,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not send message.";
    return { ok: false, message: msg };
  }
}

export async function replySupportTicketAsCustomerAction(
  raw: unknown,
): Promise<SupportTicketActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to reply." };
  }

  const parsed = replySupportTicketSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid reply.";
    return { ok: false, message: first };
  }

  const result = await appendCustomerSupportMessage({
    ticketId: parsed.data.ticketId,
    clerkUserId: userId,
    body: parsed.data.body,
  });

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "closed" ?
          "This conversation is closed."
        : "Conversation not found.",
    };
  }

  const thread = await getSupportTicketWithMessagesForUser({
    ticketId: parsed.data.ticketId,
    clerkUserId: userId,
  });

  if (thread) {
    await recordSupportTicketCustomerReplyActivity({
      customerClerkUserId: userId,
      ticketId: thread.id,
      ticketNumber: thread.ticketNumber,
      subject: thread.subject,
    });
  }

  revalidatePath("/admin/support/inbox");
  revalidatePath("/admin", "layout");

  return { ok: true, message: "Reply sent to the hub." };
}

export async function listMySupportTicketsAction() {
  const { userId } = await auth();
  if (!userId) return [];
  return listSupportTicketsForUser(userId);
}

export async function loadMySupportTicketThreadAction(raw: unknown) {
  const { userId } = await auth();
  if (!userId) return null;

  const parsed = supportTicketIdSchema.safeParse(raw);
  if (!parsed.success) return null;

  return getSupportTicketWithMessagesForUser({
    ticketId: parsed.data.ticketId,
    clerkUserId: userId,
  });
}
