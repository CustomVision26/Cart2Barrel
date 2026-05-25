import Link from "next/link";

import { AdminPushPackingToCartButton } from "@/components/admin/admin-push-packing-to-cart-button";
import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import type { CustomerPricingPackageListRow } from "@/data/customer-pricing-packages";
import { formatUsd } from "@/lib/admin-markup";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function editPackageHref(clerkUserId: string): string {
  const params = new URLSearchParams({
    tab: "customer-packages",
    packageTab: "customer",
    userId: clerkUserId,
  });
  return `/admin/overview?${params.toString()}`;
}

function formatUpdatedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type AdminCustomerPackagesListPanelProps = {
  packages: CustomerPricingPackageListRow[];
};

export function AdminCustomerPackagesListPanel({
  packages,
}: AdminCustomerPackagesListPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Saved customer packages</CardTitle>
        <CardDescription>
          Custom pricing per shopper. Use <span className="font-medium text-foreground">Apply to cart</span>{" "}
          to add barrel/bin packing charges to their cart total from current container
          quantities. Edit opens the package on Select customer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {packages.length === 0 ?
          <p className="text-sm text-muted-foreground">
            No custom packages yet. Use{" "}
            <span className="font-medium text-foreground">Select customer</span> to create
            one.
          </p>
        : <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border/80 bg-card ring-1 ring-foreground/5">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead className="border-b border-border bg-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Cart (barrel / bin)</th>
                  <th className="px-3 py-2 font-medium">Est. packing</th>
                  <th className="px-3 py-2 font-medium">In cart</th>
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 font-medium">Barrel (1 / 2+)</th>
                  <th className="px-3 py-2 font-medium">Bin (1 / 2+)</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {packages.map((row) => (
                  <tr
                    key={row.clerkUserId}
                    className="border-b border-border/80 last:border-0"
                  >
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium text-foreground">{row.displayName}</p>
                      {row.email ?
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                      : null}
                    </td>
                    <td className="px-3 py-3 align-top tabular-nums text-foreground">
                      {row.cartBarrelCount} / {row.cartBinCount}
                    </td>
                    <td className="px-3 py-3 align-top tabular-nums text-foreground">
                      {row.cartBarrelCount + row.cartBinCount > 0 ?
                        formatUsd(row.cartPackingPreviewCents)
                      : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 align-top text-xs">
                      {row.packingAppliedToCartAt && row.appliedCartPackingCents != null ?
                        <span className="font-medium text-foreground">
                          {formatUsd(row.appliedCartPackingCents)}
                        </span>
                      : <span className="text-muted-foreground">Not applied</span>}
                    </td>
                    <td className="px-3 py-3 align-top text-muted-foreground">
                      {row.label ?? "—"}
                    </td>
                    <td className="px-3 py-3 align-top text-xs tabular-nums text-foreground">
                      {formatUsd(row.singleBarrelPackingFeeCents)}
                      <span className="text-muted-foreground"> / </span>
                      {formatUsd(row.multiBarrelPackingPerUnitCents)}
                    </td>
                    <td className="px-3 py-3 align-top text-xs tabular-nums text-foreground">
                      {formatUsd(row.singleBinPackingFeeCents)}
                      <span className="text-muted-foreground"> / </span>
                      {formatUsd(row.multiBinPackingPerUnitCents)}
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-muted-foreground whitespace-nowrap">
                      {formatUpdatedAt(row.updatedAt)}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <AdminPushPackingToCartButton
                          clerkUserId={row.clerkUserId}
                          cartBarrelCount={row.cartBarrelCount}
                          cartBinCount={row.cartBinCount}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={editPackageHref(row.clerkUserId)} />}
                        >
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FloatingHorizontalScroll>
        }
      </CardContent>
    </Card>
  );
}
