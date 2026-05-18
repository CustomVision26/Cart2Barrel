import { AdminOutsidePurchaseIntakePanel } from "@/components/admin/admin-outside-purchase-intake-panel";
import { collectLatestQuotesForRequests } from "@/data/batch-quote-sessions";
import { listProfilesForAdminPicker } from "@/data/customer-pricing-packages";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";
import { listOutsidePurchaseIntakesForAdmin } from "@/data/outside-purchase-intake";
import {
  groupReturnRequestsByItemRequestId,
  listOutsidePurchaseReturnRequestsByItemRequestIds,
} from "@/data/outside-purchase-return-requests";
import { parseAdminCustomerFilter } from "@/lib/admin-customer-filter";
import { getClerkSessionGate } from "@/lib/clerk-session";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminOutsidePurchaseIntakePage({
  searchParams,
}: PageProps) {
  const gate = await getClerkSessionGate();
  if (!gate.ok || !gate.isAdmin) {
    return null;
  }

  const { clerkUserId } = parseAdminCustomerFilter((await searchParams) ?? {});
  const [customers, recentRows, merchantEstimateFees] = await Promise.all([
    listProfilesForAdminPicker(),
    listOutsidePurchaseIntakesForAdmin({
      clerkUserId: clerkUserId ?? undefined,
      limit: 80,
    }),
    getMerchantPricingForEstimates(),
  ]);

  const requestIds = recentRows.map((r) => r.request.id);
  const latestQuotesByRequestId =
    requestIds.length > 0 ?
      Object.fromEntries(await collectLatestQuotesForRequests(requestIds))
    : {};

  const returnRows =
    requestIds.length > 0 ?
      await listOutsidePurchaseReturnRequestsByItemRequestIds(requestIds)
    : [];
  const returnRequestsByItemRequestId =
    groupReturnRequestsByItemRequestId(returnRows);

  return (
    <AdminOutsidePurchaseIntakePanel
      customers={customers}
      recentRows={recentRows}
      latestQuotesByRequestId={latestQuotesByRequestId}
      returnRequestsByItemRequestId={returnRequestsByItemRequestId}
      serviceTiers={merchantEstimateFees.serviceTiers}
    />
  );
}
