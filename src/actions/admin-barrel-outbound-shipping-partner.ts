"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { barrels } from "@/db/schema";
import {
  addOutboundShippingPartner,
  applyCatalogPartnerToBarrel,
  deleteOutboundShippingPartner,
  setOutboundShippingPartnerPrimary,
  updateOutboundShippingPartner,
} from "@/data/barrel-outbound-shipping-partners";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";
import {
  addBarrelOutboundShippingPartnerSchema,
  applyCatalogOutboundShippingPartnerSchema,
  deleteBarrelOutboundShippingPartnerSchema,
  setBarrelOutboundShippingPartnerPrimarySchema,
  updateBarrelOutboundShippingPartnerSchema,
} from "@/lib/validations/barrel-outbound-shipping-charge";

export type OutboundShippingPartnerActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

function revalidatePartnerPaths() {
  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/shipping/pricing");
}

async function requireAdmin(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const cu = await safeCurrentUser();
  if (!cu.ok || !cu.user || !isClerkAdmin(cu.user)) {
    return { ok: false, message: "Admin access required." };
  }
  return { ok: true };
}

export async function addBarrelOutboundShippingPartnerAction(
  raw: unknown,
): Promise<OutboundShippingPartnerActionState> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = addBarrelOutboundShippingPartnerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const db = getDb();
  const [barrel] = await db
    .select({ id: barrels.id })
    .from(barrels)
    .where(eq(barrels.id, parsed.data.barrelId))
    .limit(1);
  if (!barrel) {
    return { ok: false, message: "Container not found." };
  }

  await addOutboundShippingPartner({
    barrelId: parsed.data.barrelId,
    chargeKind: parsed.data.chargeKind,
    name: parsed.data.name,
    location: parsed.data.location.trim() || null,
    address: parsed.data.address.trim() || null,
    country: parsed.data.country.trim() || null,
    phone: parsed.data.phone.trim() || null,
    cashappId: parsed.data.cashappId.trim() || null,
    cashappAccount: parsed.data.cashappAccount.trim() || null,
    zelleId: parsed.data.zelleId.trim() || null,
    zelleAccount: parsed.data.zelleAccount.trim() || null,
    isPrimary: parsed.data.isPrimary,
  });

  revalidatePartnerPaths();
  return { ok: true, message: "Record saved." };
}

export async function updateBarrelOutboundShippingPartnerAction(
  raw: unknown,
): Promise<OutboundShippingPartnerActionState> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = updateBarrelOutboundShippingPartnerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const result = await updateOutboundShippingPartner({
    id: parsed.data.id,
    name: parsed.data.name,
    location: parsed.data.location.trim() || null,
    address: parsed.data.address.trim() || null,
    country: parsed.data.country.trim() || null,
    phone: parsed.data.phone.trim() || null,
    cashappId: parsed.data.cashappId.trim() || null,
    cashappAccount: parsed.data.cashappAccount.trim() || null,
    zelleId: parsed.data.zelleId.trim() || null,
    zelleAccount: parsed.data.zelleAccount.trim() || null,
    isPrimary: parsed.data.isPrimary,
  });
  if (!result.ok) return result;

  revalidatePartnerPaths();
  return { ok: true, message: "Record updated." };
}

export async function setBarrelOutboundShippingPartnerPrimaryAction(
  raw: unknown,
): Promise<OutboundShippingPartnerActionState> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = setBarrelOutboundShippingPartnerPrimarySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const result = await setOutboundShippingPartnerPrimary(parsed.data.id);
  if (!result.ok) return result;

  revalidatePartnerPaths();
  return { ok: true, message: "Primary record updated." };
}

export async function applyCatalogOutboundShippingPartnerAction(
  raw: unknown,
): Promise<OutboundShippingPartnerActionState> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = applyCatalogOutboundShippingPartnerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const db = getDb();
  const [barrel] = await db
    .select({ id: barrels.id })
    .from(barrels)
    .where(eq(barrels.id, parsed.data.barrelId))
    .limit(1);
  if (!barrel) {
    return { ok: false, message: "Container not found." };
  }

  const result = await applyCatalogPartnerToBarrel(parsed.data);
  if (!result.ok) return result;

  revalidatePartnerPaths();
  return { ok: true, message: "Company added to this container." };
}

export async function deleteBarrelOutboundShippingPartnerAction(
  raw: unknown,
): Promise<OutboundShippingPartnerActionState> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = deleteBarrelOutboundShippingPartnerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const result = await deleteOutboundShippingPartner(parsed.data.id);
  if (!result.ok) return result;

  revalidatePartnerPaths();
  return { ok: true, message: "Record removed." };
}
