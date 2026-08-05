import "server-only";

import {
  clearMerchandiseTopupCartForReconciliations,
  expandMerchandiseTopupReconciliationIdsForPayment,
  markMerchandiseTopupsPaidForCheckout,
  parseMerchandiseTopupReconciliationIdsFromMetadata,
} from "@/data/merchandise-topup-cart";
import { notifyCustomerMerchandiseTopupPaid } from "@/data/notify-merchandise-topup-paid";

export { parseMerchandiseTopupReconciliationIdsFromMetadata };

/** After a cart checkout that included merchandise top-up add-on charges. */
export async function fulfillMerchandiseTopupsFromCheckout(
  clerkUserId: string,
  representativeIds: string[],
  checkoutOrderId: string,
): Promise<void> {
  if (representativeIds.length === 0) return;
  const reconciliationIds =
    await expandMerchandiseTopupReconciliationIdsForPayment({
      clerkUserId,
      representativeIds,
    });
  await markMerchandiseTopupsPaidForCheckout({
    clerkUserId,
    reconciliationIds,
    checkoutOrderId,
  });
  await clearMerchandiseTopupCartForReconciliations(
    clerkUserId,
    representativeIds,
  );
  await notifyCustomerMerchandiseTopupPaid({
    clerkUserId,
    reconciliationIds,
  });
}
