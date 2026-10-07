import { AdminOutboundChargeKindTabs } from "@/components/admin/admin-outbound-charge-kind-tabs";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminBarrelOutboundShippingChargeRow } from "@/lib/barrel-outbound-shipping-charge";

const CATALOG_LOCK_MESSAGE =
  "Save freight, broker, and courier companies and rate tables here. Publish a charge on a customer container from Shipments → Manage after that container is confirmed on Dashboard → Shipping.";

export function AdminContainerControlPanel({
  row,
}: {
  row: AdminBarrelOutboundShippingChargeRow;
}) {
  return (
    <div className="grid max-w-6xl gap-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Container control
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Same Freight charge, Broker, and Local courier tools as Manage on a
          shipment card. Use this tab to maintain companies, notes, pickup fees,
          and How it works publish without opening a container.
        </p>
      </header>
      <Card className="overflow-hidden border-border/80 bg-card shadow-sm">
        <CardContent className="p-4">
          <AdminOutboundChargeKindTabs
            row={row}
            publishEnabled={false}
            lockMessage={CATALOG_LOCK_MESSAGE}
          />
        </CardContent>
      </Card>
    </div>
  );
}
