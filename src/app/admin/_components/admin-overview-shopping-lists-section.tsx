import { listSubmittedShoppingListQuotesForAdmin } from "@/data/shopping-list-quotes";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import { AdminShoppingListQuotesPanel } from "@/components/admin/admin-shopping-list-quotes-panel";
import { getAdminMarkupSettings } from "@/lib/admin-markup";

export async function AdminOverviewShoppingListsSection({
  selectedClerkUserId,
  initialBatchSessionId,
}: {
  selectedClerkUserId?: string;
  initialBatchSessionId?: string;
}) {
  const [lists, pricing] = await Promise.all([
    listSubmittedShoppingListQuotesForAdmin({
      clerkUserId: selectedClerkUserId,
    }),
    getMerchantPricingForEstimates(selectedClerkUserId),
  ]);
  const markup = getAdminMarkupSettings();

  return (
    <AdminShoppingListQuotesPanel
      lists={lists}
      taxBps={markup.taxBps}
      defaultShippingCents={markup.defaultShippingCents}
      serviceTiers={pricing.serviceTiers}
      initialBatchSessionId={initialBatchSessionId}
    />
  );
}
