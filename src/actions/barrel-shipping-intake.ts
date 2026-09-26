"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { barrelShippingIntakes, barrels } from "@/db/schema";
import { getPrimaryShippingAddress } from "@/data/addresses";
import { ensureBarrelShippingIntakesSchema } from "@/data/ensure-barrel-shipping-intakes-schema";
import {
  getBarrelForShippingIntake,
  cancelShippingIntakeForUser,
  switchShippingIntakeToOwnTransport,
  switchShippingIntakeToSelfClearance,
  updateShippingIntakeRow,
} from "@/data/barrel-shipping-intake";
import { isContainerReadyForShippingIntake } from "@/lib/barrel-shipping-intake";
import {
  findDestinationBroker,
  findDestinationCourier,
} from "@/lib/destination-clearance-partners";
import {
  cancelBarrelShippingIntakeSchema,
  submitBarrelShippingIntakeSchema,
  switchBarrelShippingIntakeToOwnTransportSchema,
  switchBarrelShippingIntakeToSelfClearanceSchema,
  updateBarrelShippingIntakeSchema,
} from "@/lib/validations/barrel-shipping-intake";

export type SubmitBarrelShippingIntakeState =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export type CancelBarrelShippingIntakeState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function submitBarrelShippingIntakeAction(
  raw: unknown,
): Promise<SubmitBarrelShippingIntakeState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to continue." };
  }

  const parsed = submitBarrelShippingIntakeSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string") {
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
    }
    return {
      ok: false,
      message: "Choose how you will clear customs at the destination.",
      fieldErrors,
    };
  }

  const courierKey = parsed.data.courierKey?.trim() || null;
  const brokerKey = parsed.data.brokerKey?.trim() || null;
  const { barrelId, deliveryMethod } = parsed.data;

  const row = await getBarrelForShippingIntake(userId, barrelId);
  if (!row) {
    return { ok: false, message: "Container not found." };
  }

  if (row.intake) {
    return {
      ok: false,
      message: "This container was already confirmed for shipping charges.",
    };
  }

  if (
    !isContainerReadyForShippingIntake({
      status: row.barrel.status,
      capacityPercentage: row.barrel.capacityPercentage,
    })
  ) {
    return {
      ok: false,
      message:
        "This container is not full yet. Shipping options unlock at 100% load or when marked ready to ship.",
    };
  }

  const shippingAddress = await getPrimaryShippingAddress(userId);
  const destinationCountry = shippingAddress?.country?.trim() || null;
  if (!destinationCountry) {
    return {
      ok: false,
      message: "Add a destination shipping address before choosing clearance.",
    };
  }

  const courier = findDestinationCourier(courierKey, destinationCountry);
  if (!courier) {
    return {
      ok: false,
      message:
        "Choose a local courier for your destination, or provide your own transportation.",
    };
  }
  const selectedCourierKey = courier.key;

  let selectedBrokerKey: string | null = null;
  if (deliveryMethod === "broker_delivery") {
    const broker = findDestinationBroker(brokerKey, destinationCountry);
    if (!broker) {
      return {
        ok: false,
        message: "Choose a selected broker for your destination country.",
      };
    }
    selectedBrokerKey = broker.key;
  }

  await ensureBarrelShippingIntakesSchema();

  const now = new Date().toISOString();
  const db = getDb();

  await db.insert(barrelShippingIntakes).values({
    barrelId,
    clerkUserId: userId,
    deliveryMethod,
    deliveryAddressId: shippingAddress?.id ?? null,
    contactPhone: shippingAddress?.recipientPhone?.trim() || null,
    specialInstructions: null,
    selectedBrokerKey,
    selectedCourierKey,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/dashboard/shipping");
  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping/pricing");

  return {
    ok: true,
    message:
      "Clearance and courier preferences saved. Open the Pricing tab when staff publish your quote.",
  };
}

export async function cancelBarrelShippingIntakeAction(
  raw: unknown,
): Promise<CancelBarrelShippingIntakeState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to cancel." };
  }

  const parsed = cancelBarrelShippingIntakeSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const result = await cancelShippingIntakeForUser(userId, parsed.data.intakeId);
  if (!result.ok) return result;

  revalidatePath("/dashboard/shipping");
  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping/pricing");

  return {
    ok: true,
    message:
      "Confirmation cancelled. Freight payment stays on this container. Submit broker and local courier receipts again after you reconfirm.",
  };
}

export async function switchBarrelShippingIntakeToSelfClearanceAction(
  raw: unknown,
): Promise<CancelBarrelShippingIntakeState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to continue." };
  }

  const parsed = switchBarrelShippingIntakeToSelfClearanceSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const result = await switchShippingIntakeToSelfClearance(
    userId,
    parsed.data.intakeId,
  );
  if (!result.ok) return result;

  revalidatePath("/dashboard/shipping");
  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping/pricing");

  return {
    ok: true,
    message:
      "You'll clear this container yourself at customs. A broker is no longer required.",
  };
}

export async function switchBarrelShippingIntakeToOwnTransportAction(
  raw: unknown,
): Promise<CancelBarrelShippingIntakeState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to continue." };
  }

  const parsed = switchBarrelShippingIntakeToOwnTransportSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const result = await switchShippingIntakeToOwnTransport(
    userId,
    parsed.data.intakeId,
  );
  if (!result.ok) return result;

  revalidatePath("/dashboard/shipping");
  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping/pricing");

  return {
    ok: true,
    message:
      "You'll provide your own transportation after customs. A local courier is no longer required.",
  };
}

export async function updateBarrelShippingIntakeAction(
  raw: unknown,
): Promise<CancelBarrelShippingIntakeState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to continue." };
  }

  const parsed = updateBarrelShippingIntakeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Choose clearance and transportation.",
    };
  }

  const courierKey = parsed.data.courierKey?.trim() || null;
  const brokerKey = parsed.data.brokerKey?.trim() || null;
  const { intakeId, deliveryMethod } = parsed.data;

  const shippingAddress = await getPrimaryShippingAddress(userId);
  const destinationCountry = shippingAddress?.country?.trim() || null;
  const courier = findDestinationCourier(courierKey, destinationCountry);
  if (!courier) {
    return {
      ok: false,
      message:
        "Choose a local courier for your destination, or provide your own transportation.",
    };
  }

  let selectedBrokerKey: string | null = null;
  if (deliveryMethod === "broker_delivery") {
    const broker = findDestinationBroker(brokerKey, destinationCountry);
    if (!broker) {
      return {
        ok: false,
        message: "Choose a selected broker for your destination country.",
      };
    }
    selectedBrokerKey = broker.key;
  }

  const result = await updateShippingIntakeRow(userId, {
    intakeId,
    deliveryMethod,
    selectedBrokerKey,
    selectedCourierKey: courier.key,
  });
  if (!result.ok) return result;

  revalidatePath("/dashboard/shipping");
  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping/pricing");

  return { ok: true, message: "Clearance and transportation updated." };
}
