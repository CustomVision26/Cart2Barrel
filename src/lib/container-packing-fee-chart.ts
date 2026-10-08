import { formatUsd } from "@/lib/admin-markup";
import type { ContainerOffering, ContainerOfferingImage } from "@/db/schema";
import {
  DEFAULT_CONTAINER_PACKING_RATES,
  type ContainerPackingRates,
} from "@/lib/container-packing-fee";
import {
  CARGO_BOX_PACKING_SIZES,
  containerOfferingKindLabel,
  packingFeeContainerLabel,
  type CargoBoxPackingSize,
  type ContainerOfferingKind,
} from "@/lib/validations/container-offering";

export type PackingFeeChartSource = {
  containerKind: ContainerOfferingKind;
  cargoBoxSize: CargoBoxPackingSize | null;
  singleFeeCents: number;
  multiFeeCents: number;
};

export type ContainerCatalogChartImage = {
  id: string;
  imageUrl: string;
  sortIndex: number;
};

export type ContainerCatalogChartRow = {
  id: string;
  containerLabel: string;
  priceLabel: string;
  kind: ContainerOfferingKind;
  customerNote: string;
  sizeLabel: string;
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
      | "id"
      | "name"
      | "sizeLabel"
      | "kind"
      | "priceUsdCents"
      | "customerNote"
    >;
    images: Pick<ContainerOfferingImage, "id" | "imageUrl" | "sortIndex">[];
  }[],
): ContainerCatalogChartRow[] {
  return entries.map(({ offering, images }) => ({
    id: offering.id,
    containerLabel: `${offering.name} · ${containerOfferingKindLabel(offering.kind)} · ${offering.sizeLabel}`,
    priceLabel: formatUsd(offering.priceUsdCents),
    kind: offering.kind,
    customerNote: offering.customerNote?.trim() ?? "",
    sizeLabel: offering.sizeLabel.trim(),
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
  publishedRecords?: readonly PackingFeeChartSource[],
): ContainerPackingFeeChartRow[] {
  if (publishedRecords && publishedRecords.length > 0) {
    const rows: ContainerPackingFeeChartRow[] = [];
    for (const record of publishedRecords) {
      const label = packingFeeContainerLabel(
        record.containerKind,
        record.cargoBoxSize,
      ).toLowerCase();
      rows.push({
        containerLabel: `1 ${label} in cart`,
        chargeLabel: formatUsd(record.singleFeeCents),
      });
      rows.push({
        containerLabel: `2+ ${label} in cart`,
        chargeLabel: `${formatUsd(record.multiFeeCents)} per ${label}`,
      });
    }
    return rows;
  }
  const rows: ContainerPackingFeeChartRow[] = [
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
  for (const size of CARGO_BOX_PACKING_SIZES) {
    const rate = rates.cargoBoxRates?.[size];
    if (!rate) continue;
    rows.push({
      containerLabel: `1 cargo box ${size} in cart`,
      chargeLabel: formatUsd(rate.singlePackingFeeCents),
    });
    rows.push({
      containerLabel: `2+ cargo box ${size} in cart`,
      chargeLabel: `${formatUsd(rate.multiPackingPerUnitCents)} per cargo box ${size}`,
    });
  }
  return rows;
}
