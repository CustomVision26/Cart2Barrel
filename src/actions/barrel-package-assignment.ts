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
import { getBarrelLabelById } from "@/data/barrel-package-assignment";
import { ensureInBarrelAwaitingShippingEnumValue } from "@/data/ensure-in-barrel-fulfillment-enum";
import {
  BARREL_PIPELINE_AWAITING_ASSIGNMENT,
  BARREL_PIPELINE_IN_CONTAINER,
  BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID,
  isProductToBarrelFulfillmentStatus,
} from "@/lib/barrel-pipeline-fulfillment";
import { isOutsidePurchaseRequest } from "@/lib/outside-purchase";
import type { BarrelAssignmentActionState } from "@/lib/barrel-assignment-action-state";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";
import {
  adminReassignPackageBarrelSchema,
  adminRemovePackageFromBarrelSchema,
} from "@/lib/validations/barrel-package-assignment";

async function setOrderItemBarrelPipelineFulfillment(
  orderItemId: string,
  status:
    | typeof BARREL_PIPELINE_AWAITING_ASSIGNMENT
    | typeof BARREL_PIPELINE_IN_CONTAINER
    | typeof BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID,
): Promise<void> {
  if (status === BARREL_PIPELINE_IN_CONTAINER) {
    const ready = await ensureInBarrelAwaitingShippingEnumValue();
    if (!ready) {
      throw new Error(
        "Database is missing fulfillment status in_barrel_awaiting_shipping. Run npm run db:push.",
      );
    }
  }
  const db = getDb();
  await db
    .update(orderItems)
    .set({ fulfillmentStatus: status })
    .where(eq(orderItems.id, orderItemId));
}

function revalidateBarrelAssignmentPaths(): void {
  revalidatePath("/dashboard/barrels");
  revalidatePath("/dashboard/barrels/product-to-barrel");
  revalidatePath("/dashboard/barrels/product-to-barrel-history");
  revalidatePath("/admin/barrels");
  revalidatePath("/admin/barrels/assign-to-barrel");
  revalidatePath("/admin/barrels/assign-to-barrel-history");
}

export async function userAssignPackageToBarrelAction(
  _raw: unknown,
): Promise<BarrelAssignmentActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  return {
    ok: false,
    message:
      "Container assignment is handled by staff. View your assignment status on this page.",
  };
}

export async function userUnassignPackageFromBarrelAction(
  _raw: unknown,
): Promise<BarrelAssignmentActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  return {
    ok: false,
    message: "Container changes are handled by staff. Contact support if you need a move.",
  };
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
      oi: {
        id: orderItems.id,
        fulfillmentStatus: orderItems.fulfillmentStatus,
      },
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

  if (!isProductToBarrelFulfillmentStatus(ctx.oi.fulfillmentStatus)) {
    return {
      ok: false,
      message: "This product is not in the barrel packing pipeline.",
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

  if (toBarrel.status !== "filling") {
    return {
      ok: false,
      message: "That container is not open for packing (already marked full or shipped).",
    };
  }

  if (toBarrel.capacityPercentage >= 100) {
    return {
      ok: false,
      message: "That container is at 100% load. Mark it full or lower progress before assigning more items.",
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

  await setOrderItemBarrelPipelineFulfillment(
    ctx.oi.id,
    BARREL_PIPELINE_IN_CONTAINER,
  );

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
  return {
    ok: true,
    message: fromBarrelId ? "Assignment updated." : `Assigned to ${toLabel}.`,
  };
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
      oi: {
        id: orderItems.id,
        fulfillmentStatus: orderItems.fulfillmentStatus,
      },
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

  const revertStatus = isOutsidePurchaseRequest(ctx.req) ?
    BARREL_PIPELINE_OUTSIDE_PURCHASE_PAID
  : BARREL_PIPELINE_AWAITING_ASSIGNMENT;

  await setOrderItemBarrelPipelineFulfillment(ctx.oi.id, revertStatus);

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
  return {
    ok: true,
    message: "Removed from container. Status reverted to awaiting barrel assignment.",
  };
}
