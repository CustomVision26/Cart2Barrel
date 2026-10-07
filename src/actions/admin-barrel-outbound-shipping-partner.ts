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
  setOutboundShippingPartnerPublicPricing,
  updateOutboundShippingPartner,
  setOutboundCompanyCustomerNote,
} from "@/data/barrel-outbound-shipping-partners";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { isAdminShippingCatalogPreviewBarrelId } from "@/lib/barrel-outbound-shipping-charge";
import { safeCurrentUser } from "@/lib/safe-current-user";
import {
  addBarrelOutboundShippingPartnerSchema,
  applyCatalogOutboundShippingPartnerSchema,
  deleteBarrelOutboundShippingPartnerSchema,
  setBarrelOutboundShippingPartnerPrimarySchema,
  setOutboundShippingPartnerPublicPricingSchema,
  updateBarrelOutboundShippingPartnerSchema,
  setOutboundCompanyCustomerNoteSchema,
} from "@/lib/validations/barrel-outbound-shipping-charge";

export type OutboundShippingPartnerActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

function revalidatePartnerPaths() {
  revalidatePath("/admin/shipments");
  revalidatePath("/admin/shipments-container-control");
  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/shipping/pricing");
  revalidatePath("/how-it-works");
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

  const catalogOnly = isAdminShippingCatalogPreviewBarrelId(
    parsed.data.barrelId,
  );
  if (!catalogOnly) {
    const db = getDb();
    const [barrel] = await db
      .select({ id: barrels.id })
      .from(barrels)
      .where(eq(barrels.id, parsed.data.barrelId!))
      .limit(1);
    if (!barrel) {
      return { ok: false, message: "Container not found." };
    }
  }

  await addOutboundShippingPartner({
    barrelId: catalogOnly ? null : parsed.data.barrelId!,
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
    imageUrl: parsed.data.imageUrl.trim() || null,
    isPrimary: parsed.data.isPrimary,
  });

  revalidatePartnerPaths();
  return {
    ok: true,
    message: catalogOnly
      ? "Company saved. It will be available when a customer has a container."
      : "Record saved.",
  };
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
    imageUrl: parsed.data.imageUrl.trim() || null,
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

  const result = await setOutboundShippingPartnerPrimary(parsed.data.id, {
    catalog: parsed.data.catalog,
  });
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

  if (isAdminShippingCatalogPreviewBarrelId(parsed.data.barrelId)) {
    return {
      ok: false,
      message: "Pick a customer container before applying this company.",
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

export async function setOutboundShippingPartnerPublicPricingAction(
  raw: unknown,
): Promise<OutboundShippingPartnerActionState> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = setOutboundShippingPartnerPublicPricingSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const result = await setOutboundShippingPartnerPublicPricing(parsed.data);
  if (!result.ok) return result;

  revalidatePartnerPaths();
  return {
    ok: true,
    message: parsed.data.published
      ? "Company published on How it works → Pricing overview."
      : "Company removed from How it works pricing.",
  };
}

export async function setOutboundCompanyCustomerNoteAction(
  raw: unknown,
): Promise<OutboundShippingPartnerActionState> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const parsed = setOutboundCompanyCustomerNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const result = await setOutboundCompanyCustomerNote({
    companyName: parsed.data.companyName,
    customerNote: parsed.data.customerNote,
  });
  if (!result.ok) return result;

  revalidatePartnerPaths();
  return { ok: true, message: "Company service note saved." };
}
