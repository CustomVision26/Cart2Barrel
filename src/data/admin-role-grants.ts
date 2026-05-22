import { desc } from "drizzle-orm";

import { getDb } from "@/db";
import { adminRoleGrants } from "@/db/schema";

export type AdminRoleGrantLogRow = {
  id: string;
  targetClerkUserId: string;
  targetDisplayName: string;
  targetEmail: string | null;
  grantedRole: string;
  grantedByClerkUserId: string;
  grantedByDisplayName: string;
  createdAt: string;
};

export async function listAdminRoleGrantLog(): Promise<AdminRoleGrantLogRow[]> {
  const db = getDb();
  try {
    const rows = await db
      .select({
        id: adminRoleGrants.id,
        targetClerkUserId: adminRoleGrants.targetClerkUserId,
        targetDisplayName: adminRoleGrants.targetDisplayName,
        targetEmail: adminRoleGrants.targetEmail,
        grantedRole: adminRoleGrants.grantedRole,
        grantedByClerkUserId: adminRoleGrants.grantedByClerkUserId,
        grantedByDisplayName: adminRoleGrants.grantedByDisplayName,
        createdAt: adminRoleGrants.createdAt,
      })
      .from(adminRoleGrants)
      .orderBy(desc(adminRoleGrants.createdAt));
    return rows.map((r) => ({
      ...r,
      targetEmail: r.targetEmail?.trim() || null,
    }));
  } catch {
    return [];
  }
}

export async function insertAdminRoleGrant(params: {
  targetClerkUserId: string;
  targetDisplayName: string;
  targetEmail: string | null;
  grantedRole: string;
  grantedByClerkUserId: string;
  grantedByDisplayName: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(adminRoleGrants).values({
    targetClerkUserId: params.targetClerkUserId,
    targetDisplayName: params.targetDisplayName,
    targetEmail: params.targetEmail,
    grantedRole: params.grantedRole,
    grantedByClerkUserId: params.grantedByClerkUserId,
    grantedByDisplayName: params.grantedByDisplayName,
  });
}
