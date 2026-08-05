import {
  listPromoBannerSpecialFeatureOffers,
  getSpecialFeatureWindowStatus,
  type SpecialFeatureOfferRow,
} from "@/data/special-feature-offers";
import { getSpecialOfferSlotSummariesByOfferId } from "@/data/special-feature-suitcase-slots";
import { formatUsd } from "@/lib/admin-markup";
import { formatSpecialFeatureOutsideBagFees } from "@/lib/special-feature-bag-fees";
import { formatSpecialOfferSlotLabel } from "@/lib/special-feature-suitcase-slots";
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
  slotsLabel: string | null,
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
    slotsLabel,
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

  /** Only capped offers need reservation counts — uncapped return immediately. */
  const cappedOffers = offers.filter(
    (o) => o.suitcaseSlotCapacity != null && o.suitcaseSlotCapacity > 0,
  );
  const slotSummaries =
    cappedOffers.length > 0 ?
      await getSpecialOfferSlotSummariesByOfferId(cappedOffers)
    : new Map();

  return (
    <SpecialFeaturePromoBannerClient
      className={cn(className)}
      offers={offers.map((offer, index) => {
        const summary = slotSummaries.get(offer.id);
        return {
          ...mapOfferToBannerData(
            offer,
            summary ? formatSpecialOfferSlotLabel(summary) : null,
          ),
          colorIndex: index,
        };
      })}
    />
  );
}
