"use server";

import { put } from "@vercel/blob";
import { asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { z } from "zod";

import { getDb } from "@/db";
import {
  containerOfferingImages,
  containerOfferings,
} from "@/db/schema";
import {
  adminCreateContainerOfferingSchema,
  adminUpdateContainerOfferingSchema,
  priceUsdStringToCents,
} from "@/lib/validations/container-offering";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  isRetailerReceiptImageMime,
  retailerReceiptExtensionForMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
} from "@/lib/retailer-receipt-images";
import {
  blobReadWriteNotConfiguredMessage,
  getBlobReadWriteToken,
} from "@/lib/vercel-blob-env";

export type AdminContainerOfferingMutationState =
  | { ok: true }
  | { ok: false; message: string };

export async function adminCreateContainerOfferingAction(
  input: unknown,
): Promise<AdminContainerOfferingMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminCreateContainerOfferingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { name, sizeLabel, priceUsd } = parsed.data;
  const cents = priceUsdStringToCents(priceUsd);
  if (cents < 50) {
    return { ok: false, message: "Price must be at least $0.50 USD (Stripe minimum per line)." };
  }

  const db = getDb();
  await db.insert(containerOfferings).values({
    name: name.trim(),
    sizeLabel: sizeLabel.trim(),
    priceUsdCents: cents,
    isActive: true,
  });

  revalidatePath("/admin/barrels");
  revalidatePath("/dashboard/barrels");
  return { ok: true };
}

export async function adminUpdateContainerOfferingAction(
  input: unknown,
): Promise<AdminContainerOfferingMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminUpdateContainerOfferingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { id, name, sizeLabel, priceUsd, isActive } = parsed.data;
  const cents = priceUsdStringToCents(priceUsd);
  if (cents < 50) {
    return { ok: false, message: "Price must be at least $0.50 USD (Stripe minimum per line)." };
  }

  const db = getDb();
  const [row] = await db
    .update(containerOfferings)
    .set({
      name: name.trim(),
      sizeLabel: sizeLabel.trim(),
      priceUsdCents: cents,
      isActive,
    })
    .where(eq(containerOfferings.id, id))
    .returning({ id: containerOfferings.id });

  if (!row) {
    return { ok: false, message: "Container not found." };
  }

  revalidatePath("/admin/barrels");
  revalidatePath("/dashboard/barrels");
  return { ok: true };
}

export type AdminUploadContainerImagesState =
  | { ok: true; uploaded: number }
  | { ok: false; message: string };

function collectFilesFromFormData(formData: FormData): File[] {
  const raw = formData.getAll("file");
  return raw.filter((v): v is File => v instanceof File && v.size > 0);
}

export async function adminUploadContainerOfferingImagesAction(
  formData: FormData,
): Promise<AdminUploadContainerImagesState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const token = getBlobReadWriteToken();
  if (!token) {
    return { ok: false, message: blobReadWriteNotConfiguredMessage() };
  }

  const offeringIdRaw = formData.get("offeringId");
  if (typeof offeringIdRaw !== "string" || offeringIdRaw.trim() === "") {
    return { ok: false, message: "Missing container id." };
  }
  const offeringId = offeringIdRaw.trim();

  const files = collectFilesFromFormData(formData);
  if (files.length === 0) {
    return { ok: false, message: "Choose at least one image." };
  }
  if (files.length > 12) {
    return { ok: false, message: "Upload at most 12 images at a time." };
  }

  const db = getDb();
  const [offering] = await db
    .select({ id: containerOfferings.id })
    .from(containerOfferings)
    .where(eq(containerOfferings.id, offeringId))
    .limit(1);
  if (!offering) {
    return { ok: false, message: "Container not found." };
  }

  const [maxRow] = await db
    .select({ m: containerOfferingImages.sortIndex })
    .from(containerOfferingImages)
    .where(eq(containerOfferingImages.containerOfferingId, offeringId))
    .orderBy(desc(containerOfferingImages.sortIndex))
    .limit(1);
  let nextSort = (maxRow?.m ?? -1) + 1;

  let uploaded = 0;
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
    const ext = retailerReceiptExtensionForMime(file.type);
    const pathname = `container-offerings/${offeringId}/${randomUUID()}.${ext}`;
    let imageUrl: string;
    try {
      const blob = await put(pathname, file, {
        access: "public",
        token,
        contentType: file.type || undefined,
      });
      imageUrl = blob.url;
    } catch {
      return { ok: false, message: "Image upload failed. Try again." };
    }
    await db.insert(containerOfferingImages).values({
      containerOfferingId: offeringId,
      imageUrl,
      sortIndex: nextSort,
    });
    nextSort += 1;
    uploaded += 1;
  }

  revalidatePath("/admin/barrels");
  revalidatePath("/dashboard/barrels");
  return { ok: true, uploaded };
}

export async function adminDeleteContainerOfferingImageAction(input: {
  imageId: string;
}): Promise<AdminContainerOfferingMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const id = typeof input.imageId === "string" ? input.imageId.trim() : "";
  if (!id) {
    return { ok: false, message: "Missing image id." };
  }

  const db = getDb();
  const deleted = await db
    .delete(containerOfferingImages)
    .where(eq(containerOfferingImages.id, id))
    .returning({ id: containerOfferingImages.id });

  if (deleted.length === 0) {
    return { ok: false, message: "Image not found." };
  }

  revalidatePath("/admin/barrels");
  revalidatePath("/dashboard/barrels");
  return { ok: true };
}

const adminMoveContainerImageSchema = z.object({
  offeringId: z.string().uuid(),
  imageId: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});

export async function adminMoveContainerOfferingImageAction(
  input: unknown,
): Promise<AdminContainerOfferingMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminMoveContainerImageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { offeringId, imageId, direction } = parsed.data;

  const db = getDb();
  const imgs = await db
    .select()
    .from(containerOfferingImages)
    .where(eq(containerOfferingImages.containerOfferingId, offeringId))
    .orderBy(asc(containerOfferingImages.sortIndex), asc(containerOfferingImages.id));

  const idx = imgs.findIndex((r) => r.id === imageId);
  if (idx < 0) {
    return { ok: false, message: "Image not found for this container." };
  }
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= imgs.length) {
    return { ok: true };
  }

  const reordered = [...imgs];
  const t = reordered[idx]!;
  reordered[idx] = reordered[swapIdx]!;
  reordered[swapIdx] = t;

  for (let i = 0; i < reordered.length; i++) {
    const row = reordered[i]!;
    await db
      .update(containerOfferingImages)
      .set({ sortIndex: i })
      .where(eq(containerOfferingImages.id, row.id));
  }

  revalidatePath("/admin/barrels");
  revalidatePath("/dashboard/barrels");
  return { ok: true };
}
