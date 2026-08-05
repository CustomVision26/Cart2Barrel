import {
  AdminQuoteExpiryHub,
  type QuoteExpirySubTab,
} from "@/components/admin/admin-quote-expiry-hub";
import { listProfilesForAdminPicker } from "@/data/customer-pricing-packages";
import {
  getCustomerQuoteExpiryOverride,
  listCustomerQuoteExpiryOverridesForAdmin,
  listProductQuoteExpiryOverridesForAdmin,
  loadQuoteExpirySettings,
  searchQuotedProductsForAdminExpiry,
} from "@/data/quote-expiry-settings";

type AdminOverviewQuoteExpirySectionProps = {
  expiryTab: QuoteExpirySubTab;
  selectedClerkUserId?: string;
};

export async function AdminOverviewQuoteExpirySection({
  expiryTab,
  selectedClerkUserId,
}: AdminOverviewQuoteExpirySectionProps) {
  const [
    settings,
    users,
    customerOverrides,
    selectedCustomerOverride,
    productOverrides,
    recentQuoted,
  ] = await Promise.all([
    loadQuoteExpirySettings(),
    listProfilesForAdminPicker(),
    listCustomerQuoteExpiryOverridesForAdmin(),
    selectedClerkUserId
      ? getCustomerQuoteExpiryOverride(selectedClerkUserId)
      : Promise.resolve(null),
    listProductQuoteExpiryOverridesForAdmin(),
    searchQuotedProductsForAdminExpiry({
      query: "",
      clerkUserId: selectedClerkUserId ?? null,
      limit: 25,
    }),
  ]);

  const initialProductRows =
    !selectedClerkUserId && productOverrides.length > 0
      ? productOverrides
      : recentQuoted;

  return (
    <AdminQuoteExpiryHub
      expiryTab={expiryTab}
      selectedClerkUserId={selectedClerkUserId}
      hubExpiryMinutes={settings.expiryMinutes}
      hubUpdatedAt={settings.updatedAt}
      users={users}
      customerOverrides={customerOverrides}
      selectedCustomerOverrideMinutes={
        selectedCustomerOverride?.expiryMinutes ?? null
      }
      productRows={initialProductRows}
    />
  );
}
