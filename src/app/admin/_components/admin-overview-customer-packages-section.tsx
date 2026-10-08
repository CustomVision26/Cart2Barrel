import {
  AdminCustomerPackagesHub,
  type CustomerPackagesSubTab,
} from "@/components/admin/admin-customer-packages-hub";
import {
  getCustomerPricingPackage,
  listCustomerPricingPackagesForAdmin,
  listProfilesForAdminPicker,
} from "@/data/customer-pricing-packages";
import { listContainerPackingFeeRecords } from "@/data/container-packing-fee-records";
import { getMerchantPricingForEstimates } from "@/data/merchant-pricing-settings";

export async function AdminOverviewCustomerPackagesSection({
  packageTab,
  selectedClerkUserId,
}: {
  packageTab: CustomerPackagesSubTab;
  selectedClerkUserId?: string;
}) {
  const [users, savedPackages, globalPricing, packingFeeRecords] = await Promise.all([
    listProfilesForAdminPicker(),
    listCustomerPricingPackagesForAdmin(),
    getMerchantPricingForEstimates(),
    listContainerPackingFeeRecords(),
  ]);

  const customerPackage =
    selectedClerkUserId ?
      await getCustomerPricingPackage(selectedClerkUserId)
    : null;

  return (
    <AdminCustomerPackagesHub
      packageTab={packageTab}
      packingFeeRecords={packingFeeRecords}
      users={users}
      savedPackages={savedPackages}
      selectedClerkUserId={selectedClerkUserId}
      globalPricing={globalPricing}
      customerPackage={customerPackage}
    />
  );
}
