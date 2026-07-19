"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

import {
  setLinkedContainersActiveForSpecialOffer,
  unlinkContainersFromSpecialOffer,
} from "@/lib/special-feature-container-link";
import { getDb } from "@/db";
import { specialFeatureOffers } from "@/db/schema";
import { estimateAirlineCheckedBagFeeWithOpenAI } from "@/lib/ai/estimate-airline-checked-bag-fee";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { persistSpecialFeatureNotes } from "@/lib/special-feature-notes";
import { priceUsdStringToCents } from "@/lib/validations/container-offering";
import {
  adminCreateSpecialFeatureOfferSchema,
  adminEstimateAirlineBagFeeSchema,
  adminPublishSpecialFeatureOfferSchema,
  adminUpdateSpecialFeatureOfferSchema,
  specialFeatureDateTimeToIso,
  usdStringToCentsOrZero,
} from "@/lib/validations/special-feature-offer";

export type AdminSpecialFeatureMutationState =
  | { ok: true }
  | { ok: false; message: string };

export type AdminEstimateAirlineBagFeeState =
  | {
      ok: true;
      secondBagUsd: number | null;
      thirdBagUsd: number | null;
      fourthBagUsd: number | null;
      extraNote: string | null;
    }
  | { ok: false; message: string };

function revalidateSpecialFeaturePaths() {
  revalidatePath("/admin/overview");
  revalidatePath("/dashboard/barrels");
  revalidatePath("/dashboard/cart");
  revalidatePath("/");
  revalidatePath("/dashboard");
}

/** Clamp offer window so a published special is visible on the shopper banner immediately. */
function resolveLiveSpecialFeatureWindow(
  startsAtRaw: string,
  endsAtRaw: string,
  now = new Date(),
): { startsAt: string; endsAt: string } {
  const nowIso = now.toISOString();
  const startDate = new Date(startsAtRaw);
  const endDate = new Date(endsAtRaw);
  const startsAt =
    Number.isNaN(startDate.getTime()) || startDate.getTime() > now.getTime() ?
      nowIso
    : startsAtRaw;
  const endsAt =
    Number.isNaN(endDate.getTime()) || endDate.getTime() <= now.getTime() ?
      new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : endsAtRaw;
  return { startsAt, endsAt };
}

export async function adminCreateSpecialFeatureOfferAction(
  input: unknown,
): Promise<AdminSpecialFeatureMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminCreateSpecialFeatureOfferSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const {
    name,
    packagingMode,
    priceUsd,
    airlineName,
    travelAt,
    airlineBagFeeExtraNote,
    notes,
    startsAt,
    endsAt,
    airlineSecondBagUsd,
    airlineThirdBagUsd,
    airlineFourthBagUsd,
  } = parsed.data;
  const sizeLabel = parsed.data.sizeLabel?.trim() || "Suitcase";
  const destinationLocation = parsed.data.destinationLocation?.trim() || "—";

  const cents =
    packagingMode === "in_app" ?
      priceUsdStringToCents(priceUsd)
    : priceUsd.trim() === "" ?
      0
    : priceUsdStringToCents(priceUsd);

  const db = getDb();

  const travelAtIso = specialFeatureDateTimeToIso(travelAt);
  const startsAtIso = specialFeatureDateTimeToIso(startsAt);
  const endsAtIso = specialFeatureDateTimeToIso(endsAt);
  const secondBagCents = usdStringToCentsOrZero(airlineSecondBagUsd);
  const thirdBagCents = usdStringToCentsOrZero(airlineThirdBagUsd);
  const fourthBagCents = usdStringToCentsOrZero(airlineFourthBagUsd);
  const bagFeeExtraNote = airlineBagFeeExtraNote.trim();

  await db
    .insert(specialFeatureOffers)
    .values({
      name: name.trim(),
      sizeLabel,
      destinationLocation,
      packagingMode,
      priceUsdCents: cents,
      airlineName: airlineName.trim(),
      travelAt: travelAtIso,
      airlineSecondBagUsdCents: secondBagCents,
      airlineThirdBagUsdCents: thirdBagCents,
      airlineFourthBagUsdCents: fourthBagCents,
      airlineBagFeeExtraNote: bagFeeExtraNote,
      notes: persistSpecialFeatureNotes(notes),
      startsAt: startsAtIso,
      endsAt: endsAtIso,
      // Draft until admin publishes — then shoppers see the banner.
      isActive: false,
      containerOfferingId: null,
    });

  revalidateSpecialFeaturePaths();
  return { ok: true };
}

export async function adminUpdateSpecialFeatureOfferAction(
  input: unknown,
): Promise<AdminSpecialFeatureMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminUpdateSpecialFeatureOfferSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const {
    id,
    name,
    packagingMode,
    priceUsd,
    airlineName,
    travelAt,
    airlineBagFeeExtraNote,
    notes,
    startsAt,
    endsAt,
    isActive,
    airlineSecondBagUsd,
    airlineThirdBagUsd,
    airlineFourthBagUsd,
  } = parsed.data;

  const cents =
    packagingMode === "in_app" ?
      priceUsdStringToCents(priceUsd)
    : priceUsd.trim() === "" ?
      0
    : priceUsdStringToCents(priceUsd);

  const db = getDb();
  const [existing] = await db
    .select()
    .from(specialFeatureOffers)
    .where(eq(specialFeatureOffers.id, id))
    .limit(1);

  if (!existing) {
    return { ok: false, message: "Special feature not found." };
  }

  const sizeLabel =
    parsed.data.sizeLabel?.trim() || existing.sizeLabel || "Suitcase";
  const destinationLocation =
    parsed.data.destinationLocation?.trim() ||
    existing.destinationLocation ||
    "—";

  const travelAtIso = specialFeatureDateTimeToIso(travelAt);
  const startsAtIso = specialFeatureDateTimeToIso(startsAt);
  const endsAtIso = specialFeatureDateTimeToIso(endsAt);

  const [row] = await db
    .update(specialFeatureOffers)
    .set({
      name: name.trim(),
      sizeLabel,
      destinationLocation,
      packagingMode,
      priceUsdCents: cents,
      airlineName: airlineName.trim(),
      travelAt: travelAtIso,
      airlineSecondBagUsdCents: usdStringToCentsOrZero(airlineSecondBagUsd),
      airlineThirdBagUsdCents: usdStringToCentsOrZero(airlineThirdBagUsd),
      airlineFourthBagUsdCents: usdStringToCentsOrZero(airlineFourthBagUsd),
      airlineBagFeeExtraNote: airlineBagFeeExtraNote.trim(),
      notes: persistSpecialFeatureNotes(notes),
      startsAt: startsAtIso,
      endsAt: endsAtIso,
      isActive,
    })
    .where(eq(specialFeatureOffers.id, id))
    .returning({ id: specialFeatureOffers.id });

  if (!row) {
    return { ok: false, message: "Special feature not found." };
  }

  revalidateSpecialFeaturePaths();
  return { ok: true };
}

/**
 * AI lookup for outside 2nd+ checked-bag fees (~50 lb) on the courier travel day.
 */
export async function adminEstimateAirlineBagFeesAction(
  input: unknown,
): Promise<AdminEstimateAirlineBagFeeState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminEstimateAirlineBagFeeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    const estimate = await estimateAirlineCheckedBagFeeWithOpenAI({
      airlineName: parsed.data.airlineName,
      travelDateIso: specialFeatureDateTimeToIso(parsed.data.travelDate),
    });

    if (estimate.secondBagUsd == null && estimate.thirdBagUsd == null) {
      return {
        ok: false,
        message:
          estimate.notes?.trim() ||
          "AI could not determine 2nd or 3rd checked-bag fees for that airline on the travel day.",
      };
    }

    return {
      ok: true,
      secondBagUsd: estimate.secondBagUsd,
      thirdBagUsd: estimate.thirdBagUsd,
      fourthBagUsd: null,
      extraNote: estimate.notes?.trim() || null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to estimate airline bag fees.";
    return { ok: false, message };
  }
}

/**
 * Publish a draft special so shoppers see the promo banner (and barrels suitcase)
 * during the offer window.
 */
export async function adminPublishSpecialFeatureOfferAction(
  input: unknown,
): Promise<AdminSpecialFeatureMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminPublishSpecialFeatureOfferSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const db = getDb();
  const [offer] = await db
    .select()
    .from(specialFeatureOffers)
    .where(eq(specialFeatureOffers.id, parsed.data.id))
    .limit(1);

  if (!offer) {
    return { ok: false, message: "Special feature not found." };
  }

  // Make the window live immediately so the banner appears after publish.
  const { startsAt, endsAt } = resolveLiveSpecialFeatureWindow(
    offer.startsAt,
    offer.endsAt,
  );

  await db
    .update(specialFeatureOffers)
    .set({
      isActive: true,
      startsAt,
      endsAt,
    })
    .where(eq(specialFeatureOffers.id, offer.id));

  await setLinkedContainersActiveForSpecialOffer(db, {
    id: offer.id,
    name: offer.name,
    containerOfferingId: offer.containerOfferingId,
  }, true);

  revalidateSpecialFeaturePaths();
  return { ok: true };
}

export async function adminUnpublishSpecialFeatureOfferAction(
  input: unknown,
): Promise<AdminSpecialFeatureMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminPublishSpecialFeatureOfferSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const db = getDb();
  const [offer] = await db
    .select()
    .from(specialFeatureOffers)
    .where(eq(specialFeatureOffers.id, parsed.data.id))
    .limit(1);

  if (!offer) {
    return { ok: false, message: "Special feature not found." };
  }

  await db
    .update(specialFeatureOffers)
    .set({ isActive: false })
    .where(eq(specialFeatureOffers.id, offer.id));

  await setLinkedContainersActiveForSpecialOffer(db, {
    id: offer.id,
    name: offer.name,
    containerOfferingId: offer.containerOfferingId,
  }, false);

  revalidateSpecialFeaturePaths();
  return { ok: true };
}

const adminDeleteSpecialFeatureOfferSchema = z.object({
  id: z.string().uuid(),
});

export async function adminDeleteSpecialFeatureOfferAction(
  input: unknown,
): Promise<AdminSpecialFeatureMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminDeleteSpecialFeatureOfferSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(specialFeatureOffers)
    .where(eq(specialFeatureOffers.id, parsed.data.id))
    .limit(1);

  if (!existing) {
    return { ok: false, message: "Special feature not found." };
  }

  await db
    .delete(specialFeatureOffers)
    .where(eq(specialFeatureOffers.id, parsed.data.id));

  await unlinkContainersFromSpecialOffer(db, parsed.data.id);

  revalidateSpecialFeaturePaths();
  return { ok: true };
}
