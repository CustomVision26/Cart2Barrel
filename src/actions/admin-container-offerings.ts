"use server";

import { put } from "@vercel/blob";
import { asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { z } from "zod";

import { ensureSpecialFeatureOfferSchema } from "@/data/ensure-special-feature-schema";
import { getDb } from "@/db";
import {
  containerOfferingImages,
  containerOfferings,
  specialFeatureOffers,
} from "@/db/schema";
import {
  adminCreateContainerOfferingSchema,
  adminSetContainerOfferingPublishedSchema,
  adminUpdateContainerOfferingSchema,
  priceUsdStringToCents,
} from "@/lib/validations/container-offering";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  ensureContainerSpecialFeatureLink,
  resolveSpecialFeatureForContainer,
} from "@/lib/special-feature-container-link";
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
  const { name, sizeLabel, kind, priceUsd, specialFeatureOffer, specialFeatureOfferId, suitcaseSizes } =
    parsed.data;
  const cents = priceUsdStringToCents(priceUsd);
  if (cents < 50) {
    return { ok: false, message: "Price must be at least $0.50 USD (Stripe minimum per line)." };
  }

  const db = getDb();

  if (specialFeatureOffer) {
    const specialId = specialFeatureOfferId!.trim();
    const [special] = await db
      .select({ id: specialFeatureOffers.id })
      .from(specialFeatureOffers)
      .where(eq(specialFeatureOffers.id, specialId))
      .limit(1);

    if (!special) {
      return { ok: false, message: "Special feature not found." };
    }

    for (const size of suitcaseSizes) {
      await db.insert(containerOfferings).values({
        name: name.trim(),
        sizeLabel: size,
        kind: "suitcase",
        priceUsdCents: cents,
        // Unpublished until admin clicks Publish on the catalog card.
        isActive: false,
        specialFeatureOfferId: specialId,
      });
    }
  } else {
    await db.insert(containerOfferings).values({
      name: name.trim(),
      sizeLabel: (sizeLabel ?? "").trim(),
      kind,
      priceUsdCents: cents,
      isActive: true,
    });
  }

  revalidatePath("/admin/barrels");
  revalidatePath("/admin/overview");
  revalidatePath("/dashboard/barrels");
  revalidatePath("/");
  return { ok: true };
}

const adminPublishSpecialFeatureContainerSchema = z.object({
  offeringId: z.string().uuid(),
});

/**
 * Publishes a special-feature suitcase so shoppers see it on `/dashboard/barrels`
 * and in the sitewide promo banner for the offer window.
 */
export async function adminPublishSpecialFeatureContainerAction(
  input: unknown,
): Promise<AdminContainerOfferingMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminPublishSpecialFeatureContainerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const db = getDb();
  await ensureSpecialFeatureOfferSchema();
  const [offering] = await db
    .select()
    .from(containerOfferings)
    .where(eq(containerOfferings.id, parsed.data.offeringId))
    .limit(1);

  if (!offering) {
    return { ok: false, message: "Container not found." };
  }
  if (offering.kind !== "suitcase") {
    return { ok: false, message: "Only special-feature suitcases can be published this way." };
  }

  let offer;
  if (offering.specialFeatureOfferId) {
    [offer] = await db
      .select({
        id: specialFeatureOffers.id,
        endsAt: specialFeatureOffers.endsAt,
      })
      .from(specialFeatureOffers)
      .where(eq(specialFeatureOffers.id, offering.specialFeatureOfferId))
      .limit(1);
  } else {
    const allSpecials = await db
      .select({
        id: specialFeatureOffers.id,
        name: specialFeatureOffers.name,
        containerOfferingId: specialFeatureOffers.containerOfferingId,
        endsAt: specialFeatureOffers.endsAt,
      })
      .from(specialFeatureOffers);
    offer =
      resolveSpecialFeatureForContainer(
        {
          id: offering.id,
          name: offering.name,
          kind: offering.kind,
          specialFeatureOfferId: offering.specialFeatureOfferId,
        },
        allSpecials,
      ) ?? null;
  }

  if (!offer) {
    return {
      ok: false,
      message:
        "No special feature linked to this suitcase. Link it under Special features first.",
    };
  }

  const now = new Date();
  const startsAt = now.toISOString();
  const endDate = new Date(offer.endsAt);
  const endsAt =
    Number.isNaN(endDate.getTime()) || endDate.getTime() <= now.getTime() ?
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : offer.endsAt;

  if (offering.specialFeatureOfferId !== offer.id) {
    await ensureContainerSpecialFeatureLink(db, offering.id, offer.id);
  }

  await db
    .update(containerOfferings)
    .set({ isActive: true, specialFeatureOfferId: offer.id })
    .where(eq(containerOfferings.id, offering.id));

  await db
    .update(specialFeatureOffers)
    .set({
      isActive: true,
      startsAt,
      endsAt,
    })
    .where(eq(specialFeatureOffers.id, offer.id));

  revalidatePath("/admin/barrels");
  revalidatePath("/admin/overview");
  revalidatePath("/dashboard/barrels");
  revalidatePath("/");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Hides a published special-feature suitcase from `/dashboard/barrels` without
 * deleting the catalog entry or photos.
 */
export async function adminUnpublishSpecialFeatureContainerAction(
  input: unknown,
): Promise<AdminContainerOfferingMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminPublishSpecialFeatureContainerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const db = getDb();
  await ensureSpecialFeatureOfferSchema();
  const [offering] = await db
    .select()
    .from(containerOfferings)
    .where(eq(containerOfferings.id, parsed.data.offeringId))
    .limit(1);

  if (!offering) {
    return { ok: false, message: "Container not found." };
  }
  if (offering.kind !== "suitcase") {
    return {
      ok: false,
      message: "Only special-feature suitcases can be removed from live this way.",
    };
  }

  let offer;
  if (offering.specialFeatureOfferId) {
    [offer] = await db
      .select({ id: specialFeatureOffers.id })
      .from(specialFeatureOffers)
      .where(eq(specialFeatureOffers.id, offering.specialFeatureOfferId))
      .limit(1);
  } else {
    const allSpecials = await db
      .select({
        id: specialFeatureOffers.id,
        name: specialFeatureOffers.name,
        containerOfferingId: specialFeatureOffers.containerOfferingId,
      })
      .from(specialFeatureOffers);
    offer =
      resolveSpecialFeatureForContainer(
        {
          id: offering.id,
          name: offering.name,
          kind: offering.kind,
          specialFeatureOfferId: offering.specialFeatureOfferId,
        },
        allSpecials,
      ) ?? null;
  }

  if (!offer) {
    return {
      ok: false,
      message: "No special feature linked to this suitcase.",
    };
  }

  await db
    .update(containerOfferings)
    .set({ isActive: false })
    .where(eq(containerOfferings.id, offering.id));

  revalidatePath("/admin/barrels");
  revalidatePath("/admin/overview");
  revalidatePath("/dashboard/barrels");
  revalidatePath("/");
  revalidatePath("/dashboard");
  return { ok: true };
}

function revalidateContainerCatalogPaths() {
  revalidatePath("/admin/barrels");
  revalidatePath("/admin/overview");
  revalidatePath("/dashboard/barrels");
  revalidatePath("/");
  revalidatePath("/dashboard");
}

/**
 * Publishes or unpublishes a barrel or bin so shoppers see it on `/dashboard/barrels`.
 * Special-feature suitcases use the dedicated suitcase publish actions.
 */
export async function adminSetContainerOfferingPublishedAction(
  input: unknown,
): Promise<AdminContainerOfferingMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminSetContainerOfferingPublishedSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const db = getDb();
  const [offering] = await db
    .select({
      id: containerOfferings.id,
      kind: containerOfferings.kind,
    })
    .from(containerOfferings)
    .where(eq(containerOfferings.id, parsed.data.offeringId))
    .limit(1);

  if (!offering) {
    return { ok: false, message: "Container not found." };
  }
  if (offering.kind !== "barrel" && offering.kind !== "bin") {
    return {
      ok: false,
      message: "Use Publish on special-feature suitcases, not this control.",
    };
  }

  await db
    .update(containerOfferings)
    .set({ isActive: parsed.data.published })
    .where(eq(containerOfferings.id, offering.id));

  revalidateContainerCatalogPaths();
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
  const { id, name, sizeLabel, kind, priceUsd, isActive, specialFeatureOfferId } =
    parsed.data;
  const cents = priceUsdStringToCents(priceUsd);
  if (cents < 50) {
    return { ok: false, message: "Price must be at least $0.50 USD (Stripe minimum per line)." };
  }

  const db = getDb();

  let resolvedName = name.trim();
  let resolvedSpecialFeatureOfferId: string | null | undefined;

  if (specialFeatureOfferId) {
    const specialId = specialFeatureOfferId.trim();
    const [special] = await db
      .select({ id: specialFeatureOffers.id, name: specialFeatureOffers.name })
      .from(specialFeatureOffers)
      .where(eq(specialFeatureOffers.id, specialId))
      .limit(1);

    if (!special) {
      return { ok: false, message: "Special feature not found." };
    }

    resolvedName = special.name.trim();
    resolvedSpecialFeatureOfferId = specialId;
  }

  const [row] = await db
    .update(containerOfferings)
    .set({
      name: resolvedName,
      sizeLabel: sizeLabel.trim(),
      kind,
      priceUsdCents: cents,
      isActive,
      ...(resolvedSpecialFeatureOfferId !== undefined ?
        { specialFeatureOfferId: resolvedSpecialFeatureOfferId }
      : {}),
    })
    .where(eq(containerOfferings.id, id))
    .returning({ id: containerOfferings.id });

  if (!row) {
    return { ok: false, message: "Container not found." };
  }

  revalidatePath("/admin/barrels");
  revalidatePath("/admin/overview");
  revalidatePath("/dashboard/barrels");
  return { ok: true };
}

const adminDeleteContainerOfferingSchema = z.object({
  id: z.string().uuid(),
});

export async function adminDeleteContainerOfferingAction(
  input: unknown,
): Promise<AdminContainerOfferingMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminDeleteContainerOfferingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { id } = parsed.data;

  const db = getDb();
  const deleted = await db
    .delete(containerOfferings)
    .where(eq(containerOfferings.id, id))
    .returning({ id: containerOfferings.id });

  if (deleted.length === 0) {
    return { ok: false, message: "Container not found." };
  }

  revalidatePath("/admin/barrels");
  revalidatePath("/admin/overview");
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
  revalidatePath("/admin/overview");
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
  revalidatePath("/admin/overview");
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
  revalidatePath("/admin/overview");
  revalidatePath("/dashboard/barrels");
  return { ok: true };
}
