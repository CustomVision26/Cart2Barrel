import { getDb } from "@/db";
import { orderContainerItems } from "@/db/schema";
import type { ContainerCheckoutLine } from "@/data/user-container-cart";
import {
  allocateContainerPackingFeeToLineCents,
  containerPackingPerUnitCentsForKind,
  type CargoBoxPackingCounts,
  type ContainerPackingRates,
} from "@/lib/container-packing-fee";
import { ensureOrderContainerPackagingFeeColumns } from "@/data/ensure-order-container-packaging-fee-schema";
import { isMissingOrderContainerPackagingFeeColumnError } from "@/lib/db-column-missing";

export type OrderContainerPackingContext = {
  barrelCount: number;
  binCount: number;
  cargoBoxCounts?: CargoBoxPackingCounts;
  rates: ContainerPackingRates;
};

function packingFieldsForLine(
  line: ContainerCheckoutLine,
  packing?: OrderContainerPackingContext,
): { packagingFeeCents: number; packagingPerUnitCents: number } {
  if (!packing) {
    return { packagingFeeCents: 0, packagingPerUnitCents: 0 };
  }
  return {
    packagingFeeCents: allocateContainerPackingFeeToLineCents({
      kind: line.kind,
      quantity: line.quantity,
      barrelCount: packing.barrelCount,
      binCount: packing.binCount,
      rates: packing.rates,
      sizeLabel: line.sizeLabel,
      cargoBoxCounts: packing.cargoBoxCounts,
    }),
    packagingPerUnitCents: containerPackingPerUnitCentsForKind(
      line.kind,
      packing.barrelCount,
      packing.binCount,
      packing.rates,
      {
        sizeLabel: line.sizeLabel,
        cargoBoxCounts: packing.cargoBoxCounts,
      },
    ),
  };
}

export async function insertOrderContainerItems(
  orderId: string,
  lines: ContainerCheckoutLine[],
  packing?: OrderContainerPackingContext,
): Promise<{ ok: true } | { ok: false; cause: unknown }> {
  if (lines.length === 0) return { ok: true };
  await ensureOrderContainerPackagingFeeColumns();
  const db = getDb();
  const withPacking = lines.map((l) => ({
    orderId,
    containerOfferingId: l.offeringId,
    quantity: l.quantity,
    unitPriceCents: l.unitPriceCents,
    lineTotalCents: l.lineTotalCents,
    ...packingFieldsForLine(l, packing),
    nameSnapshot: l.name,
    sizeSnapshot: l.sizeLabel,
    kindSnapshot: l.kind,
    cartLineAddedAt: l.cartLineAddedAt,
  }));
  try {
    await db.insert(orderContainerItems).values(withPacking);
    return { ok: true };
  } catch (e) {
    if (!isMissingOrderContainerPackagingFeeColumnError(e)) {
      return { ok: false, cause: e };
    }
    try {
      await db.insert(orderContainerItems).values(
        lines.map((l) => ({
          orderId,
          containerOfferingId: l.offeringId,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          lineTotalCents: l.lineTotalCents,
          nameSnapshot: l.name,
          sizeSnapshot: l.sizeLabel,
          kindSnapshot: l.kind,
          cartLineAddedAt: l.cartLineAddedAt,
        })),
      );
      return { ok: true };
    } catch (retry) {
      return { ok: false, cause: retry };
    }
  }
}
