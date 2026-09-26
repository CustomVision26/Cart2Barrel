"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";

import {
  clearCustomsDeclarationFormUrl,
  saveShipmentCustomsClearance,
  updateShipmentTrackingStage,
} from "@/data/barrel-outbound-shipment-tracking";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  adminRemoveCustomsDeclarationFormSchema,
  adminSaveBarrelShipmentCustomsSchema,
  adminUpdateBarrelShipmentStageSchema,
  type AdminRemoveCustomsDeclarationFormInput,
  type AdminSaveBarrelShipmentCustomsInput,
  type AdminUpdateBarrelShipmentStageInput,
} from "@/lib/validations/barrel-shipment-tracking";
import { getBlobReadWriteToken } from "@/lib/vercel-blob-env";

export type AdminBarrelShipmentActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function adminUpdateBarrelShipmentStageAction(
  input: AdminUpdateBarrelShipmentStageInput,
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
  input: AdminSaveBarrelShipmentCustomsInput,
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

  return {
    ok: true,
    message:
      "Customs clearance info saved. The customer can now download the clearance pack.",
  };
}

export async function adminRemoveCustomsDeclarationFormAction(
  input: AdminRemoveCustomsDeclarationFormInput,
): Promise<AdminBarrelShipmentActionResult> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = adminRemoveCustomsDeclarationFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid container." };
  }

  const previousUrl = await clearCustomsDeclarationFormUrl(parsed.data.barrelId);
  if (previousUrl) {
    const token = getBlobReadWriteToken();
    if (token) {
      try {
        await del(previousUrl, { token });
      } catch {
        // The database reference is already cleared.
      }
    }
  }

  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/shipping/pricing");

  return { ok: true, message: "Uploaded customs form removed." };
}
