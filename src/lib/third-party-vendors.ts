import type { BarrelOutboundShippingChargeView } from "@/lib/barrel-outbound-shipping-charge";
import { isUnitedStatesShippingCountry } from "@/lib/shipping-countries";

export function isUnitedStatesThirdPartyVendor(
  charge: BarrelOutboundShippingChargeView,
): boolean {
  if (charge.chargeKind === "freight") return true;
  return isUnitedStatesShippingCountry(charge.partnerCountry);
}

export function partitionThirdPartyVendorCharges(
  charges: BarrelOutboundShippingChargeView[],
): {
  unitedStates: BarrelOutboundShippingChargeView[];
  overseas: BarrelOutboundShippingChargeView[];
} {
  const unitedStates: BarrelOutboundShippingChargeView[] = [];
  const overseas: BarrelOutboundShippingChargeView[] = [];
  for (const charge of charges) {
    if (isUnitedStatesThirdPartyVendor(charge)) {
      unitedStates.push(charge);
    } else {
      overseas.push(charge);
    }
  }
  return { unitedStates, overseas };
}
