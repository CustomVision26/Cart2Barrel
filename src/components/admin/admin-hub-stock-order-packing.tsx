import { ExternalLink, Package } from "lucide-react";

import {
  adminPaidOrderReceiptHref,
  type HubStockOrderPackingPackage,
} from "@/lib/hub-stock-box";

export function AdminHubStockOrderPacking({
  orderId,
  packages,
}: {
  orderId: string;
  packages: HubStockOrderPackingPackage[];
}) {
  const usPackages = packages.filter((pkg) => pkg.destination === "us_address");
  const overseas = packages.filter((pkg) => pkg.destination === "overseas_container");
  const receiptHref = adminPaidOrderReceiptHref(orderId);

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/45 bg-primary/8 ring-2 ring-primary/25">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-primary/20 bg-primary/10 px-3.5 py-3">
        <div className="min-w-0 space-y-0.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Package className="size-3.5 shrink-0" aria-hidden />
            In-hub warehouse packing
          </p>
          <p className="text-[11px] text-muted-foreground">
            Outer box size for US in-hub items packed together. Also printed on the
            order receipt.
          </p>
        </div>
        <a
          href={receiptHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          View order receipt
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </header>
      <ul className="space-y-2.5 p-3" role="list">
        {usPackages.map((pkg) => (
          <li
            key={pkg.key}
            className="rounded-xl border border-primary/25 bg-background/80 px-3.5 py-3"
          >
            <p className="text-sm font-semibold text-foreground">
              {pkg.boxSizeLabel ?? "Box size not on file"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pkg.itemCount} in-hub {pkg.itemCount === 1 ? "product" : "products"}
              {" · "}
              {pkg.unitCount} {pkg.unitCount === 1 ? "unit" : "units"} packed together
              {pkg.shippingLabel ? ` · ${pkg.shippingLabel}` : ""}
            </p>
            {pkg.productLabels.length > 0 ?
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {pkg.productLabels.join(" · ")}
              </p>
            : null}
            {!pkg.boxSizeLabel ?
              <p className="mt-1 text-[11px] text-amber-500">
                Add weight and L×W×H on the in-hub catalog SKU to show a pack box.
              </p>
            : null}
          </li>
        ))}
        {overseas.map((pkg) => (
          <li
            key={pkg.key}
            className="rounded-xl border border-primary/25 bg-background/80 px-3.5 py-3"
          >
            <p className="text-sm font-semibold text-foreground">Overseas hub packing</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pkg.itemCount} in-hub {pkg.itemCount === 1 ? "product" : "products"} go
              into the customer&apos;s overseas container. No US outbound box.
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
