"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";

import {
  saveShipmentCustomsClearance,
  updateShipmentTrackingStage,
} from "@/data/barrel-outbound-shipment-tracking";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  adminSaveBarrelShipmentCustomsSchema,
  adminUpdateBarrelShipmentStageSchema,
} from "@/lib/validations/barrel-shipment-tracking";

export type AdminBarrelShipmentActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function adminUpdateBarrelShipmentStageAction(
  input: import("@/lib/validations/barrel-shipment-tracking").AdminUpdateBarrelShipmentStageInput,
): Promise<AdminBarrelShipmentActionResult> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminUpdateBarrelShipmentStageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid shipment stage." };
  }

  await updateShipmentTrackingStage(
    parsed.data.barrelId,
    parsed.data.trackingStage,
  );

  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/shipping/pricing");

  return { ok: true, message: "Shipment stage updated." };
}

export async function adminSaveBarrelShipmentCustomsAction(
  input: import("@/lib/validations/barrel-shipment-tracking").AdminSaveBarrelShipmentCustomsInput,
): Promise<AdminBarrelShipmentActionResult> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminSaveBarrelShipmentCustomsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Check customs fields and try again." };
  }

  const d = parsed.data;
  await saveShipmentCustomsClearance({
    barrelId: d.barrelId,
    freightCompanyName: d.freightCompanyName,
    freightDropOffAt: new Date(d.freightDropOffAt).toISOString(),
    estimatedArrivalAt: new Date(d.estimatedArrivalAt).toISOString(),
    customsDeclarationFormUrl: d.customsDeclarationFormUrl,
    advanceStageAfterSave: true,
  });

  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/shipping/pricing");

  return { ok: true, message: "Customs clearance info saved." };
}
