"use server";

import { put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";

import { getDb } from "@/db";
import { supportTickets } from "@/db/schema";
import { getClerkSessionGate } from "@/lib/clerk-session";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  isRetailerReceiptImageMime,
  normalizeSupportTicketImageUrls,
  retailerReceiptExtensionForMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
  SUPPORT_TICKET_IMAGES_MAX,
  SUPPORT_TICKET_UPLOAD_BATCH_MAX,
} from "@/lib/support-ticket-images";
import {
  blobReadWriteNotConfiguredMessage,
  getBlobReadWriteToken,
} from "@/lib/vercel-blob-env";

export type UploadSupportTicketImagesState =
  | { ok: true; imageUrls: string[] }
  | { ok: false; message: string };

function collectFilesFromFormData(formData: FormData): File[] {
  const raw = formData.getAll("files");
  return raw.filter((v): v is File => v instanceof File && v.size > 0);
}

async function canUploadToSupportTicket(params: {
  ticketId: string;
  clerkUserId: string;
  isAdmin: boolean;
}): Promise<boolean> {
  if (params.isAdmin) return true;

  const db = getDb();
  const [ticket] = await db
    .select({ clerkUserId: supportTickets.clerkUserId })
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.id, params.ticketId),
        eq(supportTickets.clerkUserId, params.clerkUserId),
      ),
    )
    .limit(1);

  return ticket != null;
}

/** Upload support-ticket images to Vercel Blob (staging or ticket-scoped). */
export async function uploadSupportTicketImagesAction(
  formData: FormData,
): Promise<UploadSupportTicketImagesState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: gate.message };
  }

  const user = await currentUser();
  const isAdmin = isClerkAdmin(user);

  const token = getBlobReadWriteToken();
  if (!token) {
    return { ok: false, message: blobReadWriteNotConfiguredMessage() };
  }

  const ticketIdRaw = formData.get("ticketId");
  const ticketId =
    typeof ticketIdRaw === "string" && ticketIdRaw.trim() !== ""
      ? ticketIdRaw.trim()
      : null;

  if (ticketId) {
    const allowed = await canUploadToSupportTicket({
      ticketId,
      clerkUserId: gate.userId,
      isAdmin,
    });
    if (!allowed) {
      return { ok: false, message: "Ticket not found." };
    }
  }

  const files = collectFilesFromFormData(formData);
  if (files.length === 0) {
    return { ok: false, message: "Choose at least one image." };
  }
  if (files.length > SUPPORT_TICKET_UPLOAD_BATCH_MAX) {
    return {
      ok: false,
      message: `Upload at most ${SUPPORT_TICKET_UPLOAD_BATCH_MAX} images at a time.`,
    };
  }
  if (files.length > SUPPORT_TICKET_IMAGES_MAX) {
    return {
      ok: false,
      message: `Each message can include up to ${SUPPORT_TICKET_IMAGES_MAX} images.`,
    };
  }

  const imageUrls: string[] = [];

  for (const file of files) {
    if (!isRetailerReceiptImageMime(file.type)) {
      return {
        ok: false,
        message: "Only JPEG, PNG, WebP, and GIF images are allowed.",
      };
    }
    if (file.size > RETAILER_RECEIPT_IMAGE_MAX_BYTES) {
      return {
        ok: false,
        message: `Each image must be at most ${Math.round(RETAILER_RECEIPT_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`,
      };
    }

    try {
      const ext = retailerReceiptExtensionForMime(file.type);
      const pathname = ticketId
        ? `support-ticket-images/${ticketId}/${crypto.randomUUID()}.${ext}`
        : `support-ticket-images/staging/${gate.userId}/${crypto.randomUUID()}.${ext}`;
      const blob = await put(pathname, file, {
        access: "public",
        token,
        contentType: file.type || undefined,
      });
      imageUrls.push(blob.url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed.";
      return { ok: false, message: msg };
    }
  }

  return { ok: true, imageUrls: normalizeSupportTicketImageUrls(imageUrls) };
}
