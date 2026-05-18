"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import {
  deleteCustomerPricingPackage,
  getCustomerPricingPackage,
  upsertCustomerPricingPackage,
} from "@/data/customer-pricing-packages";
import { getProfileByClerkId } from "@/data/profiles";
import {
  listUserContainerCartWithOfferings,
  sumContainerCartQuantitiesByKind,
} from "@/data/user-container-cart";
import { upsertAppliedCartContainerPackingFees } from "@/data/user-cart-container-packing";
import { computeContainerPackingFeeBreakdown } from "@/lib/container-packing-fee";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  deleteCustomerPricingPackageSchema,
  saveCustomerPricingPackageSchema,
} from "@/lib/validations/customer-pricing-package";

export type CustomerPricingPackageActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function saveCustomerPricingPackageAction(
  raw: unknown,
): Promise<CustomerPricingPackageActionState> {
  const cu = await currentUser();
  if (!isClerkAdmin(cu)) {
    return { ok: false, message: "Admin access required." };
  }
  const adminId = cu!.id;

  const parsed = saveCustomerPricingPackageSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid package data.";
    return { ok: false, message: first };
  }

  const d = parsed.data;
  const profile = await getProfileByClerkId(d.clerkUserId);
  if (!profile) {
    return { ok: false, message: "Customer profile not found." };
  }

  const label =
    d.label != null && d.label.trim() !== "" ? d.label.trim() : null;
  const serviceTiers =
    d.overrideServiceTiers ?
      [...d.tiers].sort(
        (a, b) => a.maxUnitPriceInclusiveCents - b.maxUnitPriceInclusiveCents,
      )
    : null;

  try {
    await upsertCustomerPricingPackage({
      clerkUserId: d.clerkUserId,
      label,
      packingFeePerLineCents: d.packingFeePerLineCents,
      containerPackingRates: d.containerPackingRates,
      serviceTiers,
      updatedByClerkUserId: adminId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save package.";
    return {
      ok: false,
      message:
        msg.includes("customer_pricing_packages") ?
          "Database is missing customer pricing tables. Run migration 0037 or npm run db:push."
        : msg,
    };
  }

  revalidatePath("/admin/overview");
  revalidatePath("/dashboard/cart");
  revalidatePath("/admin/item-requests", "layout");
  return { ok: true, message: "Customer pricing package saved." };
}

export async function applyCustomerPackagePackingToCartAction(
  raw: unknown,
): Promise<CustomerPricingPackageActionState> {
  const cu = await currentUser();
  if (!isClerkAdmin(cu)) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = deleteCustomerPricingPackageSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid customer id." };
  }

  const clerkUserId = parsed.data.clerkUserId;
  const pkg = await getCustomerPricingPackage(clerkUserId);
  if (!pkg) {
    return { ok: false, message: "No custom package saved for this customer." };
  }

  const cartRows = await listUserContainerCartWithOfferings(clerkUserId);
  const { barrelCount, binCount } = sumContainerCartQuantitiesByKind(cartRows);
  if (barrelCount === 0 && binCount === 0) {
    return {
      ok: false,
      message:
        "This customer has no barrels or bins in their cart. Add containers on Barrels first.",
    };
  }

  const breakdown = computeContainerPackingFeeBreakdown(
    barrelCount,
    binCount,
    pkg.containerPackingRates,
  );

  try {
    await upsertAppliedCartContainerPackingFees({
      clerkUserId,
      breakdown,
      appliedByClerkUserId: cu!.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not apply packing fees.";
    return {
      ok: false,
      message:
        msg.includes("user_cart_container_packing_fees") ?
          "Database is missing cart packing table. Run migration 0038 or npm run db:push."
        : msg,
    };
  }

  revalidatePath("/admin/overview");
  revalidatePath("/dashboard/cart");

  const parts: string[] = [];
  if (breakdown.barrelPackingFeeCents > 0) {
    parts.push(
      `barrel packing ${(breakdown.barrelPackingFeeCents / 100).toFixed(2)} (${barrelCount} barrel${barrelCount === 1 ? "" : "s"})`,
    );
  }
  if (breakdown.binPackingFeeCents > 0) {
    parts.push(
      `bin packing ${(breakdown.binPackingFeeCents / 100).toFixed(2)} (${binCount} bin${binCount === 1 ? "" : "s"})`,
    );
  }

  return {
    ok: true,
    message: `Packing charges applied to cart (${parts.join(", ")}). Total add-on: $${(breakdown.totalPackingFeeCents / 100).toFixed(2)}.`,
  };
}

export async function deleteCustomerPricingPackageAction(
  raw: unknown,
): Promise<CustomerPricingPackageActionState> {
  if (!isClerkAdmin(await currentUser())) {
    return { ok: false, message: "Admin access required." };
  }

  const parsed = deleteCustomerPricingPackageSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid customer id." };
  }

  try {
    const removed = await deleteCustomerPricingPackage(parsed.data.clerkUserId);
    if (!removed) {
      return { ok: false, message: "No custom package exists for this customer." };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not remove package.";
    return { ok: false, message: msg };
  }

  revalidatePath("/admin/overview");
  revalidatePath("/dashboard/cart");
  revalidatePath("/admin/item-requests", "layout");
  return { ok: true, message: "Customer now uses global fees & rates." };
}
