import type { OrderContainerLineAdmin } from "@/data/order-container-admin";
import {
  pendingContainerRefundRequestsByLineIds,
  type PendingContainerRefundRequestBrief,
} from "@/data/order-container-refund-requests";
import {
  containerChargeRefundKey,
  sumContainerChargeRefundedCents,
} from "@/data/order-container-refunds";
import { refundableLineRemainderCents } from "@/lib/order-line-refund-eligibility";
import type { OrderContainerRefundChargeValue } from "@/lib/validations/order-container-refund-request";

export type ContainerChargeRefundSlice = {
  pending: PendingContainerRefundRequestBrief | null;
  refundedCents: number;
  remainderCents: number;
};

export type ContainerLineRefundState = {
  container: ContainerChargeRefundSlice;
  packingFee: ContainerChargeRefundSlice;
};

function emptySlice(pricedCents: number): ContainerChargeRefundSlice {
  return {
    pending: null,
    refundedCents: 0,
    remainderCents: refundableLineRemainderCents(pricedCents, 0),
  };
}

export function chargeAmountCentsForLine(
  line: OrderContainerLineAdmin,
  chargeTarget: OrderContainerRefundChargeValue,
): number {
  return chargeTarget === "packing_fee"
    ? Math.max(0, line.packagingFeeCents)
    : Math.max(0, line.lineTotalCents);
}

export async function listContainerLineRefundStateByLines(
  lines: OrderContainerLineAdmin[],
): Promise<Record<string, ContainerLineRefundState>> {
  const lineIds = [...new Set(lines.map((l) => l.id))];
  const [pending, refunded] = await Promise.all([
    pendingContainerRefundRequestsByLineIds(lineIds),
    sumContainerChargeRefundedCents(lineIds),
  ]);

  const out: Record<string, ContainerLineRefundState> = {};
  for (const line of lines) {
    const containerPriced = chargeAmountCentsForLine(line, "container");
    const packingPriced = chargeAmountCentsForLine(line, "packing_fee");
    const containerKey = containerChargeRefundKey(line.id, "container");
    const packingKey = containerChargeRefundKey(line.id, "packing_fee");
    const containerRefunded = refunded.get(containerKey) ?? 0;
    const packingRefunded = refunded.get(packingKey) ?? 0;
    out[line.id] = {
      container: {
        pending: pending.get(containerKey) ?? null,
        refundedCents: containerRefunded,
        remainderCents: refundableLineRemainderCents(
          containerPriced,
          containerRefunded,
        ),
      },
      packingFee: {
        pending: pending.get(packingKey) ?? null,
        refundedCents: packingRefunded,
        remainderCents: refundableLineRemainderCents(
          packingPriced,
          packingRefunded,
        ),
      },
    };
  }

  for (const id of lineIds) {
    if (!out[id]) {
      out[id] = {
        container: emptySlice(0),
        packingFee: emptySlice(0),
      };
    }
  }
  return out;
}
