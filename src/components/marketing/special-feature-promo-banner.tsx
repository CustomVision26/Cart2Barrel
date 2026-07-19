import {
  listPromoBannerSpecialFeatureOffers,
  getSpecialFeatureWindowStatus,
  type SpecialFeatureOfferRow,
} from "@/data/special-feature-offers";
import { formatUsd } from "@/lib/admin-markup";
import { formatSpecialFeatureOutsideBagFees } from "@/lib/special-feature-bag-fees";
import { resolveSpecialFeatureNotes } from "@/lib/special-feature-notes";
import { formatSpecialFeatureWindowLabel } from "@/lib/special-feature-window-label";
import { cn } from "@/lib/utils";
import {
  specialFeaturePackagingModeLabel,
  type SpecialFeaturePackagingMode,
} from "@/lib/validations/special-feature-offer";

import {
  SpecialFeaturePromoBannerClient,
  type SpecialFeaturePromoBannerData,
} from "./special-feature-promo-banner-client";

function mapOfferToBannerData(
  offer: SpecialFeatureOfferRow,
): Omit<SpecialFeaturePromoBannerData, "colorIndex"> {
  const mode = offer.packagingMode as SpecialFeaturePackagingMode;
  const priceLabel =
    offer.priceUsdCents > 0 ? formatUsd(offer.priceUsdCents) : null;
  const airlineName = offer.airlineName.trim() ? offer.airlineName.trim() : null;
  const bagFeesText = formatSpecialFeatureOutsideBagFees({
    airlineSecondBagUsdCents: offer.airlineSecondBagUsdCents,
    airlineThirdBagUsdCents: offer.airlineThirdBagUsdCents,
    airlineFourthBagUsdCents: offer.airlineFourthBagUsdCents,
  });
  const airlineBagFeeExtraNote = offer.airlineBagFeeExtraNote.trim() || null;
  const windowLabel = formatSpecialFeatureWindowLabel(
    offer.startsAt,
    offer.endsAt,
  );

  return {
    id: offer.id,
    name: offer.name,
    windowStatus: getSpecialFeatureWindowStatus(
      offer.startsAt,
      offer.endsAt,
      offer.isActive,
    ),
    priceLabel,
    windowLabel,
    packagingModeLabel: specialFeaturePackagingModeLabel(mode),
    airlineName,
    bagFeesText,
    airlineBagFeeExtraNote,
    notes: resolveSpecialFeatureNotes(offer.notes),
  };
}

/**
 * Sitewide promo banner for published suitcase specials — compact strip with one
 * colored segment per offer. Click a segment for full details.
 */
export async function SpecialFeaturePromoBanner({
  className,
}: {
  className?: string;
}) {
  const offers = await listPromoBannerSpecialFeatureOffers();
  if (offers.length === 0) return null;

  return (
    <SpecialFeaturePromoBannerClient
      className={cn(className)}
      offers={offers.map((offer, index) => ({
        ...mapOfferToBannerData(offer),
        colorIndex: index,
      }))}
    />
  );
}
