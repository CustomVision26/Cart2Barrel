"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import {
  barrelItems,
  barrelPackageAssignmentEvents,
  barrels,
  itemRequests,
  orderItems,
  orders,
  packages,
} from "@/db/schema";
import {
  ensurePackagesForAwaitingBarrelOwner,
  getBarrelLabelById,
} from "@/data/barrel-package-assignment";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";
import {
  adminReassignPackageBarrelSchema,
  adminRemovePackageFromBarrelSchema,
  userAssignPackageToBarrelSchema,
} from "@/lib/validations/barrel-package-assignment";

export type BarrelAssignmentActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

function revalidateBarrelAssignmentPaths(): void {
  revalidatePath("/dashboard/barrels");
  revalidatePath("/dashboard/barrels/product-to-barrel");
  revalidatePath("/dashboard/barrels/product-to-barrel-history");
  revalidatePath("/admin/barrels");
  revalidatePath("/admin/barrels/assign-to-barrel");
  revalidatePath("/admin/barrels/assign-to-barrel-history");
}

export async function userAssignPackageToBarrelAction(
  raw: unknown,
): Promise<BarrelAssignmentActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = userAssignPackageToBarrelSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid assignment request." };
  }
  const { packageId, barrelId } = parsed.data;

  await ensurePackagesForAwaitingBarrelOwner(userId);

  const db = getDb();

  const [ctx] = await db
    .select({
      pkg: packages,
      oi: orderItems,
      ord: orders,
      req: itemRequests,
    })
    .from(packages)
    .innerJoin(orderItems, eq(packages.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .where(eq(packages.id, packageId))
    .limit(1);

  if (!ctx || ctx.ord.clerkUserId !== userId) {
    return { ok: false, message: "Package not found." };
  }

  if (ctx.ord.status !== "paid") {
    return { ok: false, message: "Order must be paid before barrel assignment." };
  }

  if (ctx.oi.fulfillmentStatus !== "delivery_received_good_awaiting_barrel") {
    return {
      ok: false,
      message:
        "This product is not in “delivery received: good — awaiting barrel” status.",
    };
  }

  const [barrelRow] = await db
    .select()
    .from(barrels)
    .where(and(eq(barrels.id, barrelId), eq(barrels.clerkUserId, userId))!)
    .limit(1);

  if (!barrelRow) {
    return {
      ok: false,
      message: "Pick one of your paid containers (barrel slots) from the list.",
    };
  }

  if (barrelRow.status !== "filling") {
    return {
      ok: false,
      message: "That container is no longer open for packing. Choose another slot.",
    };
  }

  const existing = await db
    .select({ id: barrelItems.id })
    .from(barrelItems)
    .where(eq(barrelItems.packageId, packageId))
    .limit(1);
  if (existing[0]) {
    return { ok: false, message: "This product is already assigned to a barrel." };
  }

  const toLabel = (await getBarrelLabelById(barrelId)) ?? barrelId;

  const productLabel =
    ctx.req.productName?.trim() || "Unnamed product";

  await db.insert(barrelItems).values({ barrelId, packageId });
  await db.insert(barrelPackageAssignmentEvents).values({
    ownerClerkUserId: userId,
    packageId,
    orderItemId: ctx.oi.id,
    fromBarrelId: null,
    toBarrelId: barrelId,
    action: "assigned",
    actorClerkUserId: userId,
    productNameSnapshot: productLabel,
    barrelLabelSnapshot: toLabel,
    adminNote: null,
  });

  revalidateBarrelAssignmentPaths();
  return { ok: true, message: `Assigned to ${toLabel}.` };
}

export async function adminReassignPackageBarrelAction(
  raw: unknown,
): Promise<BarrelAssignmentActionState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }
  const actorId = cu.user.id;

  const parsed = adminReassignPackageBarrelSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid reassignment data." };
  }
  const { packageId, toBarrelId, adminNote } = parsed.data;
  const db = getDb();

  const [ctx] = await db
    .select({
      pkg: packages,
      oi: orderItems,
      ord: orders,
      req: itemRequests,
    })
    .from(packages)
    .innerJoin(orderItems, eq(packages.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .where(eq(packages.id, packageId))
    .limit(1);

  if (!ctx) {
    return { ok: false, message: "Package not found." };
  }

  if (ctx.oi.fulfillmentStatus !== "delivery_received_good_awaiting_barrel") {
    return {
      ok: false,
      message: "Only lines awaiting barrel can be reassigned here.",
    };
  }

  const [toBarrel] = await db
    .select()
    .from(barrels)
    .where(
      and(
        eq(barrels.id, toBarrelId),
        eq(barrels.clerkUserId, ctx.ord.clerkUserId),
      )!,
    )
    .limit(1);

  if (!toBarrel) {
    return {
      ok: false,
      message: "Target barrel must belong to the same customer as the package.",
    };
  }

  const [existingBi] = await db
    .select()
    .from(barrelItems)
    .where(eq(barrelItems.packageId, packageId))
    .limit(1);

  const fromBarrelId = existingBi?.barrelId ?? null;

  if (existingBi) {
    if (existingBi.barrelId === toBarrelId) {
      return { ok: false, message: "Package is already on that barrel." };
    }
    await db
      .delete(barrelItems)
      .where(eq(barrelItems.packageId, packageId));
  }

  await db.insert(barrelItems).values({ barrelId: toBarrelId, packageId });

  const toLabel = (await getBarrelLabelById(toBarrelId)) ?? toBarrelId;
  const fromLabel = fromBarrelId ?
    ((await getBarrelLabelById(fromBarrelId)) ?? fromBarrelId)
  : null;

  const productLabel =
    ctx.req.productName?.trim() || "Unnamed product";

  await db.insert(barrelPackageAssignmentEvents).values({
    ownerClerkUserId: ctx.ord.clerkUserId,
    packageId,
    orderItemId: ctx.oi.id,
    fromBarrelId,
    toBarrelId,
    action: fromBarrelId ? "reassigned" : "assigned",
    actorClerkUserId: actorId,
    adminNote: adminNote?.trim() || null,
    productNameSnapshot: productLabel,
    barrelLabelSnapshot:
      fromLabel ? `${fromLabel} → ${toLabel}` : `→ ${toLabel}`,
  });

  revalidateBarrelAssignmentPaths();
  return { ok: true, message: "Assignment updated." };
}

export async function adminRemovePackageFromBarrelAction(
  raw: unknown,
): Promise<BarrelAssignmentActionState> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "You do not have admin access." };
  }
  const actorId = cu.user.id;

  const parsed = adminRemovePackageFromBarrelSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid removal request." };
  }
  const { packageId, adminNote } = parsed.data;
  const db = getDb();

  const [ctx] = await db
    .select({
      pkg: packages,
      oi: orderItems,
      ord: orders,
      req: itemRequests,
    })
    .from(packages)
    .innerJoin(orderItems, eq(packages.orderItemId, orderItems.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(itemRequests, eq(orderItems.itemRequestId, itemRequests.id))
    .where(eq(packages.id, packageId))
    .limit(1);

  if (!ctx) {
    return { ok: false, message: "Package not found." };
  }

  const [existingBi] = await db
    .select()
    .from(barrelItems)
    .where(eq(barrelItems.packageId, packageId))
    .limit(1);

  if (!existingBi) {
    return { ok: false, message: "This package is not assigned to a barrel." };
  }

  const fromLabel =
    (await getBarrelLabelById(existingBi.barrelId)) ?? existingBi.barrelId;

  const productLabel =
    ctx.req.productName?.trim() || "Unnamed product";

  await db.delete(barrelItems).where(eq(barrelItems.packageId, packageId));

  await db.insert(barrelPackageAssignmentEvents).values({
    ownerClerkUserId: ctx.ord.clerkUserId,
    packageId,
    orderItemId: ctx.oi.id,
    fromBarrelId: existingBi.barrelId,
    toBarrelId: null,
    action: "removed",
    actorClerkUserId: actorId,
    adminNote: adminNote?.trim() || null,
    productNameSnapshot: productLabel,
    barrelLabelSnapshot: fromLabel,
  });

  revalidateBarrelAssignmentPaths();
  return { ok: true, message: "Removed from barrel." };
}
