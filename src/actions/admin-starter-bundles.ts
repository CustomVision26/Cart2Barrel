"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import {
  archiveStarterBundle,
  listPublishedStarterBundles,
  publishStarterBundle,
  saveStarterBundleDraft,
} from "@/data/starter-bundles";
import { setStarterBundleMarqueePublished } from "@/data/starter-bundle-marquee-settings";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { STARTER_BUNDLES_ROUTES } from "@/lib/starter-bundles";
import {
  adminSaveStarterBundleSchema,
  adminSetStarterBundleMarqueePublishedSchema,
  adminStarterBundleIdSchema,
} from "@/lib/validations/starter-bundle";

export type AdminStarterBundleMutationState =
  | { ok: true; id: string }
  | { ok: false; message: string };

function revalidateStarterBundlePaths() {
  revalidatePath("/admin/overview");
  revalidatePath("/");
  revalidatePath(STARTER_BUNDLES_ROUTES.listing);
}

async function requireAdmin() {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return null;
  }
  return user;
}

export async function adminSaveStarterBundleDraftAction(
  raw: unknown,
): Promise<AdminStarterBundleMutationState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { ok: false, message: "Admin access is required." };
  }
  const parsed = adminSaveStarterBundleSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return { ok: false, message: first ?? "Check the bundle fields and try again." };
  }
  try {
    const saved = await saveStarterBundleDraft({
      clerkUserId: admin.id,
      input: parsed.data,
    });
    revalidateStarterBundlePaths();
    return { ok: true, id: saved.bundle.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save this bundle.";
    return { ok: false, message: msg };
  }
}

export async function adminPublishStarterBundleAction(
  raw: unknown,
): Promise<AdminStarterBundleMutationState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { ok: false, message: "Admin access is required." };
  }
  const parsed = adminSaveStarterBundleSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message;
    return { ok: false, message: first ?? "Check the bundle fields and try again." };
  }
  if (parsed.data.items.length === 0) {
    return { ok: false, message: "Add at least one product before publishing." };
  }
  try {
    const saved = await publishStarterBundle({
      clerkUserId: admin.id,
      input: parsed.data,
    });
    revalidateStarterBundlePaths();
    revalidatePath(STARTER_BUNDLES_ROUTES.detail(saved.bundle.id));
    return { ok: true, id: saved.bundle.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not publish this bundle.";
    return { ok: false, message: msg };
  }
}

export async function adminSetStarterBundleMarqueePublishedAction(
  raw: unknown,
): Promise<{ ok: true; published: boolean } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  if (!admin) {
    return { ok: false, message: "Admin access is required." };
  }
  const parsed = adminSetStarterBundleMarqueePublishedSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Choose whether the Home marquee is published." };
  }
  if (parsed.data.published) {
    const publishedBundles = await listPublishedStarterBundles();
    if (publishedBundles.length === 0) {
      return {
        ok: false,
        message: "Publish at least one starter bundle before showing the Home marquee.",
      };
    }
  }
  try {
    const saved = await setStarterBundleMarqueePublished({
      clerkUserId: admin.id,
      published: parsed.data.published,
    });
    revalidateStarterBundlePaths();
    return { ok: true, published: saved.published };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Could not update the Home marquee.";
    return { ok: false, message: msg };
  }
}

export async function adminArchiveStarterBundleAction(
  raw: unknown,
): Promise<AdminStarterBundleMutationState> {
  const admin = await requireAdmin();
  if (!admin) {
    return { ok: false, message: "Admin access is required." };
  }
  const parsed = adminStarterBundleIdSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Choose a bundle to archive." };
  }
  try {
    const saved = await archiveStarterBundle(parsed.data.id);
    revalidateStarterBundlePaths();
    revalidatePath(STARTER_BUNDLES_ROUTES.detail(saved.bundle.id));
    return { ok: true, id: saved.bundle.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not archive this bundle.";
    return { ok: false, message: msg };
  }
}
