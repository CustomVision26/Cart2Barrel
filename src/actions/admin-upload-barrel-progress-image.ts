"use server";

import { del, put } from "@vercel/blob";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

import { getDb } from "@/db";
import { barrelProgressSnapshots, barrels } from "@/db/schema";
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

const barrelIdSchema = z.string().uuid();

export type AdminBarrelProgressImageState =
  | { ok: true; imageUrl: string }
  | { ok: false; message: string };

export type AdminRemoveBarrelProgressImageState =
  | { ok: true }
  | { ok: false; message: string };

function revalidateBarrelProgressPaths(): void {
  revalidatePath("/dashboard/barrels");
  revalidatePath("/dashboard/barrels/product-to-barrel");
  revalidatePath("/admin/barrels");
  revalidatePath("/admin/barrels/assign-to-barrel");
}

export async function adminUploadBarrelProgressImageAction(
  formData: FormData,
): Promise<AdminBarrelProgressImageState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const token = getBlobReadWriteToken();
  if (!token) {
    return { ok: false, message: blobReadWriteNotConfiguredMessage() };
  }

  const barrelIdRaw = formData.get("barrelId");
  const parsedId = barrelIdSchema.safeParse(
    typeof barrelIdRaw === "string" ? barrelIdRaw.trim() : "",
  );
  if (!parsedId.success) {
    return { ok: false, message: "Missing container." };
  }
  const barrelId = parsedId.data;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an image to upload." };
  }
  if (!isRetailerReceiptImageMime(file.type)) {
    return {
      ok: false,
      message: "Only JPEG, PNG, WebP, and GIF images are allowed.",
    };
  }
  if (file.size > RETAILER_RECEIPT_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      message: `Image must be at most ${Math.round(RETAILER_RECEIPT_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`,
    };
  }

  const db = getDb();
  const [barrelRow] = await db
    .select({
      id: barrels.id,
      capacityPercentage: barrels.capacityPercentage,
    })
    .from(barrels)
    .where(eq(barrels.id, barrelId))
    .limit(1);
  if (!barrelRow) {
    return { ok: false, message: "Container not found." };
  }

  let imageUrl: string;
  try {
    const ext = retailerReceiptExtensionForMime(file.type);
    const pathname = `barrel-progress/${barrelId}/${crypto.randomUUID()}.${ext}`;
    const blob = await put(pathname, file, {
      access: "public",
      token,
      contentType: file.type || undefined,
    });
    imageUrl = blob.url;
  } catch {
    return { ok: false, message: "Upload failed. Try again." };
  }

  // Append a snapshot to the visual record, and point the container's current
  // thumbnail at the newest photo.
  await db.insert(barrelProgressSnapshots).values({
    barrelId,
    imageUrl,
    capacityPercentage: barrelRow.capacityPercentage,
    createdByClerkUserId: user?.id ?? null,
  });
  await db
    .update(barrels)
    .set({ progressImageUrl: imageUrl })
    .where(eq(barrels.id, barrelId));

  revalidateBarrelProgressPaths();
  return { ok: true, imageUrl };
}

export async function adminRemoveBarrelProgressImageAction(
  raw: unknown,
): Promise<AdminRemoveBarrelProgressImageState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsedId = barrelIdSchema.safeParse(
    typeof raw === "object" && raw !== null && "barrelId" in raw ?
      (raw as { barrelId: unknown }).barrelId
    : raw,
  );
  if (!parsedId.success) {
    return { ok: false, message: "Missing container." };
  }
  const barrelId = parsedId.data;

  const db = getDb();
  const [barrelRow] = await db
    .select({ id: barrels.id })
    .from(barrels)
    .where(eq(barrels.id, barrelId))
    .limit(1);
  if (!barrelRow) {
    return { ok: false, message: "Container not found." };
  }

  // Remove the most recent photo from the visual record, then re-point the
  // container thumbnail at whatever photo is now newest (or clear it).
  const snapshots = await db
    .select({
      id: barrelProgressSnapshots.id,
      imageUrl: barrelProgressSnapshots.imageUrl,
    })
    .from(barrelProgressSnapshots)
    .where(eq(barrelProgressSnapshots.barrelId, barrelId))
    .orderBy(desc(barrelProgressSnapshots.createdAt));

  const latest = snapshots[0];
  const nextNewest = snapshots[1];

  if (latest) {
    await db
      .delete(barrelProgressSnapshots)
      .where(eq(barrelProgressSnapshots.id, latest.id));
  }

  await db
    .update(barrels)
    .set({ progressImageUrl: nextNewest?.imageUrl ?? null })
    .where(eq(barrels.id, barrelId));

  if (latest) {
    const token = getBlobReadWriteToken();
    if (token) {
      try {
        await del(latest.imageUrl, { token });
      } catch {
        // Ignore: the DB reference is cleared; orphaned blob is harmless.
      }
    }
  }

  revalidateBarrelProgressPaths();
  return { ok: true };
}
