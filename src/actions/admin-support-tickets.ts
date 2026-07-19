"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import {
  appendSupportTicketMessage,
  insertSupportTicketWithMessage,
  updateSupportTicketStatus,
} from "@/data/support-tickets";
import { recordSupportReplyActivity } from "@/data/user-status-update-events";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { ADMIN_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  adminCreateSupportTicketSchema,
  adminSupportTicketStatusSchema,
  supportTicketReplySchema,
} from "@/lib/validations/support";

export type AdminSupportActionState =
  | { ok: true; message: string; ticketId?: string }
  | { ok: false; message: string };

function supportPreview(body: string, imageUrls: string[], productLinks: string[]) {
  if (body.trim()) return body;
  if (imageUrls.length > 0) return "[Image attachment]";
  if (productLinks.length > 0) return "[Product link]";
  return "";
}

export async function adminCreateSupportTicketAction(
  raw: unknown,
): Promise<AdminSupportActionState> {
  const user = await currentUser();
  if (!isClerkAdmin(user) || !user) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminCreateSupportTicketSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid chat.";
    return { ok: false, message: first };
  }

  const db = getDb();
  const [customer] = await db
    .select({ clerkUserId: profiles.clerkUserId })
    .from(profiles)
    .where(eq(profiles.clerkUserId, parsed.data.customerClerkUserId))
    .limit(1);

  if (!customer) {
    return { ok: false, message: "Customer account not found." };
  }

  try {
    const { ticketId } = await insertSupportTicketWithMessage({
      clerkUserId: customer.clerkUserId,
      subject: parsed.data.subject,
      body: parsed.data.body,
      imageUrls: parsed.data.imageUrls,
      productLinks: parsed.data.productLinks,
      isFromStaff: true,
      senderClerkUserId: user.id,
      status: "awaiting_customer",
    });

    await recordSupportReplyActivity({
      clerkUserId: customer.clerkUserId,
      ticketId,
      subject: parsed.data.subject,
      preview: supportPreview(
        parsed.data.body,
        parsed.data.imageUrls,
        parsed.data.productLinks,
      ),
    });

    revalidatePath(ADMIN_SUPPORT_ROUTES.inbox);
    revalidatePath(ADMIN_SUPPORT_ROUTES.ticket(ticketId));
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Chat started.", ticketId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not start chat.";
    return { ok: false, message: msg };
  }
}

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
      productLinks: parsed.data.productLinks,
      nextStatus: "awaiting_customer",
    });

    await recordSupportReplyActivity({
      clerkUserId: result.clerkUserId,
      ticketId: parsed.data.ticketId,
      subject: result.subject,
      preview: supportPreview(
        parsed.data.body,
        parsed.data.imageUrls,
        parsed.data.productLinks,
      ),
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
