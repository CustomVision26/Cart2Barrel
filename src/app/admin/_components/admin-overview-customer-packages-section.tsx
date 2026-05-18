import {
  AdminCustomerPackagesHub,
  type CustomerPackagesSubTab,
} from "@/components/admin/admin-customer-packages-hub";
import {
  getCustomerPricingPackage,
  listCustomerPricingPackagesForAdmin,
  listProfilesForAdminPicker,
} from "@/data/customer-pricing-packages";
import {
  getMerchantPricingForAdminEditor,
  getMerchantPricingForEstimates,
} from "@/data/merchant-pricing-settings";

export async function AdminOverviewCustomerPackagesSection({
  packageTab,
  selectedClerkUserId,
}: {
  packageTab: CustomerPackagesSubTab;
  selectedClerkUserId?: string;
}) {
  const [users, savedPackages, globalPricing, pricingEditor] = await Promise.all([
    listProfilesForAdminPicker(),
    listCustomerPricingPackagesForAdmin(),
    getMerchantPricingForEstimates(),
    getMerchantPricingForAdminEditor(),
  ]);

  const customerPackage =
    selectedClerkUserId ?
      await getCustomerPricingPackage(selectedClerkUserId)
    : null;

  return (
    <AdminCustomerPackagesHub
      packageTab={packageTab}
      initialPackingFeePerLineCents={pricingEditor.packingFeePerLineCents}
      initialContainerPackingRates={pricingEditor.containerPackingRates}
      users={users}
      savedPackages={savedPackages}
      selectedClerkUserId={selectedClerkUserId}
      globalPricing={globalPricing}
      customerPackage={customerPackage}
    />
  );
}
