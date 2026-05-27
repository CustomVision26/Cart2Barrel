import { formatUsd } from "@/lib/admin-markup";
import type { ContainerOffering, ContainerOfferingImage } from "@/db/schema";
import {
  DEFAULT_CONTAINER_PACKING_RATES,
  type ContainerPackingRates,
} from "@/lib/container-packing-fee";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";

export type ContainerCatalogChartImage = {
  id: string;
  imageUrl: string;
  sortIndex: number;
};

export type ContainerCatalogChartRow = {
  id: string;
  containerLabel: string;
  priceLabel: string;
  images: ContainerCatalogChartImage[];
};

export type ContainerPackingFeeChartRow = {
  containerLabel: string;
  chargeLabel: string;
};

/** Active container offerings for the public How it works catalog. */
export function buildContainerCatalogChartRows(
  entries: {
    offering: Pick<
      ContainerOffering,
      "id" | "name" | "sizeLabel" | "kind" | "priceUsdCents"
    >;
    images: Pick<ContainerOfferingImage, "id" | "imageUrl" | "sortIndex">[];
  }[],
): ContainerCatalogChartRow[] {
  return entries.map(({ offering, images }) => ({
    id: offering.id,
    containerLabel: `${offering.name} · ${containerOfferingKindLabel(offering.kind)} · ${offering.sizeLabel}`,
    priceLabel: formatUsd(offering.priceUsdCents),
    images: images
      .map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
        sortIndex: image.sortIndex,
      }))
      .sort((a, b) => a.sortIndex - b.sortIndex),
  }));
}

/** Packaging fee tiers shown alongside container catalog prices. */
export function buildContainerPackingFeeChartRows(
  rates: ContainerPackingRates = DEFAULT_CONTAINER_PACKING_RATES,
): ContainerPackingFeeChartRow[] {
  return [
    {
      containerLabel: "1 barrel in cart",
      chargeLabel: formatUsd(rates.singleBarrelPackingFeeCents),
    },
    {
      containerLabel: "2+ barrels in cart",
      chargeLabel: `${formatUsd(rates.multiBarrelPackingPerUnitCents)} per barrel`,
    },
    {
      containerLabel: "1 bin in cart",
      chargeLabel: formatUsd(rates.singleBinPackingFeeCents),
    },
    {
      containerLabel: "2+ bins in cart",
      chargeLabel: `${formatUsd(rates.multiBinPackingPerUnitCents)} per bin`,
    },
  ];
}
