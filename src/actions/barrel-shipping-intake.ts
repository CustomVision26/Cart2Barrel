"use server";

import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { barrelShippingIntakes } from "@/db/schema";
import { getPrimaryShippingAddress } from "@/data/addresses";
import { ensureBarrelShippingIntakesSchema } from "@/data/ensure-barrel-shipping-intakes-schema";
import {
  cancelShippingIntakeForUser,
  getBarrelForShippingIntake,
  switchShippingIntakeToOwnTransport,
  switchShippingIntakeToSelfClearance,
  updateShippingIntakeRow,
} from "@/data/barrel-shipping-intake";
import {
  findDestinationBroker,
  isAllowedCustomerCourierKey,
  isOwnTransportCourierKey,
  OWN_TRANSPORT_COURIER_KEY,
  PUBLISHED_BROKER_KEY,
  PUBLISHED_COURIER_KEY,
} from "@/lib/destination-clearance-partners";
import {
  destinationClearancePresentation,
} from "@/lib/barrel-outbound-shipping-charge";
import { getOutboundShippingChargesByBarrelIds } from "@/data/barrel-outbound-shipping-charges";
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

async function resolveClearanceForBarrel(
  clerkUserId: string,
  barrelId: string,
  destinationCountry: string | null,
  input: {
    deliveryMethod: "customs_pickup" | "broker_delivery";
    brokerKey: string | null;
    courierKey: string | null;
  },
): Promise<
  | {
      ok: true;
      deliveryMethod: "customs_pickup" | "broker_delivery";
      selectedBrokerKey: string | null;
      selectedCourierKey: string | null;
    }
  | { ok: false; message: string }
> {
  const byBarrel = await getOutboundShippingChargesByBarrelIds(clerkUserId, [
    barrelId,
  ]);
  const presentation = destinationClearancePresentation(
    byBarrel.get(barrelId) ?? [],
    destinationCountry,
  );

  let deliveryMethod = input.deliveryMethod;
  let selectedBrokerKey: string | null = null;
  let selectedCourierKey: string | null = null;

  if (presentation.brokerAbsorbed) {
    deliveryMethod = "broker_delivery";
    selectedBrokerKey = PUBLISHED_BROKER_KEY;
  } else if (deliveryMethod === "broker_delivery") {
    const broker = findDestinationBroker(input.brokerKey, destinationCountry);
    if (!broker) {
      return {
        ok: false,
        message: "Choose a selected broker for your destination country.",
      };
    }
    selectedBrokerKey = broker.key;
  }

  if (presentation.courierAbsorbed) {
    selectedCourierKey = PUBLISHED_COURIER_KEY;
  } else if (
    !presentation.courierAbsorbed &&
    presentation.publishedCouriers.length > 0
  ) {
    if (!isAllowedCustomerCourierKey(input.courierKey)) {
      return {
        ok: false,
        message:
          "Choose whether to use the published courier or your own transportation.",
      };
    }
    selectedCourierKey = isOwnTransportCourierKey(input.courierKey)
      ? OWN_TRANSPORT_COURIER_KEY
      : PUBLISHED_COURIER_KEY;
  } else {
    selectedCourierKey = isOwnTransportCourierKey(input.courierKey)
      ? OWN_TRANSPORT_COURIER_KEY
      : null;
  }

  return {
    ok: true,
    deliveryMethod,
    selectedBrokerKey,
    selectedCourierKey,
  };
}

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
  const { barrelId, deliveryMethod: requestedDeliveryMethod } = parsed.data;
  const barrelIds = [
    ...new Set([barrelId, ...(parsed.data.alsoConfirmBarrelIds ?? [])]),
  ];

  const shippingAddress = await getPrimaryShippingAddress(userId);
  const destinationCountry = shippingAddress?.country?.trim() || null;
  if (!destinationCountry) {
    return {
      ok: false,
      message: "Add a destination shipping address before choosing clearance.",
    };
  }

  const toInsert: {
    barrelId: string;
    deliveryMethod: "customs_pickup" | "broker_delivery";
    selectedBrokerKey: string | null;
    selectedCourierKey: string | null;
  }[] = [];

  for (const id of barrelIds) {
    const row = await getBarrelForShippingIntake(userId, id);
    if (!row) {
      return { ok: false, message: "Container not found." };
    }
    if (row.intake) {
      if (id === barrelId) {
        return {
          ok: false,
          message: "This container was already confirmed for shipping charges.",
        };
      }
      continue;
    }
    if (row.barrel.status === "shipped" || row.barrel.status === "delivered") {
      return {
        ok: false,
        message: "This container has already shipped.",
      };
    }

    const resolved = await resolveClearanceForBarrel(
      userId,
      id,
      destinationCountry,
      {
        deliveryMethod: requestedDeliveryMethod,
        brokerKey,
        courierKey,
      },
    );
    if (!resolved.ok) {
      return resolved;
    }
    toInsert.push({
      barrelId: id,
      deliveryMethod: resolved.deliveryMethod,
      selectedBrokerKey: resolved.selectedBrokerKey,
      selectedCourierKey: resolved.selectedCourierKey,
    });
  }

  if (toInsert.length === 0) {
    return {
      ok: false,
      message: "These containers were already confirmed for shipping charges.",
    };
  }

  await ensureBarrelShippingIntakesSchema();

  const now = new Date().toISOString();
  const db = getDb();

  await db.insert(barrelShippingIntakes).values(
    toInsert.map((item) => ({
      barrelId: item.barrelId,
      clerkUserId: userId,
      deliveryMethod: item.deliveryMethod,
      deliveryAddressId: shippingAddress?.id ?? null,
      contactPhone: shippingAddress?.recipientPhone?.trim() || null,
      specialInstructions: null,
      selectedBrokerKey: item.selectedBrokerKey,
      selectedCourierKey: item.selectedCourierKey,
      createdAt: now,
      updatedAt: now,
    })),
  );

  revalidatePath("/dashboard/shipping");
  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping/pricing");

  const count = toInsert.length;
  return {
    ok: true,
    message:
      count > 1
        ? `Clearance and courier preferences saved for ${count} containers. Open the Pricing tab when staff publish your quote.`
        : "Clearance and courier preferences saved. Open the Pricing tab when staff publish your quote.",
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

  const intakeIds = [
    ...new Set([parsed.data.intakeId, ...(parsed.data.alsoIntakeIds ?? [])]),
  ];
  for (const intakeId of intakeIds) {
    const result = await cancelShippingIntakeForUser(userId, intakeId);
    if (!result.ok && intakeId === parsed.data.intakeId) return result;
  }

  revalidatePath("/dashboard/shipping");
  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping/pricing");

  return {
    ok: true,
    message:
      intakeIds.length > 1
        ? "Confirmation cancelled for the linked containers. Freight payment stays. Submit broker and local courier receipts again after you reconfirm."
        : "Confirmation cancelled. Freight payment stays on this container. Submit broker and local courier receipts again after you reconfirm.",
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
  const { intakeId, deliveryMethod: requestedDeliveryMethod } = parsed.data;

  const shippingAddress = await getPrimaryShippingAddress(userId);
  const destinationCountry = shippingAddress?.country?.trim() || null;

  const [intakeRow] = await getDb()
    .select({
      barrelId: barrelShippingIntakes.barrelId,
    })
    .from(barrelShippingIntakes)
    .where(
      and(
        eq(barrelShippingIntakes.id, intakeId),
        eq(barrelShippingIntakes.clerkUserId, userId),
      )!,
    )
    .limit(1);
  const barrelId = intakeRow?.barrelId;
  if (!barrelId) {
    return { ok: false, message: "Submitted preferences not found." };
  }

  const resolved = await resolveClearanceForBarrel(
    userId,
    barrelId,
    destinationCountry,
    {
      deliveryMethod: requestedDeliveryMethod,
      brokerKey,
      courierKey,
    },
  );
  if (!resolved.ok) {
    return resolved;
  }

  const result = await updateShippingIntakeRow(userId, {
    intakeId,
    deliveryMethod: resolved.deliveryMethod,
    selectedBrokerKey: resolved.selectedBrokerKey,
    selectedCourierKey: resolved.selectedCourierKey,
  });
  if (!result.ok) return result;

  revalidatePath("/dashboard/shipping");
  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping/pricing");

  return { ok: true, message: "Clearance and transportation updated." };
}
