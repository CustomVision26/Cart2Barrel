"use server";

import { revalidatePath } from "next/cache";

import {
  addOutboundShippingCompanyRate,
  deleteOutboundShippingCompanyRate,
  updateOutboundShippingCompanyRate,
} from "@/data/outbound-shipping-company-rates";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { safeCurrentUser } from "@/lib/safe-current-user";
import {
  addOutboundShippingCompanyRateSchema,
  deleteOutboundShippingCompanyRateSchema,
  parseUsdInputToNonNegativeCents,
  updateOutboundShippingCompanyRateSchema,
} from "@/lib/validations/barrel-outbound-shipping-charge";

export type OutboundShippingCompanyRateActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

function revalidateRatePaths() {
  revalidatePath("/admin/shipments");
  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/shipping/pricing");
  revalidatePath("/dashboard/cart");
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
    tableKind: parsed.data.tableKind,
    rowLabel: parsed.data.rowLabel,
    costOneCents,
    costTwoPlusCents,
  });
  if (!result.ok) return result;
  revalidateRatePaths();
  return { ok: true, message: "Pricing row added." };
}

export async function updateOutboundShippingCompanyRateAction(
  raw: unknown,
): Promise<OutboundShippingCompanyRateActionState> {
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
    rowLabel: parsed.data.rowLabel,
    costOneCents,
    costTwoPlusCents,
  });
  if (!result.ok) return result;
  revalidateRatePaths();
  return { ok: true, message: "Pricing row updated." };
}

export async function deleteOutboundShippingCompanyRateAction(
  raw: unknown,
): Promise<OutboundShippingCompanyRateActionState> {
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
}
