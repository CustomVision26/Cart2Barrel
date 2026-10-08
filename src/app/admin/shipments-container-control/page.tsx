import { AdminContainerControlPanel } from "@/components/admin/admin-container-control-panel";
import { AdminPageTitleWithHelp } from "@/components/admin/admin-page-title-with-help";
import { AdminShipmentsTabNav } from "@/components/admin/admin-shipments-tab-nav";
import { listAdminShipmentChargePageData } from "@/data/admin-barrel-outbound-shipping-charges";
import { parseAdminCustomerFilter } from "@/lib/admin-customer-filter";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { buildAdminShippingCatalogPreviewRow } from "@/lib/barrel-outbound-shipping-charge";
import { safeCurrentUser } from "@/lib/safe-current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminShipmentsContainerControlPage({
  searchParams,
}: PageProps) {
  const cu = await safeCurrentUser();
  const admin = cu.ok && cu.user ? isClerkAdmin(cu.user) : false;

  const { clerkUserId: filterClerkUserId } = parseAdminCustomerFilter(
    (await searchParams) ?? {},
  );

  const pageData =
    admin ?
      await listAdminShipmentChargePageData(filterClerkUserId).catch(
        (error) => {
          console.error("[AdminShipmentsContainerControlPage]", error);
          return {
            customerGroups: [],
            catalogPartners: [],
            companyRates: [],
            catalogChargeBundle: [],
            catalogCompanyRateKinds: [],
          };
        },
      )
    : {
        customerGroups: [],
        catalogPartners: [],
        companyRates: [],
        catalogChargeBundle: [],
        catalogCompanyRateKinds: [],
      };

  const previewRow = buildAdminShippingCatalogPreviewRow({
    partners: pageData.catalogPartners,
    companyRates: pageData.companyRates,
    chargeBundle: pageData.catalogChargeBundle,
    companyRateKinds: pageData.catalogCompanyRateKinds,
  });

  return (
    <div className="space-y-8">
      <AdminPageTitleWithHelp
        title="Container control"
        tooltipClassName="w-80"
        help={
          <>
            Catalog for freight, broker, and local courier companies—the same
            tools as Manage on a Shipments card. Save companies, rate tables,
            pickup fees, and notes here. Publish amounts onto a customer
            container from Shipments after it is confirmed on Dashboard →
            Shipping.
          </>
        }
      />

      <AdminShipmentsTabNav activeTab="container-control" />

      {!admin ?
        <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          You do not have admin access.
        </p>
      : <AdminContainerControlPanel row={previewRow} />}
    </div>
  );
}
