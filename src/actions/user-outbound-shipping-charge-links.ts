"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { getBarrelForShippingIntake } from "@/data/barrel-shipping-intake";
import { getOutboundShippingChargesByBarrelIds } from "@/data/barrel-outbound-shipping-charges";
import { setOutboundShippingCompanyRateLinks } from "@/data/outbound-shipping-company-rate-links";
import {
  customerCompanyLinkKinds,
  isOffPlatformPaymentPendingReview,
  isOutboundChargeKindAbsorbed,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  setCustomerOutboundChargeLinksSchema,
  type SetCustomerOutboundChargeLinksInput,
} from "@/lib/validations/barrel-outbound-shipping-charge";

export type CustomerOutboundChargeLinksActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function setCustomerOutboundChargeLinksAction(
  raw: SetCustomerOutboundChargeLinksInput,
): Promise<CustomerOutboundChargeLinksActionState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = setCustomerOutboundChargeLinksSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid container link.",
    };
  }

  const owned = await getBarrelForShippingIntake(
    userId,
    parsed.data.sourceBarrelId,
  );
  if (!owned) {
    return { ok: false, message: "Container not found." };
  }

  const byBarrel = await getOutboundShippingChargesByBarrelIds(userId, [
    parsed.data.sourceBarrelId,
  ]);
  const charges = byBarrel.get(parsed.data.sourceBarrelId) ?? [];
  const bundle = charges[0]?.chargeBundle ?? [];
  if (charges.some(isOffPlatformPaymentPendingReview)) {
    return {
      ok: false,
      message:
        "Cancel confirmation to add or remove containers on this card while a payment is awaiting verification. You can still link this container from another card.",
    };
  }
  if (isOutboundChargeKindAbsorbed(parsed.data.kind, bundle)) {
    return {
      ok: false,
      message:
        "This charge is billed with freight and cannot be linked separately.",
    };
  }

  const companyName =
    charges.find(
      (charge) =>
        charge.chargeKind === parsed.data.kind &&
        !charge.paidAt &&
        Boolean(charge.partnerName?.trim()),
    )?.partnerName?.trim() ?? "";
  if (!companyName) {
    return {
      ok: false,
      message: "A published company is required before containers can be linked.",
    };
  }

  const result = await setOutboundShippingCompanyRateLinks({
    sourceBarrelId: parsed.data.sourceBarrelId,
    companyName,
    kinds: customerCompanyLinkKinds({
      kind: parsed.data.kind,
      bundle,
    }),
    linkedBarrelIds: parsed.data.linkedBarrelIds,
  });
  if (!result.ok) return result;

  revalidatePath("/dashboard/shipping");
  revalidatePath("/dashboard/shipping/pricing");
  revalidatePath("/dashboard/cart");
  revalidatePath("/admin/shipments");

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
    message: `${count} unpaid containers are linked. One payment covers the 1-container rate plus the extra-container rate for each additional container.`,
  };
}
