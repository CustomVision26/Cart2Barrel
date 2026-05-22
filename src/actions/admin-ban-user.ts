"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { resolveStaffClerkUserIds } from "@/data/admin-staff-clerk-ids";
import { getProfileByClerkId } from "@/data/profiles";
import { banClerkUser, unbanClerkUser } from "@/lib/clerk-user-ban";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { adminBanUserSchema } from "@/lib/validations/admin-ban-user";

export type AdminBanUserActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

async function assertCanModerateTarget(
  actorClerkUserId: string,
  targetClerkUserId: string,
): Promise<AdminBanUserActionState | null> {
  if (targetClerkUserId === actorClerkUserId) {
    return { ok: false, message: "You cannot ban your own account." };
  }

  const targetProfile = await getProfileByClerkId(targetClerkUserId);
  if (!targetProfile) {
    return { ok: false, message: "User profile not found." };
  }

  const staffIds = await resolveStaffClerkUserIds([
    {
      clerkUserId: targetClerkUserId,
      email: targetProfile.email,
    },
  ]);
  if (staffIds.has(targetClerkUserId)) {
    return {
      ok: false,
      message: "Admin accounts cannot be banned from this screen.",
    };
  }

  return null;
}

function revalidateAdminUsersPaths(): void {
  revalidatePath("/admin/users/all-users");
  revalidatePath("/admin/users/assign-admin");
  revalidatePath("/admin/users", "layout");
}

export async function banUserAction(
  raw: unknown,
): Promise<AdminBanUserActionState> {
  const cu = await currentUser();
  if (!isClerkAdmin(cu)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminBanUserSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, message: first };
  }

  const targetId = parsed.data.targetClerkUserId;
  const blocked = await assertCanModerateTarget(cu!.id, targetId);
  if (blocked) return blocked;

  const result = await banClerkUser(targetId);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidateAdminUsersPaths();
  return {
    ok: true,
    message: "Account suspended in Clerk. The user cannot sign in until unbanned.",
  };
}

export async function unbanUserAction(
  raw: unknown,
): Promise<AdminBanUserActionState> {
  const cu = await currentUser();
  if (!isClerkAdmin(cu)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminBanUserSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, message: first };
  }

  const targetId = parsed.data.targetClerkUserId;
  const profile = await getProfileByClerkId(targetId);
  if (!profile) {
    return { ok: false, message: "User profile not found." };
  }

  const result = await unbanClerkUser(targetId);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidateAdminUsersPaths();
  return {
    ok: true,
    message: "Account suspension lifted. The user can sign in again.",
  };
}
