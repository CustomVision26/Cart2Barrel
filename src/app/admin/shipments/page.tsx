import { AdminShippingChargeIntakeCard } from "@/components/admin/admin-shipping-charge-intake-card";
import { listAdminShipmentChargePageData } from "@/data/admin-barrel-outbound-shipping-charges";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { ADMIN_SHIPPING_CHARGE_PREVIEW_ROW } from "@/lib/barrel-outbound-shipping-charge";
import { safeCurrentUser } from "@/lib/safe-current-user";

export const dynamic = "force-dynamic";

const NOT_READY_LOCK_MESSAGE =
  "Container is still being packed. Publish charges after it is full and the customer confirms shipping on Dashboard → Shipping.";

export default async function AdminShipmentsPage() {
  const cu = await safeCurrentUser();
  const admin = cu.ok && cu.user ? isClerkAdmin(cu.user) : false;

  const pageData =
    admin ?
      await listAdminShipmentChargePageData()
    : { customerGroups: [] };

  const { customerGroups } = pageData;
  const totalContainers = customerGroups.reduce(
    (n, g) => n + g.readyContainers.length + g.notReadyContainers.length,
    0,
  );
  const showPreview = admin && totalContainers === 0;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Shipments
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          All active customer containers — ready and still packing. Enter costs per
          container; published charges appear on{" "}
          <span className="font-medium text-foreground">
            Dashboard → Shipping → Pricing
          </span>{" "}
          after the customer confirms shipping preferences.
        </p>
      </header>

      {!admin ?
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          You do not have admin access.
        </p>
      : (
        <div className="grid max-w-2xl gap-8">
          {showPreview ?
            <section className="space-y-3">
              <header className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Charge intake (preview)
                </h2>
                <p className="text-sm text-muted-foreground">
                  This is the form you will use once customers have containers in the
                  system.
                </p>
              </header>
              <AdminShippingChargeIntakeCard
                row={ADMIN_SHIPPING_CHARGE_PREVIEW_ROW}
                publishEnabled={false}
                lockMessage="Preview only — publish unlocks when a customer has a full container on Dashboard → Shipping."
              />
            </section>
          : null}

          {customerGroups.map((group) => (
            <section key={group.clerkUserId} className="space-y-5">
              <header className="space-y-0.5 border-b border-border/60 pb-2">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {group.customerName ?? "Customer"}
                </h2>
                {group.customerEmail ?
                  <p className="text-sm text-muted-foreground">{group.customerEmail}</p>
                : (
                  <p className="text-xs text-muted-foreground">{group.clerkUserId}</p>
                )}
              </header>

              {group.readyContainers.length > 0 ?
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground">
                    Ready for shipping ({group.readyContainers.length})
                  </h3>
                  <div className="grid gap-3">
                    {group.readyContainers.map((row) => (
                      <AdminShippingChargeIntakeCard
                        key={row.barrelId}
                        row={row}
                        publishEnabled={!row.paidAt}
                      />
                    ))}
                  </div>
                </div>
              : null}

              {group.notReadyContainers.length > 0 ?
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Not ready for shipping ({group.notReadyContainers.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Still filling — customer cannot confirm shipping or pay outbound
                    charges yet.
                  </p>
                  <div className="grid gap-3">
                    {group.notReadyContainers.map((row) => (
                      <AdminShippingChargeIntakeCard
                        key={row.barrelId}
                        row={row}
                        publishEnabled={false}
                        lockMessage={NOT_READY_LOCK_MESSAGE}
                      />
                    ))}
                  </div>
                </div>
              : null}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
