import { getDb } from "@/db";
import { orderContainerItems } from "@/db/schema";
import type { ContainerCheckoutLine } from "@/data/user-container-cart";

export async function insertOrderContainerItems(
  orderId: string,
  lines: ContainerCheckoutLine[],
): Promise<{ ok: true } | { ok: false; cause: unknown }> {
  if (lines.length === 0) return { ok: true };
  const db = getDb();
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
      })),
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, cause: e };
  }
}
