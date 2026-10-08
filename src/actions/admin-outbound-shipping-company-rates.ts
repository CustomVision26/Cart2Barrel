"use server";

import { revalidatePath } from "next/cache";

import {
  addOutboundShippingCompanyRate,
  deleteOutboundShippingCompanyRate,
  updateOutboundShippingCompanyRate,
} from "@/data/outbound-shipping-company-rates";
import { setOutboundShippingCompanyRateLinks } from "@/data/outbound-shipping-company-rate-links";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";
import {
  addOutboundShippingCompanyRateSchema,
  deleteOutboundShippingCompanyRateSchema,
  parseUsdInputToNonNegativeCents,
  setOutboundShippingCompanyRateLinksSchema,
  updateOutboundShippingCompanyRateSchema,
} from "@/lib/validations/barrel-outbound-shipping-charge";

export type OutboundShippingCompanyRateActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

function revalidateRatePaths() {
  revalidatePath("/admin/shipments");
  revalidatePath("/admin/shipments-container-control");
  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/shipping/pricing");
  revalidatePath("/dashboard/cart");
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

export async function addOutboundShippingCompanyRateAction(
  raw: unknown,
): Promise<OutboundShippingCompanyRateActionState> {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    const parsed = addOutboundShippingCompanyRateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid pricing row.",
      };
    }
    const costOneCents = parseUsdInputToNonNegativeCents(parsed.data.costOneUsd);
    const costTwoPlusCents = parseUsdInputToNonNegativeCents(
      parsed.data.costTwoPlusUsd,
    );
    if (costOneCents == null || costTwoPlusCents == null) {
      return { ok: false, message: "Enter valid amounts." };
    }
    const result = await addOutboundShippingCompanyRate({
      companyName: parsed.data.companyName,
      destinationCountry: parsed.data.destinationCountry,
      tableKind: parsed.data.tableKind,
      rowLabel: parsed.data.rowLabel,
      destination: parsed.data.destination,
      costOneCents,
      costTwoPlusCents,
    });
    if (!result.ok) return result;
    revalidateRatePaths();
    return { ok: true, message: "Pricing row added." };
  } catch (e) {
    console.error("[addOutboundShippingCompanyRateAction]", e);
    return { ok: false, message: "Could not save company pricing." };
  }
}

export async function updateOutboundShippingCompanyRateAction(
  raw: unknown,
): Promise<OutboundShippingCompanyRateActionState> {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    const parsed = updateOutboundShippingCompanyRateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid pricing row.",
      };
    }
    const costOneCents = parseUsdInputToNonNegativeCents(parsed.data.costOneUsd);
    const costTwoPlusCents = parseUsdInputToNonNegativeCents(
      parsed.data.costTwoPlusUsd,
    );
    if (costOneCents == null || costTwoPlusCents == null) {
      return { ok: false, message: "Enter valid amounts." };
    }
    const result = await updateOutboundShippingCompanyRate({
      id: parsed.data.id,
      companyName: parsed.data.companyName,
      destinationCountry: parsed.data.destinationCountry,
      rowLabel: parsed.data.rowLabel,
      destination: parsed.data.destination,
      costOneCents,
      costTwoPlusCents,
    });
    if (!result.ok) return result;
    revalidateRatePaths();
    return { ok: true, message: "Pricing row updated." };
  } catch (e) {
    console.error("[updateOutboundShippingCompanyRateAction]", e);
    return { ok: false, message: "Could not update company pricing." };
  }
}

export async function deleteOutboundShippingCompanyRateAction(
  raw: unknown,
): Promise<OutboundShippingCompanyRateActionState> {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    const parsed = deleteOutboundShippingCompanyRateSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Invalid pricing row.",
      };
    }
    const result = await deleteOutboundShippingCompanyRate(parsed.data.id);
    if (!result.ok) return result;
    revalidateRatePaths();
    return { ok: true, message: "Pricing row removed." };
  } catch (e) {
    console.error("[deleteOutboundShippingCompanyRateAction]", e);
    return { ok: false, message: "Could not remove company pricing." };
  }
}

export async function setOutboundShippingCompanyRateLinksAction(
  raw: unknown,
): Promise<OutboundShippingCompanyRateActionState> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const parsed = setOutboundShippingCompanyRateLinksSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid container link.",
    };
  }
  const result = await setOutboundShippingCompanyRateLinks(parsed.data);
  if (!result.ok) return result;
  revalidateRatePaths();
  const count = new Set([
    parsed.data.sourceBarrelId,
    ...parsed.data.linkedBarrelIds,
  ]).size;
  if (count < 2) {
    return {
      ok: true,
      message: "Containers are billed separately at the 1-container rate.",
    };
  }
  return {
    ok: true,
    message: `${count} unpaid containers are linked. The customer pays the 1-container rate once plus the extra-container rate for each additional container. One payment marks all linked containers paid.`,
  };
}
