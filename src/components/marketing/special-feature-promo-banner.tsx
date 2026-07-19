import { getPrimaryActiveSpecialFeatureOffer } from "@/data/special-feature-offers";
import { formatUsd } from "@/lib/admin-markup";
import { formatSpecialFeatureOutsideBagFees } from "@/lib/special-feature-bag-fees";
import { resolveSpecialFeatureNotes } from "@/lib/special-feature-notes";
import { formatSpecialFeatureWindowLabel } from "@/lib/special-feature-window-label";
import { cn } from "@/lib/utils";
import {
  specialFeaturePackagingModeLabel,
  type SpecialFeaturePackagingMode,
} from "@/lib/validations/special-feature-offer";

import { SpecialFeaturePromoBannerClient } from "./special-feature-promo-banner-client";

/**
 * Sitewide promo for a live suitcase special — compact summary bar above the
 * marketing pill and at the top of dashboard content. Double-click opens details.
 */
export async function SpecialFeaturePromoBanner({
  className,
}: {
  className?: string;
}) {
  const offer = await getPrimaryActiveSpecialFeatureOffer();
  if (!offer) return null;

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

  return (
    <SpecialFeaturePromoBannerClient
      className={cn(className)}
      offer={{
        name: offer.name,
        priceLabel,
        windowLabel,
        packagingModeLabel: specialFeaturePackagingModeLabel(mode),
        airlineName,
        bagFeesText,
        airlineBagFeeExtraNote,
        notes: resolveSpecialFeatureNotes(offer.notes),
      }}
    />
  );
}
