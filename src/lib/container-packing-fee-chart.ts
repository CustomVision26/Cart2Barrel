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

function packingFeePublicName(
  kind: ContainerOfferingKind,
  cargoBoxSize?: string | null,
): string {
  return packingFeeContainerLabel(kind, cargoBoxSize);
}

function packingFeeCartRow(
  countPrefix: "1" | "2+",
  name: string,
  chargeLabel: string,
): ContainerPackingFeeChartRow {
  return {
    containerLabel: `${countPrefix} ${name} Container in cart`,
    chargeLabel,
  };
}

/** Packaging fee tiers shown alongside container catalog prices. */
export function buildContainerPackingFeeChartRows(
  rates: ContainerPackingRates = DEFAULT_CONTAINER_PACKING_RATES,
  publishedRecords?: readonly PackingFeeChartSource[],
): ContainerPackingFeeChartRow[] {
  if (publishedRecords && publishedRecords.length > 0) {
    const rows: ContainerPackingFeeChartRow[] = [];
    for (const record of publishedRecords) {
      const name = packingFeePublicName(
        record.containerKind,
        record.cargoBoxSize,
      );
      rows.push(
        packingFeeCartRow("1", name, formatUsd(record.singleFeeCents)),
      );
      rows.push(
        packingFeeCartRow(
          "2+",
          name,
          `${formatUsd(record.multiFeeCents)} per ${name} Container`,
        ),
      );
    }
    return rows;
  }
  const rows: ContainerPackingFeeChartRow[] = [
    packingFeeCartRow(
      "1",
      "Barrel",
      formatUsd(rates.singleBarrelPackingFeeCents),
    ),
    packingFeeCartRow(
      "2+",
      "Barrel",
      `${formatUsd(rates.multiBarrelPackingPerUnitCents)} per Barrel Container`,
    ),
    packingFeeCartRow("1", "Bin", formatUsd(rates.singleBinPackingFeeCents)),
    packingFeeCartRow(
      "2+",
      "Bin",
      `${formatUsd(rates.multiBinPackingPerUnitCents)} per Bin Container`,
    ),
  ];
  for (const size of CARGO_BOX_PACKING_SIZES) {
    const rate = rates.cargoBoxRates?.[size];
    if (!rate) continue;
    const name = packingFeePublicName("cargo_box", size);
    rows.push(
      packingFeeCartRow("1", name, formatUsd(rate.singlePackingFeeCents)),
    );
    rows.push(
      packingFeeCartRow(
        "2+",
        name,
        `${formatUsd(rate.multiPackingPerUnitCents)} per ${name} Container`,
      ),
    );
  }
  return rows;
}
