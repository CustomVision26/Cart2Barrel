"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath, updateTag } from "next/cache";

import { insertAdminRoleGrant } from "@/data/admin-role-grants";
import { resolveStaffClerkUserIds } from "@/data/admin-staff-clerk-ids";
import { getProfileByClerkId } from "@/data/profiles";
import { grantClerkAdminRole } from "@/lib/clerk-staff-role";
import { CLERK_ADMIN_ROLE, isClerkAdmin } from "@/lib/is-clerk-admin";
import { profileDisplayName } from "@/lib/profile-display-name";
import { grantAdminRoleSchema } from "@/lib/validations/admin-grant-admin-role";

export type GrantAdminRoleActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function grantAdminRoleAction(
  raw: unknown,
): Promise<GrantAdminRoleActionState> {
  const cu = await currentUser();
  if (!isClerkAdmin(cu)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = grantAdminRoleSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, message: first };
  }

  const granterId = cu!.id;
  const targetId = parsed.data.targetClerkUserId;

  if (targetId === granterId) {
    return { ok: false, message: "You already have admin access." };
  }

  const [granterProfile, targetProfile] = await Promise.all([
    getProfileByClerkId(granterId),
    getProfileByClerkId(targetId),
  ]);

  if (!targetProfile) {
    return {
      ok: false,
      message: "User profile not found. They must sign in at least once before becoming an admin.",
    };
  }

  const staffIds = await resolveStaffClerkUserIds([
    {
      clerkUserId: targetId,
      email: targetProfile.email,
    },
  ]);
  if (staffIds.has(targetId)) {
    return { ok: false, message: "This user already has admin access." };
  }

  const clerkResult = await grantClerkAdminRole(targetId);
  if (!clerkResult.ok) {
    return { ok: false, message: clerkResult.message };
  }

  const granterDisplayName = granterProfile
    ? profileDisplayName({
        fullName: granterProfile.fullName,
        email: granterProfile.email,
        clerkUserId: granterId,
      })
    : [cu!.firstName, cu!.lastName].filter(Boolean).join(" ").trim() ||
      cu!.primaryEmailAddress?.emailAddress ||
      granterId;

  const targetDisplayName = profileDisplayName({
    fullName: targetProfile.fullName,
    email: targetProfile.email,
    clerkUserId: targetId,
  });
  const targetEmail = targetProfile.email?.trim() || null;

  try {
    await insertAdminRoleGrant({
      targetClerkUserId: targetId,
      targetDisplayName,
      targetEmail,
      grantedRole: CLERK_ADMIN_ROLE,
      grantedByClerkUserId: granterId,
      grantedByDisplayName: granterDisplayName,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save grant log.";
    return {
      ok: false,
      message:
        msg.includes("admin_role_grants") ?
          "Database is missing admin role grant tables. Run npm run db:push."
        : msg,
    };
  }

  updateTag("admin-profile-picker");
  revalidatePath("/admin/users", "layout");
  revalidatePath("/admin/users/assign-admin");
  revalidatePath("/admin/users/grant-log");

  return {
    ok: true,
    message: `${targetDisplayName} now has admin access.`,
  };
}
