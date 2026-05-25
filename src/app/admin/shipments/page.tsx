import { AdminPageTitleWithHelp } from "@/components/admin/admin-page-title-with-help";
import { AdminShipmentsPanel } from "@/components/admin/admin-shipments-panel";
import { listAdminShipmentChargePageData } from "@/data/admin-barrel-outbound-shipping-charges";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { ADMIN_SHIPPING_CHARGE_PREVIEW_ROW } from "@/lib/barrel-outbound-shipping-charge";
import { loadAdminStaffProfilesByClerkUserIds } from "@/lib/admin-staff-profiles.server";
import { safeCurrentUser } from "@/lib/safe-current-user";

export const dynamic = "force-dynamic";

export default async function AdminShipmentsPage() {
  const cu = await safeCurrentUser();
  const admin = cu.ok && cu.user ? isClerkAdmin(cu.user) : false;

  const pageData =
    admin ?
      await listAdminShipmentChargePageData()
    : { customerGroups: [] };

  const { customerGroups } = pageData;
  const staffProfilesByClerkUserId =
    admin ?
      await loadAdminStaffProfilesByClerkUserIds(
        customerGroups.flatMap((group) => [
          ...group.readyContainers.map((row) => row.updatedByClerkUserId),
          ...group.notReadyContainers.map((row) => row.updatedByClerkUserId),
        ]),
      )
    : {};
  const totalContainers = customerGroups.reduce(
    (n, g) => n + g.readyContainers.length + g.notReadyContainers.length,
    0,
  );
  const showPreview = admin && totalContainers === 0;

  return (
    <div className="space-y-8">
      <AdminPageTitleWithHelp
        title="Shipments"
        tooltipClassName="w-80"
        help={
          <>
            All active customer containers — ready and still packing. Enter costs per
            container; published charges appear on{" "}
            <span className="font-medium text-foreground">
              Dashboard → Shipping → Pricing
            </span>{" "}
            after the customer confirms shipping preferences. Expand a customer section for
            nested search and pagination on their containers.
          </>
        }
      />

      {!admin ?
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          You do not have admin access.
        </p>
      : (
        <AdminShipmentsPanel
          customerGroups={customerGroups}
          showPreview={showPreview}
          previewRow={ADMIN_SHIPPING_CHARGE_PREVIEW_ROW}
          staffProfilesByClerkUserId={staffProfilesByClerkUserId}
        />
      )}
    </div>
  );
}
