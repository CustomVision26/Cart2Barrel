"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { barrels } from "@/db/schema";
import { getBarrelLabelById } from "@/data/barrel-package-assignment";
import type { BarrelAssignmentActionState } from "@/lib/barrel-assignment-action-state";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";
import {
  adminMarkBarrelContainerFullSchema,
  adminUpdateBarrelCapacitySchema,
} from "@/lib/validations/barrel-package-assignment";

function revalidateBarrelAssignmentPaths(): void {
  revalidatePath("/dashboard/barrels");
  revalidatePath("/dashboard/barrels/product-to-barrel");
  revalidatePath("/dashboard/barrels/product-to-barrel-history");
  revalidatePath("/admin/barrels");
  revalidatePath("/admin/barrels/assign-to-barrel");
  revalidatePath("/admin/barrels/assign-to-barrel-history");
}

export async function adminUpdateBarrelCapacityAction(
  raw: unknown,
): Promise<BarrelAssignmentActionState> {
  try {
    const cu = await safeCurrentUser();
    if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
      return { ok: false, message: "You do not have admin access." };
    }

    const parsed = adminUpdateBarrelCapacitySchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "Invalid progress value." };
    }
    const { barrelId, capacityPercentage } = parsed.data;
    const db = getDb();

    const [barrelRow] = await db
      .select()
      .from(barrels)
      .where(eq(barrels.id, barrelId))
      .limit(1);

    if (!barrelRow) {
      return { ok: false, message: "Container not found." };
    }

    if (barrelRow.status !== "filling") {
      return {
        ok: false,
        message: "Progress can only be edited while the container is open for packing.",
      };
    }

    await db
      .update(barrels)
      .set({ capacityPercentage })
      .where(eq(barrels.id, barrelId));

    const label = (await getBarrelLabelById(barrelId)) ?? barrelId;

    revalidateBarrelAssignmentPaths();
    return {
      ok: true,
      message: `${label} load set to ${capacityPercentage}%.`,
    };
  } catch {
    return {
      ok: false,
      message: "Could not update container progress. Try again.",
    };
  }
}

export async function adminMarkBarrelContainerFullAction(
  raw: unknown,
): Promise<BarrelAssignmentActionState> {
  try {
    const cu = await safeCurrentUser();
    if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
      return { ok: false, message: "You do not have admin access." };
    }

    const parsed = adminMarkBarrelContainerFullSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "Invalid container request." };
    }
    const { barrelId } = parsed.data;
    const db = getDb();

    const [barrelRow] = await db
      .select()
      .from(barrels)
      .where(eq(barrels.id, barrelId))
      .limit(1);

    if (!barrelRow) {
      return { ok: false, message: "Container not found." };
    }

    if (barrelRow.status !== "filling") {
      return {
        ok: false,
        message: "Only containers open for packing can be marked full.",
      };
    }

    await db
      .update(barrels)
      .set({
        status: "ready_to_ship",
        capacityPercentage: 100,
      })
      .where(eq(barrels.id, barrelId));

    const label = (await getBarrelLabelById(barrelId)) ?? barrelId;

    revalidateBarrelAssignmentPaths();
    return {
      ok: true,
      message: `${label} marked full and ready to ship.`,
    };
  } catch {
    return {
      ok: false,
      message: "Could not mark container full. Try again.",
    };
  }
}
